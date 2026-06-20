#!/usr/bin/env python3
"""Import ERE topic audio + Excel text metadata into the Firebase audio bucket.

No third-party dependencies: reads .xlsx as zip/xml so it works in this repo's
plain Python environment.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}


def load_shared_strings(zf: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    values: list[str] = []
    for si in root.findall("m:si", NS):
        values.append("".join((t.text or "") for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")))
    return values


def cell_col(ref: str) -> str:
    match = re.match(r"([A-Z]+)", ref)
    return match.group(1) if match else ""


def cell_value(cell: ET.Element, shared: list[str]) -> str | None:
    value_type = cell.attrib.get("t")
    value_node = cell.find("m:v", NS)
    if value_type == "s" and value_node is not None:
        index = int(value_node.text or "0")
        return shared[index] if index < len(shared) else ""
    if value_type == "inlineStr":
        return "".join((x.text or "") for x in cell.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"))
    return value_node.text if value_node is not None else None


def workbook_sheets(zf: ZipFile) -> dict[str, str]:
    wb = ET.fromstring(zf.read("xl/workbook.xml"))
    rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
    sheets: dict[str, str] = {}
    for sheet in wb.findall("m:sheets/m:sheet", NS):
        rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = relmap[rid]
        path = "xl/" + target.lstrip("/") if not target.startswith("xl/") else target
        sheets[sheet.attrib["name"]] = path
    return sheets


def extract_topic_rows(workbook: Path, topic: int) -> list[dict[str, object]]:
    sheet_name = f"Topic {topic}"
    with ZipFile(workbook) as zf:
        shared = load_shared_strings(zf)
        sheets = workbook_sheets(zf)
        if sheet_name not in sheets:
            raise SystemExit(f"Sheet not found: {sheet_name}")
        root = ET.fromstring(zf.read(sheets[sheet_name]))

        rows: list[dict[str, object]] = []
        topic_title = ""
        for row in root.findall("m:sheetData/m:row", NS):
            row_num = int(row.attrib.get("r", "0"))
            if row_num == 1:
                continue
            values: dict[str, str | None] = {}
            for cell in row.findall("m:c", NS):
                values[cell_col(cell.attrib.get("r", ""))] = cell_value(cell, shared)

            url_id = values.get("A")
            row_type = values.get("D")
            part = (values.get("E") or "").strip()
            vi_text = values.get("G")
            en_text = values.get("H")
            audio_en = values.get("J")

            if part.startswith(f"Topic {topic}:"):
                topic_title = part.split(":", 1)[1].strip()

            if not audio_en:
                continue
            if not en_text:
                raise SystemExit(f"Row {row_num} has audio filename but no EN text")

            rows.append({
                "row": row_num,
                "url_id": url_id,
                "type": row_type,
                "part": part,
                "vi": vi_text,
                "en": en_text,
                "audio": audio_en,
                "topic_title": topic_title or f"Topic {topic}",
            })

    return rows


def metadata_for(row: dict[str, object], topic: int, language: str) -> dict[str, object]:
    filename = str(row["audio"])
    url_id = str(row["url_id"])
    topic_title = str(row["topic_title"])
    part = str(row["part"])
    row_type = str(row["type"])
    return {
        "id": f"ere-topic-{topic:02d}-{language}-{row_type}",
        "category": "ere",
        "sourceKind": "imported",
        "language": language,
        "textPrompt": row["en"],
        "ereVietnameseText": row.get("vi"),
        "ereTopic": topic,
        "ereTopicTitle": topic_title,
        "erePart": part,
        "ereType": row_type,
        "ereUrlId": url_id,
        "ereAudioFilename": filename,
        "label": ["ere", f"topic-{topic:02d}", language, row_type, part],
        "level": 1,
        "durationMs": None,
        "approvalStatus": "approved_resource",
        "license": "self-provided ERE topic audio import",
        "provenanceUrl": "",
        "attribution": "",
        "provider": "firebase-storage/imported-ere",
        "voiceId": "",
        "createdAt": "2026-06-20",
        "mseFocus": "sound",
        "resistanceTag": "ere",
        "lessonId": f"ere-topic-{topic:02d}-{topic_title.lower().replace(' ', '-')}",
        "mirrorGoal": "prosody",
    }


def gcloud_command() -> str | None:
    return shutil.which("gcloud") or shutil.which("gcloud.cmd") or shutil.which("gcloud.exe")


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def object_exists(gcloud: str, uri: str) -> bool:
    result = subprocess.run([gcloud, "storage", "ls", uri], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return result.returncode == 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Import ERE topic audio metadata to Firebase Cloud Storage")
    parser.add_argument("--workbook", required=True, type=Path)
    parser.add_argument("--audio-dir", required=True, type=Path)
    parser.add_argument("--topic", required=True, type=int)
    parser.add_argument("--language", default="en")
    parser.add_argument("--bucket", default="chunks-mirror-audio-284566312743")
    parser.add_argument("--execute", action="store_true", help="Upload to Cloud Storage. Without this, only validates and prints a summary.")
    args = parser.parse_args()

    if not args.workbook.exists():
        raise SystemExit(f"Workbook not found: {args.workbook}")
    if not args.audio_dir.exists():
        raise SystemExit(f"Audio directory not found: {args.audio_dir}")
    gcloud = gcloud_command()
    if args.execute and not gcloud:
        raise SystemExit("gcloud CLI is required for --execute")

    rows = extract_topic_rows(args.workbook, args.topic)
    excel_files = {str(row["audio"]) for row in rows}
    folder_files = {path.name for path in args.audio_dir.glob("*.mp3")}
    missing = sorted(excel_files - folder_files)
    extra = sorted(folder_files - excel_files)
    part_counts = Counter(str(row["part"]) for row in rows)

    summary = {
        "topic": args.topic,
        "language": args.language,
        "rows": len(rows),
        "excel_unique_files": len(excel_files),
        "folder_files": len(folder_files),
        "missing_in_folder": missing,
        "extra_in_folder": extra,
        "part_counts": dict(part_counts),
        "execute": args.execute,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if missing or extra:
        raise SystemExit("Audio filename validation failed")
    if not args.execute:
        return 0

    prefix = f"audio/ere/topic-{args.topic:02d}/{args.language}"
    with tempfile.TemporaryDirectory(prefix="ere-meta-") as temp_dir:
        temp = Path(temp_dir)
        uploaded = 0
        skipped = 0
        for row in rows:
            filename = str(row["audio"])
            audio_path = args.audio_dir / filename
            metadata_path = temp / f"{filename}.meta.json"
            metadata_path.write_text(json.dumps(metadata_for(row, args.topic, args.language), ensure_ascii=False, indent=2), encoding="utf-8")
            dest = f"gs://{args.bucket}/{prefix}/{filename}"
            meta_dest = f"{dest}.meta.json"
            if object_exists(gcloud, dest) and object_exists(gcloud, meta_dest):
                skipped += 1
                continue
            run([gcloud, "storage", "cp", str(audio_path), dest, "--quiet"])
            run([gcloud, "storage", "cp", str(metadata_path), meta_dest, "--quiet"])
            uploaded += 1

    print(f"Uploaded {uploaded} ERE clips to gs://{args.bucket}/{prefix}/ (skipped {skipped})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

# 06 — Runbook · Chunks Mirror (Sound)

How to run, generate audio, deploy (gated), and roll back.

## Local dev

```bash
npm install
cp .env.local.example .env.local   # fill in NINEROUTER_URL + NINEROUTER_KEY
npm run dev                         # http://localhost:5173
```

Mic permission is required for **C / Copy Capture**. Use Chrome/Edge for best MediaRecorder support.

## 9router TTS setup

Env (in `.env.local`, gitignored — never commit):

```bash
NINEROUTER_URL=https://<your-9router-host>
NINEROUTER_KEY=<key>            # omit if your 9router instance has auth disabled
```

Reference: https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills/9router-tts/SKILL.md

### Discovery

```bash
curl $NINEROUTER_URL/v1/models/tts | jq '.data[].id'
curl "$NINEROUTER_URL/v1/audio/voices?provider=edge-tts&lang=vi"
curl "$NINEROUTER_URL/v1/models/info?id=el/eleven_multilingual_v2"
```

### Generate one clip (server-side / curl)

```bash
curl -X POST "$NINEROUTER_URL/v1/audio/speech" \
  -H "Authorization: Bearer $NINEROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"edge-tts/vi-VN-HoaiMyNeural","input":"Xin chào"}' \
  --output speech.mp3
```

### Model selection per language (and Sentence Form)

- **Breadth (free, no auth):** `edge-tts/<locale-voice>` — one voice per language. Suggested defaults (full 24):
  `en-US-AriaNeural`, `vi-VN-HoaiMyNeural`, `zh-CN-XiaoxiaoNeural`, `fr-FR-DeniseNeural`,
  `ko-KR-SunHiNeural`, `ja-JP-NanamiNeural`, `es-ES-ElviraNeural`, `de-DE-KatjaNeural`,
  `it-IT-ElsaNeural`, `pt-BR-FranciscaNeural`, `ru-RU-SvetlanaNeural`, `ar-SA-ZariyahNeural`,
  `hi-IN-SwaraNeural`, `th-TH-PremwadeeNeural`, `id-ID-GadisNeural`, `nl-NL-ColetteNeural`,
  `tr-TR-EmelNeural`, `pl-PL-ZofiaNeural`, `sv-SE-SofieNeural`, `el-GR-AthinaNeural`,
  `uk-UA-PolinaNeural`, `ro-RO-AlinaNeural`, `cs-CZ-VlastaNeural`, `fil-PH-BlessicaNeural`.
  (Confirm exact voice ids live via the `voices` endpoint — they change.)
- **Premium quality:** `el/eleven_multilingual_v2` — auto-detects language from `input`; pass the target-language text directly. Use for selected or all languages when re-generating the library.
- **Other available in 9router (use via generator or on-demand in Resource Bank):** `google-tts/<lang>` (e.g. `google-tts/vi`), `deepgram/aura-...` (lang-appropriate aura voice).

**To expand the library (more phrases, Sentence Forms short/long, or switch voices/models):**
Edit `scripts/generate_library.py` (LANG_DATA + FORMS) then:
  `python scripts/generate_library.py --model edge-tts --forms short,long`
  `python scripts/generate_library.py --model "el/eleven_multilingual_v2" --forms short,long --langs en,vi,zh`
Re-running replaces `src/data/resources.json`, `prototype/bank.js`, and writes (new) audio files under `public/resources/audio/speech/`.
The app (after scaffold) consumes the same library + supports Sentence Form filter in Dynamic Settings and Resource Bank generate panel.

### In-app generation

The app calls the **same-origin proxy** `POST /api/tts` (never 9router directly from the browser). The proxy injects `NINEROUTER_KEY`, forwards to `/v1/audio/speech`, returns audio. Generated clips are persisted to `public/resources/audio/speech/` and a `ChunksAwareResource` row is appended to `src/data/resources.json` with `approvalStatus: candidate` until reviewed.

## Import audio (curated or user upload)

1. Provide file + license/provenance (CC0, CC-BY + attribution, paid pack, or self-made).
2. Trim to a mimicable length; normalize loudness.
3. Store under `public/resources/audio/<category>/`; append a resource row with `sourceKind: imported`, `approvalStatus: candidate`.
4. Promote to `approved_resource` only after license check.

## Build

```bash
npm run build     # must pass before any deploy
npm run preview   # serve the production build locally
```

## Deploy (GATED — Release Control)

Production deploys are **not** part of v1. When the time comes:

1. Clean working tree; `git commit`; `git tag vX.Y.Z`.
2. Move `/api/*` to Firebase Functions; set key: `firebase functions:config:set ninerouter.key="..."`.
3. `firebase hosting:channel:deploy preview` → validate the preview/canary URL.
4. Only then `firebase deploy` to production.
5. **Rollback:** `firebase hosting:rollback`; redeploy the prior git tag; verify Functions config restored.
6. Verify Hosting + Functions restore path before declaring done.

## Progress board

```bash
python -m http.server 8765      # then open context/progress-board.html
```

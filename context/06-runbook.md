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

The app calls the **same-origin proxy** `POST /api/tts` (never 9router directly from the browser). Firebase Functions inject `NINEROUTER_KEY`, forward to `/v1/audio/speech`, return audio, and persist generated clips through `/api/upload-audio` to `gs://chunks-mirror-audio-284566312743/audio/` with `.meta.json` sidecars. Local `public/resources/audio/` remains the seed bank.

### API readiness + server-to-server (S2S)

Public readiness check:

```bash
curl https://chunks-mirror.web.app/api/health
```

Protected S2S endpoints require `S2S_SECRET` via either `Authorization: Bearer <secret>` or `X-S2S-Key: <secret>`:

```bash
curl -H "Authorization: Bearer $S2S_SECRET" \
  https://chunks-mirror.web.app/api/s2s/health

curl -H "Authorization: Bearer $S2S_SECRET" \
  https://chunks-mirror.web.app/api/s2s/list-audio
```

Protected routes:
- `GET /api/s2s/health` — authenticated readiness.
- `GET /api/s2s/list-audio` — list Cloud Storage audio metadata.
- `POST /api/s2s/upload-audio` — body `{ audioBase64, contentType, metadata }`.
- `POST /api/s2s/delete-audio` — body `{ storagePath }` or `{ url }`.

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
2. Verify `/api/*` Firebase Functions are configured; set secrets: `firebase functions:secrets:set NINEROUTER_KEY`, `firebase functions:secrets:set S2S_SECRET`, and optional `firebase functions:secrets:set ADMIN_SECRET`.
3. `firebase hosting:channel:deploy preview --only hosting:chunks-mirror,functions` → validate the preview/canary URL.
4. Only then `firebase deploy --only hosting:chunks-mirror,functions` to production.
5. **Rollback:** `firebase hosting:rollback`; redeploy the prior git tag/functions; verify Secret Manager values and `chunks-mirror-audio-284566312743` bucket access restored.
6. Verify Hosting + Functions restore path before declaring done.

## Progress board

```bash
python -m http.server 8765      # then open context/progress-board.html
```

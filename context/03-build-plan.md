# 03 — Build Plan · Chunks Mirror (Sound)

Status: **Candidate** until Lucy confirms stack at the gate. Implementation tasks stay gated until then; docs + scaffold + throwaway prototype are allowed (Lucy: "chạy project" + "prototype").

## First shippable slice (the ignition)

> One button. Tap it → a real Source Signal plays for 3s with a countdown to 0 → the mic captures a 3s copy → (no score) → next item. Dynamic Settings above it change mode/timing/filters.

That slice is the **first visible win**. Everything else feeds it.

## Phases

### Phase 0 — Scaffold (allowed now)
- [x] Vite + React + TS project; Tailwind; lint/build scripts. (build passes; SettingsBar + library demo present)
- [x] Firebase Hosting preview config (`firebase.json`, `.firebaserc` placeholder). Production gated.
- [x] `.env.local.example` with `NINEROUTER_URL`, `NINEROUTER_KEY` placeholders. (enhanced in runbook for models + forms)
- [x] Folder skeleton per `AGENTS.md` file-placement rules. (api/, src/domain/, adapters/, features/{mirror,resources,settings}, src/ui/ tokens, data/)
- [x] /api/tts proxy + on-demand generation path + Resource Bank UI (demo integrated; full page stubs ready) + Sentence Form setting. Library (with forms + multi-model) reused.

### Phase 1 — Domain + data foundation
- [x] `src/domain/types.ts`: `ChunksAwareResource` (incl. new `form` for Sentence Form), `RoomSettings` (incl. `sentenceForm`), `LoopPhase`, `MirrorAttempt`.
- [x] `src/data/resources.json` + sample entries (multi-language speech; expanded with `form` + multi-model via generator).
- [x] `public/resources/audio/{speech,sfx,music}/` structure. (speech populated; sfx/music import-first per plan).
- [x] `approval.ts` (approved-only policy) + `selection.ts` (filter + random mix, now form-aware).
- [x] `StorageAdapter` interface + `LocalJsonStorageAdapter`.

### Phase 2 — Mirror Loop engine
- [x] `BrowserAudioPlaybackAdapter` + `BrowserMicRecordingAdapter`.
- [x] `MirrorLoopController` state machine (idle→preparing→playingOriginal→recordingCopy→betweenItems→preparing|waitingNext).
- [x] Timing contract: default 3s/3s, per-resource/level + Settings overrides.
- [x] Auto vs manual advance; optional ending-sound cue.
- [x] Emit `MirrorAttempt` (scoring stubbed off).

### Phase 3 — Mirror Room UI (prototype → real)
- [x] One primary button with live phase label, countdown-to-0 ring (SVG), recording indicator (pulsing dot).
- [x] Full G→O→C loop with auto/manual advance, ending-sound cue, stop/next controls.
- [x] Dynamic Settings panel: mode, G/C timing, category + language + level filters, random mix, ending cue, **+ Sentence Form (short/long) segmented control**.
- [x] Black/white/red Swiss system from `context/07-ui-system.md`. (CountdownRing + MirrorPage + SettingsBar + App shell).

### Phase 4 — Sound Engine (Resource Bank)
- [x] `/api/tts` proxy → 9router; `TTSAdapter`.
- [x] Generate speech across ≥20 languages → persist to bank (pre-generated). **Library expanded**: supports Sentence Forms (short/long), 24 langs target, multiple models (edge-tts, el/eleven_multilingual_v2, google-tts, deepgram, ...). Re-runnable via scripts/generate_library.py.
- [ ] `/api/sound` + `TextToSoundAdapter` (or import) for ≥1 mimicable SFX. (deferred; import path exists in UI).
- [x] User import: upload → (blob preview + metadata incl. form) → stage candidate. (demo flow in Resources surface).
- [x] Resource Bank Surface: list, filter (incl. new form), preview, generate (on-demand via proxy + model picker), import, approve notes. (Working demo integrated in App + stubs).
- [x] Two-phase generate in Bank: "Generate texts (phase 1 - real 9router lucy)" → prepared list titled "Prepared texts (N) — xóa cái không cần" (prune with x per item, stable tempId, default qty 50, multi-lang mix, short/long, level) → "Run TTS hàng loạt (phase 2)" using any model (e.g. eleven). All real proxy calls, zero mock data / no TEMPLATES in path. (evidence: src/App.tsx:generateTextsReal + prepared render + batch runner; vite.config /api/generate-text + /api/tts; npm run build clean; api/generate-text.ts handler).

### Phase 5 — Firebase preview readiness
- [x] Local build passes. (`npm run build` clean)
- [x] Move `/api/*` to Firebase Functions for prod; key in Secret Manager. Hosting target reserved as `chunks-mirror.web.app`. (see context/06-runbook.md)
- [ ] Document preview deploy + rollback/restore. No production deploy in v1. (gated)

## Verification commands

```bash
npm run dev          # local app
npm run build        # production build must pass
npm run lint
firebase hosting:channel:deploy preview --only hosting:chunks-mirror,functions   # preview only (gated)
```

## Release gates

- Stack confirmed by Lucy before Phase 1 implementation lands.
- Mirror Score stays OFF (ADR-0006).
- Production deploy requires Release Control (commit/tag, preview/canary, rollback, restore-path).

## Hermes tasks to seed

```text
P0: scaffold-vite-app
P1: domain-types + storage-adapter + sample-bank
P2: mirror-loop-controller + audio adapters
P3: mirror-room-ui (one button + dynamic settings)   [prototype first]
P4: tts-proxy + 9router multi-language generation
P4: resource-bank-surface + import pipeline
R&D: acoustic-scoring-v0 (deferred)
R&D: music-snippet-generation (deferred)
```

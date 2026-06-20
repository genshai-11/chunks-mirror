# 04 — Operating State · Chunks Mirror (Sound)

Snapshot of where the project actually is. Canonical task state is Hermes (when seeded); this mirrors it. Last update: 2026-06-20 16:43 GMT+7 (ERE functions-first work; Topic 5 upload paused).

## Current phase

**Firebase production live + 4-mode Mirror Room + Resource Bank cloud persistence.** Current focus: ERE functions-first implementation (record → STT → semantic compare → save attempt), with Topic 5 upload intentionally paused.

## Board snapshot

| Phase | State | Notes |
|---|---|---|
| Project OS docs | done | CONTEXT, AGENTS, context/01-08, progress board |
| P0 Scaffold | done | Vite + React + TS + Tailwind + firebase.json + .firebaserc + full folder skeleton + /api/tts proxy. Build passes. |
| P1 Domain + data | done | types (incl. `form` / `sentenceForm`), `selection.ts` (form-aware), `approval.ts`, `StorageAdapter` + `LocalJsonStorageAdapter`. resources.json + library (now with forms + multi-model). |
| P2 Mirror Loop engine | done | `BrowserAudioPlaybackAdapter`, `BrowserMicRecordingAdapter`, `MirrorLoopController` (full state machine incl. `awaitingCopy` self-paced gate + `beginCopy()`), timing from settings, **4 modes** (auto/manual/offline/custom) via flow gates `autoAdvance`+`gateBeforeCopy`, **per-boundary cues** (cueOnListen/cueOnMirror/cueOnEnd), `MirrorAttempt` emission (score off). See ADR-0013. |
| P3 Mirror Room UI | done | Real `MirrorPage` with one primary button + live phase + SVG countdown + recording/awaiting indicator + 4-mode selector + stop/next/beginCopy. **Collapsible Dynamic Settings sidebar** has explicit scrollbars + mobile momentum scrolling. Changing runtime settings while the loop is active pauses to idle so the next play reloads the new settings/pool. `SettingsBar` (4 modes + dynamic gate/cue toggles) + Swiss tokens. |
| P4 Sound Engine | active | **Library expanded** (Sentence Forms short/long, 24 langs target, multi-model: edge-tts / el/eleven_multilingual_v2 / google-tts / deepgram + custom). `/api/tts` + new `/api/generate-text` proxies. On-demand + **two-phase batch (real lucy text gen → review/delete prepared → TTS batch)** + import flow + Resource Bank surface. Animal SFX folder imported to Firebase bucket as `sfx_animal` with metadata sidecars (16 clips). |
| P5 Firebase preview/prod | live | Hosting site `chunks-mirror.web.app` live; repo points to `chunks-voicecloning-genshai`; `/api/*` moved to Firebase Functions; audio bucket `chunks-mirror-audio-284566312743` created and serving speech + animal SFX. Production deploy gated by release-control tags/preview validation. |

## Hermes board

- **Status: not yet created.** Blocker: confirm Hermes CLI availability in this environment, or create board `chunks-mirror-sound` and seed P0–P4 tasks from `03-build-plan.md`.

## Blockers / open

- Stack confirmation at build-plan gate (Candidate → Accepted).
- `NINEROUTER_URL` / `NINEROUTER_KEY` values needed before live TTS generation (placeholders in `.env.local.example`).
- Music Snippet generation + acoustic scoring are R&D (deferred).
- **ERE Topic 5 upload completed on 2026-06-20 17:28 GMT+7.** Final Storage count under `audio/ere/topic-05/en/`: **105/105 mp3** and **105/105 `.meta.json`**. `/api/list-audio` preview validation returns **105 ERE Topic 5** resources with part counts 10 / 25 / 20 / 10 / 15 / 15 / 10.
- ERE evaluation Functions endpoint `/api/ere/evaluate-attempt` is deployed in Firebase Functions. Evidence: `/api/health` returned OK and invalid ERE evaluation payload returned HTTP 400 on 2026-06-20 16:47 GMT+7. Preview branch `preview/ere-ui-evaluation` includes 9router SSE/stream parser fixes (`404fe37`, `2377825`).
- ERE UI + recording/evaluation UI + presenter/clicker controls are deployed to Firebase Hosting preview channel `ere-ui-eval-20260620`: https://chunks-mirror--ere-ui-eval-20260620-brns1cwp.web.app (expires 2026-06-27 16:51 GMT+7). Production Hosting remains unchanged. ERE Evaluation is now an explicit Dynamic Settings toggle and defaults **off**, so ERE can run as plain play → mirror audio without STT/LLM compare until the toggle is enabled.
- ERE preview E2E test with real Topic 5 mp3 payload succeeded on 2026-06-20 16:56 GMT+7: source `Let's say...`, transcript `Let's`, HTTP 200, saved attempt, semantic result `passed=false`, score `0.4`, feedback `You started correctly, but you missed “say.”`

## Progress

**Derived from checked acceptance items in `01-prd.md` + `03-build-plan.md`.**
Multiple items now satisfied with evidence after scaffold + library expansion + real lucy batch:
- Vite/React/TS + Tailwind + folders + Firebase Hosting target `chunks-mirror.web.app` + Functions `/api/*` config.
- Domain types + StorageAdapter + selection (incl. form filter) + sample bank.
- Dynamic Settings filters (Category + Language + Level + **Sentence Form**) change the pool.
- 9router TTS library generation (≥20 langs + multiple forms + multi-model support) + on-demand proxy path.
- **P4 Bank generate**: two-phase real-only — phase 1 calls 9router model "lucy" for texts (no mock), shows "Prepared texts (N) — xóa cái không cần" list with per-item delete, phase 2 runs TTS batch on pruned list (staged live, any model incl. eleven_multilingual_v2). Evidence: `npx tsc --noEmit` + `npm run build` clean (2026-06-16), generateTextsReal fetch /api/generate-text {model:'lucy'}, prepared map with tempId + filter x, qty default 50 + 24 lang chips, legacy single collapsed, no TEMPLATES/mock paths left in main flow.
See `03-build-plan.md` for checked Phase 0/P1/P4 items. Evidence: `npm run build` clean, working SettingsBar with sentence form seg, Resources list showing `form` column, one-button demo playing real library audio, proxy implemented.

## Update rules

When work lands: check the matching acceptance item only with evidence → update this snapshot → update `progress-board.html` → log any decision in `05-decisions.md`.

# 04 — Operating State · Chunks Mirror (Sound)

Snapshot of where the project actually is. Canonical task state is Hermes (when seeded); this mirrors it. Last update: 2026-06-16 (real 9router lucy prepared texts flow).

## Current phase

**Scaffold complete (P0 done) + library expanded + early Resource Bank + Dynamic Settings (incl. new Sentence Form) + /api/tts proxy.** Stack accepted ("A, go"). Next: full Mirror Loop controller (P2) + polish on Bank surface + preview deploy.

## Board snapshot

| Phase | State | Notes |
|---|---|---|
| Project OS docs | done | CONTEXT, AGENTS, context/01-08, progress board |
| P0 Scaffold | done | Vite + React + TS + Tailwind + firebase.json + .firebaserc + full folder skeleton + /api/tts proxy. Build passes. |
| P1 Domain + data | done | types (incl. `form` / `sentenceForm`), `selection.ts` (form-aware), `approval.ts`, `StorageAdapter` + `LocalJsonStorageAdapter`. resources.json + library (now with forms + multi-model). |
| P2 Mirror Loop engine | done | `BrowserAudioPlaybackAdapter`, `BrowserMicRecordingAdapter`, `MirrorLoopController` (full state machine incl. `awaitingCopy` self-paced gate + `beginCopy()`), timing from settings, **4 modes** (auto/manual/offline/custom) via flow gates `autoAdvance`+`gateBeforeCopy`, **per-boundary cues** (cueOnListen/cueOnMirror/cueOnEnd), `MirrorAttempt` emission (score off). See ADR-0012. |
| P3 Mirror Room UI | done | Real `MirrorPage` with one primary button + live phase + SVG countdown + recording/awaiting indicator + 4-mode selector + stop/next/beginCopy. **Collapsible Dynamic Settings sidebar** (own scroll, accordion sections, mobile-tuned, controller reads live settings via refs so mid-session toggles don't reset). `SettingsBar` (4 modes + dynamic gate/cue toggles) + Swiss tokens. |
| P4 Sound Engine | active | **Library expanded** (Sentence Forms short/long, 24 langs target, multi-model: edge-tts / el/eleven_multilingual_v2 / google-tts / deepgram + custom). `/api/tts` + new `/api/generate-text` proxies. On-demand + **two-phase batch (real lucy text gen → review/delete prepared → TTS batch)** + import flow + Resource Bank surface (list/filter/preview/generate/import demo with form column). |
| P5 Firebase preview | pending | gated |

## Hermes board

- **Status: not yet created.** Blocker: confirm Hermes CLI availability in this environment, or create board `chunks-mirror-sound` and seed P0–P4 tasks from `03-build-plan.md`.

## Blockers / open

- Stack confirmation at build-plan gate (Candidate → Accepted).
- `NINEROUTER_URL` / `NINEROUTER_KEY` values needed before live TTS generation (placeholders in `.env.local.example`).
- Music Snippet generation + acoustic scoring are R&D (deferred).

## Progress

**Derived from checked acceptance items in `01-prd.md` + `03-build-plan.md`.**
Multiple items now satisfied with evidence after scaffold + library expansion + real lucy batch:
- Vite/React/TS + Tailwind + folders + Firebase preview config (Phase 0).
- Domain types + StorageAdapter + selection (incl. form filter) + sample bank.
- Dynamic Settings filters (Category + Language + Level + **Sentence Form**) change the pool.
- 9router TTS library generation (≥20 langs + multiple forms + multi-model support) + on-demand proxy path.
- **P4 Bank generate**: two-phase real-only — phase 1 calls 9router model "lucy" for texts (no mock), shows "Prepared texts (N) — xóa cái không cần" list with per-item delete, phase 2 runs TTS batch on pruned list (staged live, any model incl. eleven_multilingual_v2). Evidence: `npx tsc --noEmit` + `npm run build` clean (2026-06-16), generateTextsReal fetch /api/generate-text {model:'lucy'}, prepared map with tempId + filter x, qty default 50 + 24 lang chips, legacy single collapsed, no TEMPLATES/mock paths left in main flow.
See `03-build-plan.md` for checked Phase 0/P1/P4 items. Evidence: `npm run build` clean, working SettingsBar with sentence form seg, Resources list showing `form` column, one-button demo playing real library audio, proxy implemented.

## Update rules

When work lands: check the matching acceptance item only with evidence → update this snapshot → update `progress-board.html` → log any decision in `05-decisions.md`.

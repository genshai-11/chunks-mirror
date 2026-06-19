# AGENTS.md — Chunks Mirror (Sound)

Operating manual for any agent or human working in this repo. Read this first, then `CONTEXT.md`.

## What we're building

A sound-first MSE attention trainer: hear a short signal → mirror it back. Two builds: a **Sound Engine** (generate/classify/import across 20+ languages) and a **Mirror Room** (one-button G/O/C loop with dynamic settings). Full intent in `context/01-prd.md`. Soul + theory live in Lucy's Share Mind vault (`SECOND-BRAIN/share-mind`): Chunks Soul & Identity, Chunks Core Building Principle, CHUNKS Theory, MSE Alignment.

## Source of truth (read order)

```text
1. AGENTS.md                      (this file — how we work)
2. CONTEXT.md                     (canonical domain language)
3. context/01-prd.md              (product intent + acceptance)
4. context/02-architecture.md     (system + decisions, status=Candidate)
5. context/03-build-plan.md       (phases, tasks, acceptance, gates)
6. context/04-operating-state.md  (current phase, board snapshot, progress)
7. context/05-decisions.md        (ADR log)
8. context/06-runbook.md          (run, 9router setup, deploy, rollback)
9. context/07-ui-system.md        (tokens, components, page registry)
10. context/08-agent-routing.md   (agent roles + skill routing)
```

If two files disagree: **canonical project state wins** (PRD/architecture/decisions/operating-state) over derived views (`progress-board.html`).

## Non-negotiables (the Chunks soul)

- **Ignition first.** One-button loop before admin complexity. First visible win fast.
- **Finishability.** Clean start, clean end, no drift.
- **Sound-first.** Acoustic before grammar/semantics. No STT/translation in the first score.
- **Never generate inside the loop.** Pre-generate/cache into the Resource Bank.
- **One-button-first UI.** Knobs live in Dynamic Settings, not on the Learner Loop.
- **Alive, not heavy.** No option overload, no bureaucratic UI.

## Stack (Candidate — confirmed direction "A, go" 2026-06-16; build-plan gate still applies)

- React + Vite + TypeScript · Tailwind CSS
- Web Audio API + MediaRecorder for playback/capture
- Local-first seed data behind a `StorageAdapter` (JSON + `public/resources/audio/...`), plus Firebase Functions → Cloud Storage for cross-device generated audio
- **9router** for TTS via **same-origin `/api/*` proxy** — `NINEROUTER_KEY` never reaches the browser
- Firebase Hosting at `chunks-mirror.web.app` (preview-first); production gated by Release Control

## File placement rules

```text
context/                Project OS docs (canonical). Do not scatter docs elsewhere.
context/audits/         hygiene/audit notes
context/research/       fresh-doc research (providers, APIs)
src/domain/             pure domain types + loop controller (no IO)
src/adapters/           storage, audio playback, mic capture, provider adapters
src/features/mirror/    Learner Loop Surface (one-button room)
src/features/resources/ Resource Bank Surface
src/features/settings/  Dynamic Settings
src/ui/                 design-system primitives (tokens, Button, etc.)
functions/              Firebase Functions same-origin API (`/api/*`) for 9router + audio storage
public/resources/audio/ seed/pre-generated local audio assets
src/data/resources.json local Resource Bank manifest
```

Before creating a new file: confirm its canonical folder above and whether an existing file should be updated instead. Never duplicate the domain language — link to `CONTEXT.md`.

## Change protocol

When adding/editing behavior after init: identify callers/callees + affected flows → check existing behavior → check if domain language/PRD/architecture/decisions change → update acceptance + verification → if data shape changes, update schema/`CONTEXT.md` → if UI changes, update `context/07-ui-system.md` → update Hermes/operating-state/progress-board → verify with evidence.

## Secrets

Never commit `NINEROUTER_KEY`, Firebase service accounts, or provider keys. Use `.env.local` (gitignored) and the same-origin proxy. Docs use placeholders only.

## Release Control (production)

Commit/tag before deploy → validate preview/canary → keep rollback notes → verify Hosting/Functions restore path. See `context/06-runbook.md`.

## Companion skills

```text
/project-init          this OS (you are here)
/design-taste-frontend Mirror Room + Resource Bank UI (black/white/red Swiss)
/prototype             throwaway UI/logic spikes before committing
/kanban-orchestrator   Hermes board control (canonical task state)
```

## Progress rule

Do not invent progress percentages. Derive them from **checked** checklist items in `context/03-build-plan.md` and `context/04-operating-state.md`, and only check an item when evidence is recorded.

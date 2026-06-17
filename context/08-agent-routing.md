# 08 — Agent Routing · Chunks Mirror (Sound)

How agents/skills divide work. Stack-specific skills must not be forced before stack acceptance.

## Pattern

**Producer–Reviewer with a thin supervisor.** Lucy (or the lead agent) supervises; producers build vertical slices; a reviewer checks against `CONTEXT.md`, `01-prd.md`, and the design-taste rules before a slice is "done."

## Roles

| Role | Does | Reads | Skills |
|---|---|---|---|
| **Supervisor** | Sequences phases, holds gates (stack, release), routes tasks | all `context/*` | project-init, kanban-orchestrator |
| **Domain/Loop builder** | `src/domain/*`, `MirrorLoopController`, adapters | CONTEXT, 02, 03 | — |
| **Sound Engine builder** | `/api/tts`, 9router adapter, generation + import pipeline | CONTEXT, 02, 06 | 9router-tts |
| **UI builder** | Mirror Room, Resource Bank, Settings | CONTEXT, 07 | design-taste-frontend, prototype |
| **Reviewer** | Domain-language drift, silent failures, acceptance evidence | CONTEXT, 01, 05 | pr-review-toolkit:* |

## Routing rules

- **UI / "what should it look like"** → `design-taste-frontend` (+ `prototype` UI branch for options).
- **"Does this loop/state model feel right"** → `prototype` LOGIC branch (terminal spike) before wiring UI.
- **Audio generation / 9router** → 9router-tts skill; always via `/api/*` proxy.
- **Task state** → Hermes via kanban-orchestrator (canonical), mirrored to `04-operating-state.md` + `progress-board.html`.
- **Theory / soul questions** → Lucy's Share Mind vault (`share-mind-obsidian` skill).

## Handoff contract

A slice handoff includes: what changed, which acceptance item(s) it satisfies + evidence, files touched, and any new decision (→ `05-decisions.md`). A slice is **not done** until verification evidence exists and `04-operating-state.md` + the board are updated.

## Dedup rule

Before creating a new agent/skill, check existing `.claude/agents/`, `.claude/skills/`, and this file. Reuse/merge instead of aliasing.

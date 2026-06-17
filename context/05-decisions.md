# 05 — Decisions (ADR log) · Chunks Mirror (Sound)

Append-only. Newest on top. Status: `Accepted` (human-confirmed) · `Candidate` (pending) · `Superseded`.

---

## ADR-0011 — Sentence Form + multi-model library generation
- **Status:** Accepted (2026-06-16)
- **Decision:** Extend the library generator and Dynamic Settings with explicit `form` ("short" / "long") for speech resources. Resource Bank + selection support filtering by it. Generator accepts `--model` (edge-tts default, `el/eleven_multilingual_v2`, `google-tts`, `deepgram/...`) at re-run time.
- **Why:** User request for "div: setting" (câu ngắn – câu dài) + access to premium/other 9router voices without changing the core one-button loop or "never generate inside loop" rule. Small schema addition documented in CONTEXT.
- **Impact:** Updated generator, types, selection, SettingsBar, Bank UI demo, docs, and operating state. Existing short phrases preserved as form=short.

## ADR-0010 — Canonical build home = CHUNKS-MIRROR-SOUND
- **Status:** Accepted (2026-06-16, "A, go")
- **Decision:** Build here; adopt + refresh the existing `../chunks-mirror` docs into this Project OS. Treat `../chunks-mirror` as prior context, not a parallel build.
- **Why:** Lucy selected this folder; the `-SOUND` suffix signals the sound-engine emphasis is now central.

## ADR-0009 — 20+ language Speech Sources via 9router
- **Status:** Accepted (2026-06-16)
- **Decision:** Speech generation must cover **20+ languages** (en, vi, zh, fr, ko, ja, es, de, it, pt, ru, ar, hi, th, id, nl, tr, pl, sv, el, uk, ro, cs, fil). Use `edge-tts` locale voices for breadth (free, no auth) and `el/eleven_multilingual_v2` for premium.
- **Why:** Lucy's explicit requirement — not just VI/EN.

## ADR-0008 — 9router is the TTS backbone, called server-side
- **Status:** Accepted (2026-06-16)
- **Decision:** Use 9router `POST /v1/audio/speech` behind a same-origin `/api/tts` proxy. `NINEROUTER_KEY` never reaches the browser.
- **Why:** Multi-provider, multilingual, avoids CORS/secret leakage.

## ADR-0007 — Theme: black / white / single red accent, Swiss minimal
- **Status:** Accepted (2026-06-16)
- **Decision:** Off-black + white base, one red accent derived from the CHUNKS logo. Swiss/editorial. One accent only (no purple/glow), per design-taste rules.
- **Why:** Logo-driven brand; matches one-button minimalism.

## ADR-0006 — Mirror Score OFF in v1
- **Status:** Accepted (2026-06-16, refines prior "acoustic-only")
- **Decision:** v1 ships with **no scoring**. The loop still emits a `MirrorAttempt` so scoring can drop in later. When enabled, scoring starts **acoustic-only** (no STT/grammar/semantics).
- **Why:** Lucy: "hiện tại tạm không chấm." Keep the loop pure; avoid overpromising an immature score.

## ADR-0005 — Interaction Mode: auto + manual; Timing configurable
- **Status:** Accepted (2026-06-16)
- **Decision:** Room supports `auto` (auto-advance) and `manual` (leader taps next). G/O and C durations configurable, default 3s/3s. Optional ending-sound cue plays after O and before C.
- **Why:** Lucy's dynamic-room requirement for both solo and led sessions.

---

### Adopted from `../chunks-mirror` (2026-06-13), still in force

- **Hybrid Source Strategy** — speech (from text DB) + curated/imported mimicable SFX both enter the bank; generated SFX pre-generated. *(Accepted)*
- **Hybrid Safe approval** — `candidate → license_checked → approved_resource`; only approved play. *(Accepted)*
- **Local Resource Bank + cloud-ready interfaces** — local JSON/audio behind `StorageAdapter`. *(Accepted)*
- **Chunks-Aware Resource schema** — production metadata + Chunks intent fields. *(Accepted, extended with `category`, `provider`, `voiceId`)*
- **Minimal tabs** — `Mirror | Resources | Settings`. *(Accepted)*
- **Chunks App Pattern stack** — React/Vite/TS, Firebase Hosting, `/api/*` proxy. *(Candidate — confirm at build-plan gate)*
- **Firebase Preview-Ready** first target; production requires Release Control. *(Accepted)*

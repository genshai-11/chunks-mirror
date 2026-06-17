# 01 — PRD · Chunks Mirror (Sound)

Status: **Draft v1** (refreshed 2026-06-16). Acceptance items are the basis for progress %.

## Target user

Language learners (and Chunks coaches/leaders running a room) who want to train the **ear and mouth at the level of natural mechanical reflex** — not vocabulary, not grammar. Primary: self-driven learners. Secondary: a leader driving a live group through the loop.

## The painful job

Learners over-process: they filter incoming sound through habit (the **MSE Filter**) before they can reproduce it, so they freeze, distort, or translate instead of mirroring. The job: **hear → drop the filter → copy directly**, repeated enough that copying becomes reflex (the **Acquisition Target**).

## What v1 must do

1. **Run the Mirror Loop** — one button starts `G → O → C` automatically. O plays a Source Signal (~3s) with a visible countdown to 0; C immediately gives the learner the same window (~3s) to copy. (Scoring is **off** in v1.)
2. **Dynamic room setup** above the button:
   - **Interaction Mode**: `auto` (room auto-advances) or `manual` (leader taps "next").
   - **Timing**: configurable G/O time and C time (default 3s / 3s).
   - **Filters**: Sound Category, Language, Level, **Sentence Form** (short/long/all — supports "câu ngắn – câu dài" diversity via library + on-demand generation with any 9router model).
   - **Random Mix** toggle (ignore library order).
   - **Ending-Sound Cue** toggle plays after O and before C starts.
3. **Sound Engine — Resource Bank**:
   - Generate **Speech Sources** from text via **9router** TTS across **20+ languages**, pre-generated into the bank.
   - Generate / pre-generate **Sound Sources** (animal/object/nature/human SFX) via the Text-to-Sound Adapter.
   - **Import** audio (curated or user upload) with license/provenance — always-available fallback.
   - **Classify** every entry by Category + Language + Level + labels (flexible, filterable).
4. **Approval gate** — only `approved_resource` entries play in the Mirror Room; candidates visible only in the Resource Bank.
5. **Persist** resources + audio locally behind a `StorageAdapter`.

## Language Set (v1 target: 24, ≥20 required)

`en` English · `vi` Vietnamese · `zh` Chinese (Mandarin) · `fr` French · `ko` Korean · `ja` Japanese · `es` Spanish · `de` German · `it` Italian · `pt` Portuguese · `ru` Russian · `ar` Arabic · `hi` Hindi · `th` Thai · `id` Indonesian · `nl` Dutch · `tr` Turkish · `pl` Polish · `sv` Swedish · `el` Greek · `uk` Ukrainian · `ro` Romanian · `cs` Czech · `fil` Filipino.

Coverage strategy: `edge-tts` locale voices for breadth (free, no auth); `el/eleven_multilingual_v2` for premium quality where wanted. Provider/voice per language captured in the runbook.

## Out of scope (v1)

- Mirror Score / scoring of any kind (acoustic or MSE) — deferred to v2.
- STT, grammar, translation, semantic correctness.
- Music generation (Music Snippets are **import-first**; gen is a later R&D task).
- Accounts/auth, multi-device sync, cloud DB (local-first; cloud adapters later).
- Production launch (v1 target is Firebase Preview-Ready).

## "Shippable" means

- A learner completes a full **auto-run** loop end-to-end with real audio from the bank.
- A leader can switch to **manual** mode and advance the room by tapping.
- Dynamic Settings visibly change which resources play (category/language/level/mix) and the G/C timing.
- The bank contains real **multi-language** speech generated via 9router plus at least a few imported/generated SFX, all approval-gated.
- App builds locally and has a Firebase Hosting preview path. No production deploy required.

## Constraints

- Budget: prefer free/low-cost providers first (`edge-tts`, `google`); premium (`ElevenLabs`) optional per resource.
- Platform: modern desktop + mobile browser (mic permission required for C).
- Data: local-first; no PII; recordings stay in memory unless explicitly saved.
- Theme: black/white/red Swiss minimal (logo-derived). One accent color.
- Deploy: Release Control mandatory for any production release.

## Acceptance criteria (checklist — drives progress %)

- [ ] One button runs `G → O → C` auto-run with bank audio.
- [ ] O shows a countdown to 0; C window starts automatically after O.
- [ ] Manual mode: leader advances to next item by tap.
- [ ] G/O and C durations configurable; default 3s/3s.
- [ ] Category + Language + Level + Sentence Form (short/long) filters change the playable pool.
- [ ] Random Mix toggle randomizes order.
- [ ] Ending-Sound Cue toggle plays a marker after O and before C starts.
- [ ] 9router TTS generates speech for ≥20 (target 24) languages + multiple Sentence Forms into the bank (via proxy, key server-side; generator supports edge-tts / eleven_multilingual_v2 / google-tts / deepgram etc.).
- [ ] Text-to-Sound Adapter (or import) adds ≥1 non-speech mimicable resource.
- [ ] User can import an audio file; it is trimmed/normalized and stored with provenance.
- [ ] Only `approved_resource` entries appear in the Mirror Room.
- [ ] Resources persist behind `StorageAdapter`; app reloads them.
- [ ] App builds locally; Firebase preview path documented.

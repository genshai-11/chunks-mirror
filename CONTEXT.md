# CONTEXT — Chunks Mirror (Sound)

> Canonical **domain language** for Chunks Mirror. One vocabulary, one source of truth.
> Every agent and human reads this before touching PRD, architecture, or code.
> Adopted + refreshed from `../chunks-mirror` context (2026-06-13) on 2026-06-16, upgraded for the sound-first engine, 20+ languages, 9router TTS, and the black/white/red Swiss theme.

## What this is

Chunks Mirror is a **sound-first MSE attention trainer**. The learner hears a short **Source Signal**, holds attention without filtering it through habitual language/body patterns (the **MSE Filter**), then **mirrors it back**. It trains the ear and mouth at the level of natural mechanical reflex — the **Acquisition Target** — before interpretation.

It lives in the **Sound (S)** corner of Chunks' **MSE** framework (Motion · Sound · Emotion). See `../../../SECOND-BRAIN/share-mind/NOUNS/Concepts/CHUNKS Theory.md`.

```text
G / Generate  →  O / Original Playback  →  C / Copy Capture  →  Mirror Score (off for now)
```

## The two builds

1. **Sound Engine** — generate, classify, and import many kinds of human-mimicable **Source Signals** across **20+ languages**, pre-generated into the **Resource Bank**. Never generate inside the loop.
2. **Mirror Room** — one-button **Auto-Run Loop** with **Dynamic Settings** above it (mode, timing, category, language, level, mix, ending cue).

## Ubiquitous language

### Core loop
- **Chunks Mirror** — a practice platform where learners mirror short sound signals to train attention, presence, and MSE alignment. *Avoid:* pronunciation app, karaoke, language drill.
- **Mirror Loop** — one full cycle: Generate → Original Playback → Copy Capture → Mirror Score.
- **G / Generate** — preparation step that selects or pre-creates the Source Signal and preloads its audio before playback. *Avoid:* live generation during the playback window.
- **O / Original Playback** — learner-facing playback of the Source Signal; the touchpoint to mirror. Default 3s, then countdown to 0.
- **C / Copy Capture** — the learner's timed attempt (default 3s) to reproduce the Source Signal by voice/mimicable sound.
- **Source Signal** — the original sound object: speech, prosody, rhythm, tone, or a non-speech sound a human can imitate.
- **Copy Signal** — the learner-produced sound captured during Copy Capture.
- **Mirror Score** — similarity of Source vs Copy. **Acoustic-only** when enabled; **off in the first build** per current decision.
- **Acquisition Target** — the goal state: natural mechanical reflex of ear and mouth, reached by repetition before analysis.

### Chunks theory terms
- **MSE** — Motion, Sound, Emotion; the triad for evaluating expressive alignment.
- **MSE Filter** — habitual body/language/emotion/interpretation layer that distorts direct perception and imitation. *Avoid:* mistake, accent, personality.
- **Emptiness State** — brief state where the learner drops personal filters enough to listen and copy directly.
- **MSE Focus** — a resource's primary training emphasis: `sound | motion | emotion | mixed` (this product is sound-first).
- **Mirror Goal** — the intended copy target: rhythm, pitch contour, energy, timing, or prosodic shape.

### Sound Engine terms
- **Resource Bank** — pre-generated/imported collection of Source Signals available for instant playback. *Avoid:* generate-on-click library.
- **Sound Category** — the top classification of a Source Signal. MVP set: `speech | music_snippet | sfx_animal | sfx_object | sfx_nature | sfx_human | other`.
- **Speech Source** — a Source Signal from text via TTS, or imported speech. Carries a `language`.
- **Sound Source** — a non-speech but human-mimicable Source Signal (animal call, short motif, effect).
- **Generated Sound Effect** — a Sound Source produced from a text prompt by a text-to-sound model.
- **Music Snippet** — a short musical phrase a human can hum/mimic. MVP: import-first.
- **TTS Adapter** — provider path turning text → Speech Sources. Backed by **9router**.
- **Text-to-Sound Adapter** — provider path turning sound prompts → Generated Sound Effects.
- **9router** — the multi-provider audio gateway. Endpoint `POST $NINEROUTER_URL/v1/audio/speech`. Providers include `edge-tts` (free, no auth, broad multilingual), `el/<model>` (ElevenLabs `eleven_multilingual_v2` premium), `openai`, `google`, `deepgram`. Called **server-side only** via the same-origin proxy.
- **Language Set** — the 20+ supported languages (see PRD). Each Speech Source is generated per language; `eleven_multilingual_v2` auto-detects, `edge-tts` uses locale-specific voices.
- **Sentence Form** — optional classification for Speech Sources: `short` (compact, high-rhythm greetings) or `long` (natural multi-clause sentences). Exposed as a Dynamic Settings filter ("câu ngắn – câu dài") so the Mirror Room can focus practice on specific prosodic lengths. Carried in `form` on the resource and filterable in selection. Generator (`scripts/generate_library.py`) and Resource Bank support producing / importing different forms using any 9router model (edge, eleven_multilingual_v2, google-tts, deepgram, ...).
- **Curated Sound Import** — find, license, download, trim, normalize external mimicable sounds into the bank.
- **User Import** — learner/admin uploads their own audio; trimmed/normalized; always-available fallback when generation is impossible.
- **Resource Approval Status** — lifecycle gate: `candidate → license_checked → approved_resource`. Only **Approved Resources** appear in real learner practice.
- **Chunks-Aware Resource** — a bank entry storing audio metadata + license/provenance + Chunks training intent (MSE focus, category, language, level, mirror goal). See schema below.
- **Storage Adapter** — boundary to read/write resources/recordings/scores; local JSON first, swappable to Firebase/Supabase later.

### Mirror Room / UX terms
- **One-Button Mode** — default interface: one primary action runs the whole loop. *Avoid:* multi-panel control room.
- **Auto-Run Loop** — one tap runs G → O → C (→ Score) without phase-by-phase taps.
- **Interaction Mode** — how the room advances and gates. Four presets:
  - `auto` — one tap runs G→O→C and auto-advances to the next item.
  - `manual` — auto-runs each item, then waits for a tap (Next) between items.
  - `offline` — self-paced: after O the room waits for a tap before recording C ("tap when ready to mirror"), and waits for a tap between items. Gates are configurable.
  - `custom` — fully dynamic: every flow gate (auto-advance, pause-before-mirror) and every ending sound is independently toggleable.
- **Flow Gates** — dynamic flow controls surfaced by `offline`/`custom`: `autoAdvance` (roll into next item vs wait) and `gateBeforeCopy` (wait for a tap before C / Copy Capture).
- **Timing Contract** — defaults O=3s, C=3s; overridable per resource/level and editable in Settings.
- **Countdown Window** — visible timer protecting the rhythm of O and C (counts down to 0).
- **Ending-Sound Cue** — optional short audio markers at loop boundaries: `cueOnListen` (G→O), `cueOnMirror` (O→C, the classic "now mirror" signal), `cueOnEnd` (C→next). `auto`/`manual` expose only the O→C cue; `offline`/`custom` expose all three.
- **Dynamic Settings** — Collapsible Room setup surface (each section hides/expands): interaction mode, flow gates, ending sounds, G/C timing, playback speed, category + language + level + form filters, random mix. Has its own scroll, independent of the page.
- **Random Mix** — play approved resources in random order, ignoring library/lesson order.
- **Learner Loop Surface** — the one-button Mirror screen.
- **Resource Bank Surface** — inspect, preview, filter, generate, import, approve resources.

### Delivery / ops terms
- **Chunks App Pattern** — React/Vite + TypeScript UI, local-first data in MVP, Firebase Hosting target, same-origin `/api/*` proxy for secret-bearing provider calls.
- **Same-Origin Provider Proxy** — `/api/*` backend that calls 9router/text-to-sound without exposing `NINEROUTER_KEY` or hitting CORS/mixed-content.
- **Firebase Preview-Ready** — first delivery target: builds locally + has Hosting preview structure; production waits for loop/resource validation.
- **Release Control** — commit/tag before deploy, preview/canary validation, rollback notes, restore-path verification for Hosting/Functions.

## Chunks-Aware Resource schema

```text
id
category        : speech | music_snippet | sfx_animal | sfx_object | sfx_nature | sfx_human | other
sourceKind      : tts | text_to_sound | imported
audioUrl
textPrompt | soundPrompt
label[]                          # free admin tags (theme, lesson, intent); may include "form:short"
language                         # ISO code; required for speech, optional for sfx
level                            # designed resistance / difficulty
form            : short | long   # (optional) Sentence Form for speech — filterable in Dynamic Settings
durationMs
approvalStatus  : candidate | license_checked | approved_resource
license | provenanceUrl | attribution
provider                         # e.g. edge-tts/en-US-AriaNeural, el/eleven_multilingual_v2, google-tts/vi, deepgram/..., import
voiceId                          # TTS voice or model identifier when applicable
createdAt
mseFocus        : sound | motion | emotion | mixed
resistanceTag
lessonId
mirrorGoal                       # rhythm | pitch | energy | timing | prosody
```

## Relationships
- A **Mirror Loop** contains exactly one G, one O, one C, and one Mirror Score.
- **G / Generate** selects an **Approved Resource** from the **Resource Bank** before O begins. It does **not** call providers inside the loop.
- A **Source Signal** is a **Speech Source** or a **Sound Source**; its **Sound Category** classifies it.
- A **Speech Source** has a `language` from the **Language Set**; the same text may be generated across many languages.
- **Dynamic Settings** filter the playable pool by category + language + level + form (short/long sentence), and choose interaction mode (`auto|manual|offline|custom`) + flow gates + timing + speed + random mix + per-boundary ending sounds.
- A **Curated Sound Import** / **User Import** must carry license/provenance before becoming an Approved Resource.
- **Resource Approval Status** follows `candidate → license_checked → approved_resource`; only Approved Resources reach learner practice.

## Constraints
- **Sound-first.** Score similarity of sound before any grammar/text/semantic correctness. No STT/translation in the first Mirror Score.
- **Never generate inside the 3s loop.** Pre-generate/cache into the bank.
- **One-button-first.** No option overload on the Learner Loop Surface; all knobs live in Dynamic Settings.
- **Theme:** black / white / **single red accent** (from CHUNKS logo), Swiss minimal. See `context/07-ui-system.md`.
- **Release Control** required for any production deploy.

## Flagged terms / open
- **Mirror Score / Mirror Percent** — off for now; when enabled, start as acoustic similarity, name softly ("mirror score") until trustworthy.
- **CVR / OVR** (designed resistance) — keep internal; surface as **Resource Level** in UI.
- **Music Snippet** generation — import-first for MVP; music-gen provider is a later R&D task.

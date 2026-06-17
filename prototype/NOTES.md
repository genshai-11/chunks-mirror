# Prototype notes — Mirror Room

**Throwaway.** Lives here to validate a decision, not to ship. Delete or absorb once answered.

## Question being answered

Does the **one-button G → O → C loop** plus the **dynamic room settings** (auto/manual, G/C timing, category + language + level filters, random mix, ending cue) *feel right* before we commit to the React/Vite build?

## How to run

Open `mirror-room.html` directly in Chrome or Edge. Allow the mic when asked (optional — the visual loop runs without it). Tap the red button.

## What's real vs stand-in

| Real build (target) | Prototype stand-in |
|---|---|
| 9router TTS, 20+ languages, pre-generated bank | browser `speechSynthesis` (whatever languages your OS has installed) |
| Generated/imported SFX in the bank | synthesized tones (meow/woof/chirp/motif) |
| `MirrorLoopController` state machine in TS | inline JS loop |
| Persisted recordings behind StorageAdapter | in-memory Blob, play-back-once |

## Try these

- Flip **Auto ↔ Manual** mid-session (manual = leader taps `Next ▸` or the button to advance).
- Change **O / C seconds** and feel the countdown-to-0 rhythm.
- Filter to one **Language** or **Category**; toggle **Random mix**.
- Toggle **Ending cue** (short beep between items).

## Verdict (fill after playing)

- Loop rhythm: _____
- Auto vs manual: _____
- Which settings matter / are noise: _____
- Timing defaults (3s/3s) right? _____
- → Decisions to fold into `context/05-decisions.md`: _____

# 07 — UI System · Chunks Mirror (Sound)

The product visual language. Read before any UI work; reuse tokens/components; update the registry when you add UI. This is the **product** system — distinct from the Project OS `progress-board.html` style (which stays locked Swiss/editorial).

## Principles

- **Brutalist dark minimal / sound-first.** Matte midnight canvas, crisp metadata layers, no decorative clutter.
- **One-button-only Mirror Room.** The Mirror screen shows one decisive circular play controller; no phrase text, logs, settings, or metadata around it.
- **Black / White / one loud Red.** Exactly one action accent (`#FF453A`). No second decorative accent, no purple/AI-glow.
- **Alive, not heavy.** Motion is limited to the active sound signal: halo during recording and tiny wave rods inside the button.

## Tokens

```css
/* Color — off-black + white + single red accent (from CHUNKS logo) */
--bg:            #070709;   /* matte midnight black */
--bg-elev:       #0C0C0E;   /* deep dark charcoal */
--bg-panel:      #121217;   /* panel charcoal */
--fg:            #FFFFFF;   /* primary text on dark */
--fg-muted:      #8E8E93;   /* metadata */
--line:          #1A1A1E;   /* hairline / dividers */
--line-strong:   #23232C;   /* stronger boundaries */
--accent:        #FF453A;   /* loud action red */
--accent-press:  #D9352D;   /* red active/pressed */
--success:       #10B981;   /* success only */
--on-accent:     #FFFFFF;

/* Light mode (Resource Bank / Settings can run light) */
--bg-light:      #FAFAFA;
--fg-light:      #0A0A0B;
--line-light:    #E4E4E7;

/* Radius — Swiss = restrained */
--r-sm: 6px;  --r-md: 10px;  --r-pill: 999px;

/* Motion */
--ease: cubic-bezier(0.16, 1, 0.3, 1);
--dur:  280ms;
```

> Tailwind: map these to `theme.extend.colors` (`ink`, `paper`, `line`, `accent`). Check `package.json` for the Tailwind major version before using v4-only syntax.

## Type

- **Display / numbers:** `Geist` (or `Satoshi`) — `tracking-tighter`. Countdown + timing use **`Geist Mono`** / `font-mono`. No `Inter`. No serif (this is a technical UI).
- **Headlines:** controlled scale, weight over size — not oversized.
- **Body:** `text-base text-[--fg-muted] leading-relaxed max-w-[60ch]`.

## Layout

- App shell: Mirror Room and Library Setup are separated. Mirror Room has only the top-right section tab and the centered play controller.
- Mirror screen: one giant circular HUD (`w-64 h-64`) centered in `min-h-[100dvh]` (never `h-screen`). No visible current text, logs, settings, or metadata in Mirror Room.
- Library screen: all configuration, generation, library search/filter, staged review, staged-to-library import, and bulk-delete controls live in Library Setup only. Core setup controls must be visible by default; do not hide essential admin actions behind collapsible modules.
- Mobile: single column, `px-4`, asymmetry collapses to stacked.

## Signature component — the Mirror Button

- One large circular/`rounded-[--r-pill]` primary action, centered. Desktop `w-64 h-64`; mobile sizes responsively via `w-[min(72vw,14rem)]` (aspect-square).
- States remain internal: `idle` → `preparing` → `playingOriginal` → `recordingCopy` → `awaitingCopy` → `betweenItems`/`waitingNext`. `awaitingCopy` is the self-paced gate (offline/custom) where the room waits for a tap before recording C; it shows a red record dot + halo invite.
- Tactile: `:active` → `scale-[0.98]`.
- During `recordingCopy` **and** `awaitingCopy`, show CSS-only `ring-pulse-fade` halo (accent).
- During active sound phases, tiny wave rods may appear **inside the button only**.
- No visible phrase text, phase label, logs, or counters outside the button.

## Component registry

| Component | Path | Status |
|---|---|---|
| Tokens / theme | `src/ui/tokens.css` | planned |
| `Button` | `src/ui/Button.tsx` | planned |
| `Tabs` | `src/ui/Tabs.tsx` | planned |
| `Pill` (filter chip) | `src/ui/Pill.tsx` | planned |
| `CountdownRing` | `src/ui/CountdownRing.tsx` | planned |
| `MirrorButton` | `src/features/mirror/MirrorButton.tsx` | planned |
| `SettingsBar` | `src/features/settings/SettingsBar.tsx` | implemented — Library-page control deck; 4 interaction modes (auto/manual/offline/custom), per-mode hint, flow gates + per-boundary cue toggles surfaced for dynamic modes |
| `Accordion` (collapsible setup section) | inline in `src/features/mirror/MirrorPage.tsx` | implemented — hide/expand section with chevron; used for the Mirror Room Dynamic Settings sidebar (Mode, Flow, Ending sounds, Timing, Speed, Filters, Mix) |
| `ResourceTable` | `src/features/resources/ResourceTable.tsx` | planned |
| `LibraryPanel` | `src/features/resources/LibraryPanel.tsx` | implemented — flat visible admin library view with staged-to-library import, search, filters, bulk select/delete |

## Page registry

| Page | Path | Status |
|---|---|---|
| Mirror (Learner Loop) | `src/features/mirror/MirrorPage.tsx` | implemented — one-button loop room with a collapsible Dynamic Settings sidebar (own scroll, accordion sections, hide/expand). Sidebar opens by default on desktop, collapsed on mobile; mobile-tuned button sizing, safe-area padding, and the offline `awaitingCopy` gate |
| Resources (Bank) | `src/features/resources/ResourcesPage.tsx` | planned |
| Current resource bank UI | `LibraryPanel` inside `src/features/resources/LibraryPanel.tsx` | flat visible admin list + search + source/category/language/form filters + staged-to-library import + multi-select bulk delete |
| Settings (Dynamic) | `src/features/settings/SettingsPage.tsx` | planned |

## States to always provide

Loading (skeletons matching layout, not spinners), empty (how to populate the bank), error (inline, e.g. mic denied / generation failed), and tactile feedback on press.

## Forbidden (design-taste)

No emojis in UI. No `Inter`, no serif. No purple/AI-glow, no neon shadows, no pure `#000`. No generic 3-equal-card row. No custom cursors. One accent only.

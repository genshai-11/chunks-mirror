import type { ReactNode } from 'react'
import type { RoomSettings } from '../../domain/types'
import { INTERACTION_MODES, MODE_META, modeIsDynamic, applyMode } from '../../domain/roomModes'

interface Props {
  settings: RoomSettings
  onChange: (next: RoomSettings) => void
  availableLangs: string[]
}

const INPUT = 'w-full rounded-[10px] border border-[--line] bg-[--bg] px-3 py-2 text-sm text-[--fg] outline-none focus:border-[--accent]'
const LABEL = 'font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  )
}

function SegmentButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[8px] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${active ? 'bg-[--accent] text-white' : 'text-[--fg-muted] hover:bg-[--bg-panel] hover:text-white'}`}
    >
      {children}
    </button>
  )
}

export default function SettingsBar({ settings, onChange, availableLangs }: Props) {
  const set = <K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) => onChange({ ...settings, [key]: value })

  return (
    <section className="rounded-[18px] border border-[--line] bg-[--bg-elev]">
      <div className="border-b border-[--line] px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[--accent]">Dynamic Settings</div>
        <div className="mt-1 text-sm text-[--fg-muted]">Controls for the next Mirror Room run. Nothing here changes the one-button rule.</div>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-6">
        <Field label="Mode">
          <div className="grid grid-cols-2 gap-1 rounded-[10px] border border-[--line] bg-[--bg] p-1">
            {INTERACTION_MODES.map((mode) => (
              <SegmentButton key={mode} active={settings.mode === mode} onClick={() => onChange(applyMode(settings, mode))}>
                {MODE_META[mode].label}
              </SegmentButton>
            ))}
          </div>
        </Field>

        <Field label="Timing">
          <div className="grid grid-cols-2 gap-2">
            <input type="number" min={1} max={15} value={settings.oSeconds} onChange={(e) => set('oSeconds', Math.max(1, Math.min(15, Number(e.target.value) || 3)))} className={INPUT} aria-label="Original seconds" />
            <input type="number" min={1} max={15} value={settings.cSeconds} onChange={(e) => set('cSeconds', Math.max(1, Math.min(15, Number(e.target.value) || 3)))} className={INPUT} aria-label="Copy seconds" />
          </div>
        </Field>

        <Field label="Category">
          <select value={settings.category || ''} onChange={(e) => set('category', e.target.value as RoomSettings['category'])} className={INPUT}>
            <option value="">All</option>
            <option value="speech">Speech</option>
            <option value="sfx_animal">Animal sound</option>
            <option value="sfx_object">Object SFX</option>
            <option value="sfx_nature">Nature SFX</option>
            <option value="sfx_human">Human SFX</option>
            <option value="music_snippet">Music</option>
            <option value="other">Other</option>
          </select>
        </Field>

        <Field label="Language">
          <select value={settings.language || ''} onChange={(e) => set('language', e.target.value || '')} className={INPUT}>
            <option value="">All</option>
            {availableLangs.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
          </select>
        </Field>

        <Field label="Level">
          <select value={settings.level ?? ''} onChange={(e) => set('level', e.target.value ? Number(e.target.value) : '')} className={INPUT}>
            <option value="">All</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
          </select>
        </Field>

        <Field label="Form">
          <select value={settings.sentenceForm || 'all'} onChange={(e) => set('sentenceForm', e.target.value as RoomSettings['sentenceForm'])} className={INPUT}>
            <option value="all">All</option>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </Field>
      </div>

      <div className="border-t border-[--line] px-4 py-3">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[--fg-muted]">{MODE_META[settings.mode].hint}</div>
      </div>

      <div className="grid gap-3 border-t border-[--line] px-4 py-3 md:grid-cols-2">
        <Check label="Random mix" checked={settings.randomMix} onChange={(v) => set('randomMix', v)} />
        {modeIsDynamic(settings.mode) ? (
          <>
            <Check label="Auto-advance" checked={settings.autoAdvance} onChange={(v) => set('autoAdvance', v)} />
            <Check label="Pause before mirror" checked={settings.gateBeforeCopy} onChange={(v) => set('gateBeforeCopy', v)} />
            <Check label="Cue · listen (G→O)" checked={settings.cueOnListen} onChange={(v) => set('cueOnListen', v)} />
            <Check label="Cue · mirror (O→C)" checked={settings.cueOnMirror} onChange={(v) => set('cueOnMirror', v)} />
            <Check label="Cue · end (C→next)" checked={settings.cueOnEnd} onChange={(v) => set('cueOnEnd', v)} />
          </>
        ) : (
          <Check label="Ending cue" checked={settings.cueOnMirror} onChange={(v) => set('cueOnMirror', v)} />
        )}
      </div>
    </section>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 rounded-[10px] border border-[--line] bg-[--bg] px-3 py-2 text-sm text-[--fg]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
      {label}
    </label>
  )
}

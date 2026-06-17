import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChunksAwareResource, RoomSettings } from '../../domain/types'
import { MirrorLoopController, type LoopPhase } from '../../domain/mirrorLoop'
import { BrowserAudioPlaybackAdapter } from '../../adapters/audioPlayback'
import { BrowserMicRecordingAdapter } from '../../adapters/micCapture'
import { playAudioCue } from '../../adapters/audioCue'

interface MirrorPageProps {
  settings: RoomSettings
  pool: ChunksAwareResource[]
  onLog?: (msg: string) => void
  onSettingsChange: (next: RoomSettings) => void
  availableLangs: string[]
}

const CUE_URL = '/resources/audio/sfx/universfield-clear-bell-chime-487898.mp3'

const CAT_CHIPS: Array<{ value: RoomSettings['category']; label: string }> = [
  { value: '', label: 'All' },
  { value: 'speech', label: 'Speech' },
  { value: 'sfx_animal', label: 'Animal' },
  { value: 'sfx_object', label: 'Object' },
  { value: 'sfx_nature', label: 'Nature' },
  { value: 'sfx_human', label: 'Human' },
  { value: 'music_snippet', label: 'Music' },
]

export default function MirrorPage({ settings, pool, onLog, onSettingsChange, availableLangs }: MirrorPageProps) {
  const [phase, setPhase] = useState<LoopPhase>('idle')
  const [current, setCurrent] = useState<ChunksAwareResource | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [countdownPhase, setCountdownPhase] = useState<'O' | 'C' | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  const playbackRef = useRef(new BrowserAudioPlaybackAdapter())
  const micRef = useRef(new BrowserMicRecordingAdapter())
  const controllerRef = useRef<MirrorLoopController | null>(null)
  const copyPreviewUrlRef = useRef<string | null>(null)

  const showLog = useCallback((msg: string) => onLog?.(msg), [onLog])

  const retainCopyPreview = useCallback((blob?: Blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    if (copyPreviewUrlRef.current) URL.revokeObjectURL(copyPreviewUrlRef.current)
    copyPreviewUrlRef.current = url
  }, [])

  useEffect(() => {
    const cue = () => (settings.endingCue ? playAudioCue(CUE_URL) : Promise.resolve())
    const controller = new MirrorLoopController({
      playback: playbackRef.current,
      mic: micRef.current,
      getSettings: () => settings,
      getPool: () => pool,
      onPhaseChange: (p) => setPhase(p),
      onCurrentItemChange: (item) => setCurrent(item),
      onLog: showLog,
      onAttempt: (a) => retainCopyPreview(a.copyBlob),
      onCountdown: (remaining, p) => {
        setCountdown(remaining)
        setCountdownPhase(p)
      },
      playEndingCue: cue,
      playAfterCopyCue: cue,
    })
    controllerRef.current = controller
    setPhase('idle')
    setCurrent(null)
    return () => { controller.stop() }
  }, [pool, retainCopyPreview, settings, showLog])

  useEffect(() => () => {
    if (copyPreviewUrlRef.current) {
      URL.revokeObjectURL(copyPreviewUrlRef.current)
      copyPreviewUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    if (phase === 'idle' || phase === 'waitingNext' || phase === 'preparing' || phase === 'betweenItems') {
      setCountdown(null)
      setCountdownPhase(null)
    }
  }, [phase])

  const isAuto = settings.mode === 'auto'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = controllerRef.current
      if (!ctrl) return
      const waiting = !isAuto && (phase === 'waitingNext' || phase === 'betweenItems')
      if (waiting && (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'n')) {
        e.preventDefault()
        ctrl.next()
      }
      if (e.key === 'Escape' && phase !== 'idle') {
        e.preventDefault()
        ctrl.stop()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, isAuto])

  const handleButton = () => {
    const ctrl = controllerRef.current
    if (!ctrl) return
    if (phase === 'idle' || phase === 'waitingNext') ctrl.start()
    else if (phase === 'betweenItems') ctrl.next()
    else ctrl.stop()
  }

  const set = <K extends keyof RoomSettings>(key: K, val: RoomSettings[K]) =>
    onSettingsChange({ ...settings, [key]: val })

  const isActive = phase !== 'idle' && phase !== 'waitingNext'
  const isListening = phase === 'playingOriginal'
  const isRecording = phase === 'recordingCopy'
  const showWave = isListening || isRecording

  const phaseLabel = isListening ? 'O · LISTEN'
    : isRecording ? 'C · MIRROR'
    : phase === 'preparing' ? '···'
    : phase === 'betweenItems' ? 'NEXT'
    : phase === 'waitingNext' ? 'READY'
    : ''

  const phaseAccent = isRecording ? 'text-[--accent]' : isListening ? 'text-[--fg]' : 'text-[--fg-muted]'

  return (
    <main className="flex min-h-[100dvh] bg-[--bg] text-[--fg]">
      {/* ─── Training area ──────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4">
          <span className="font-mono text-sm font-black uppercase tracking-[0.18em] text-[--accent]">
            CHUNKS MIRROR
          </span>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[--fg-muted]">
              {pool.length} in pool
            </span>
            {/* settings toggle — visible when panel is closed */}
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              aria-label="Open settings"
              className={`flex h-8 w-8 items-center justify-center rounded-full border border-[--line] text-[--fg-muted] hover:border-[--accent] hover:text-[--fg] ${panelOpen ? 'lg:hidden' : ''}`}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.4" />
                <path d="M6.5 1v1.5M6.5 10.5V12M1 6.5h1.5M10.5 6.5H12M2.4 2.4l1.1 1.1M9.5 9.5l1.1 1.1M2.4 10.6l1.1-1.1M9.5 3.5l1.1-1.1" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
        </div>

        {/* Phase label */}
        <div className={`font-mono text-[10px] uppercase tracking-[0.32em] transition-colors duration-200 ${phaseAccent}`} style={{ minHeight: '1em' }}>
          {phaseLabel}
        </div>

        {/* Main button */}
        <button
          type="button"
          onClick={handleButton}
          aria-label={phase === 'idle' || phase === 'waitingNext' ? 'Start' : 'Stop'}
          className={[
            'group relative flex h-56 w-56 items-center justify-center rounded-full border transition-all duration-300 active:scale-[0.975]',
            isRecording
              ? 'border-[--accent] bg-[--accent]/[0.08] shadow-[0_0_0_1px_rgba(255,69,58,0.2),0_32px_80px_-40px_rgba(255,69,58,0.7)]'
              : isActive
              ? 'border-[--fg]/15 bg-[--bg-elev] shadow-[0_32px_80px_-40px_rgba(255,255,255,0.12)]'
              : 'border-[--line-strong] bg-[--bg-elev] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_32px_100px_-60px_rgba(0,0,0,0.9)] hover:border-[--accent]',
          ].join(' ')}
        >
          {/* recording pulse ring */}
          {isRecording && (
            <span className="pointer-events-none absolute inset-[-20px] animate-ring-pulse-fade rounded-full border border-[--accent]" />
          )}
          {/* inner ring */}
          <span className="pointer-events-none absolute inset-7 rounded-full border border-white/[0.05]" />

          {/* content */}
          {countdown !== null && countdownPhase ? (
            <span className={`relative font-mono text-7xl font-black tabular-nums leading-none ${countdownPhase === 'C' ? 'text-[--accent]' : 'text-[--fg]'}`}>
              {countdown}
            </span>
          ) : showWave ? (
            <span className="relative flex h-12 items-center gap-[5px]" aria-hidden="true">
              <span className="wave-bar wave-bar-1" />
              <span className="wave-bar wave-bar-2" />
              <span className="wave-bar wave-bar-3" />
              <span className="wave-bar wave-bar-4" />
              <span className="wave-bar wave-bar-5" />
            </span>
          ) : isActive ? (
            <span className="relative h-9 w-9 rounded-[7px] bg-white" aria-hidden="true" />
          ) : (
            <svg className="relative ml-2 h-14 w-14" viewBox="0 0 80 80" fill="none" aria-hidden="true">
              <path d="M25 14L64 40L25 66V14Z" fill="currentColor" />
            </svg>
          )}
        </button>

        {/* Current item */}
        <div className="flex min-h-[5rem] max-w-sm flex-col items-center gap-2 text-center">
          {current ? (
            <>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[--fg-muted]">
                {[current.language?.toUpperCase(), `L${current.level}`, current.form].filter(Boolean).join(' · ')}
              </div>
              <p className="text-xl italic leading-relaxed text-[--fg]/80">
                &ldquo;{current.textPrompt || current.soundPrompt || '…'}&rdquo;
              </p>
            </>
          ) : (
            <p className="text-sm text-[--fg-muted]">
              {pool.length === 0
                ? 'No resources in pool — add audio in Library Setup.'
                : 'Press play to begin.'}
            </p>
          )}
        </div>

        {/* Manual mode hint */}
        {phase === 'waitingNext' && (
          <div className="absolute bottom-6 font-mono text-[9px] uppercase tracking-[0.22em] text-[--fg-muted]">
            SPACE / → next · ESC stop
          </div>
        )}
      </div>

      {/* ─── Settings sidebar ────────────────────────────────────── */}
      {panelOpen && (
        <div
          onClick={() => setPanelOpen(false)}
          className="fixed inset-0 z-10 bg-black/60 lg:hidden"
        />
      )}

      {/* Collapse tab — always visible on desktop when panel is closed */}
      {!panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="Open setup panel"
          className="hidden lg:flex items-center gap-1.5 self-center rounded-l-[8px] border border-r-0 border-[--line] bg-[--bg-elev] px-2 py-3 text-[--fg-muted] hover:text-[--fg] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-mono text-[8px] uppercase tracking-[0.18em]" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Setup</span>
        </button>
      )}

      <aside
        className={[
          'fixed inset-y-0 right-0 z-20 flex w-[268px] flex-col border-l border-[--line] bg-[--bg-elev] transition-all duration-200',
          panelOpen ? 'translate-x-0 lg:relative lg:inset-auto' : 'translate-x-full lg:translate-x-full lg:w-0',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-[--line] px-4 py-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[--accent]">Setup</span>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[--line] text-[--fg-muted] hover:text-[--fg]"
            aria-label="Hide setup panel"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1 4.5h7M5 1.5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">

          {/* Mode */}
          <SideSection label="Mode">
            <div className="grid grid-cols-2 gap-1 rounded-[8px] border border-[--line] bg-[--bg] p-0.5">
              {(['auto', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set('mode', m)}
                  className={`rounded-[6px] py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors ${settings.mode === m ? 'bg-[--accent] text-white' : 'text-[--fg-muted] hover:text-[--fg]'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </SideSection>

          {/* Timing */}
          <SideSection label="Timing">
            <div className="grid grid-cols-2 gap-2">
              <TimingControl label="Listen (O)" value={settings.oSeconds} onChange={(v) => set('oSeconds', v)} />
              <TimingControl label="Mirror (C)" value={settings.cSeconds} onChange={(v) => set('cSeconds', v)} />
            </div>
          </SideSection>

          {/* Category */}
          <SideSection label="Category">
            <div className="flex flex-wrap gap-1.5">
              {CAT_CHIPS.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => set('category', opt.value)}
                  className={`rounded-[999px] border px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] transition-all ${
                    (settings.category ?? '') === (opt.value ?? '')
                      ? 'border-[--accent] bg-[--accent] text-white'
                      : 'border-[--line] text-[--fg-muted] hover:border-[--fg]/30 hover:text-[--fg]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </SideSection>

          {/* Language */}
          <SideSection label="Language">
            <select
              value={settings.language ?? ''}
              onChange={(e) => set('language', e.target.value)}
              className="w-full rounded-[7px] border border-[--line] bg-[--bg] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[--fg] outline-none focus:border-[--accent]"
            >
              <option value="">All languages</option>
              {availableLangs.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>
          </SideSection>

          {/* Level */}
          <SideSection label="Level">
            <div className="flex gap-1.5">
              {([['', 'All'], ['1', 'L1'], ['2', 'L2'], ['3', 'L3']] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set('level', val === '' ? '' : Number(val))}
                  className={`flex-1 rounded-[7px] border py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] transition-all ${
                    String(settings.level ?? '') === val
                      ? 'border-[--accent] bg-[--accent] text-white'
                      : 'border-[--line] text-[--fg-muted] hover:text-[--fg]'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </SideSection>

          {/* Form */}
          <SideSection label="Form">
            <div className="flex gap-1.5">
              {(['all', 'short', 'medium', 'long'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set('sentenceForm', f)}
                  className={`flex-1 rounded-[7px] border py-1.5 font-mono text-[8px] uppercase tracking-[0.08em] transition-all ${
                    (settings.sentenceForm ?? 'all') === f
                      ? 'border-[--accent] bg-[--accent] text-white'
                      : 'border-[--line] text-[--fg-muted] hover:text-[--fg]'
                  }`}
                >
                  {f === 'all' ? 'All' : f.slice(0, 3)}
                </button>
              ))}
            </div>
          </SideSection>

          {/* Toggles */}
          <div className="mt-auto space-y-2.5 border-t border-[--line] pt-4">
            <ToggleRow
              label="Random mix"
              checked={settings.randomMix}
              onChange={(v) => set('randomMix', v)}
            />
            <ToggleRow
              label="Transition cue"
              checked={settings.endingCue}
              onChange={(v) => set('endingCue', v)}
            />
          </div>

          {/* Pool pill */}
          <div className="rounded-[10px] border border-[--line] bg-[--bg] px-4 py-3">
            <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-[--fg-muted]">Pool</div>
            <div className="mt-0.5 font-mono text-3xl font-black tabular-nums text-[--fg]">{pool.length}</div>
            <div className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-[--fg-muted]">resources available</div>
          </div>

        </div>
      </aside>
    </main>
  )
}

function SideSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-[--fg-muted]">{label}</div>
      {children}
    </div>
  )
}

function TimingControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[7px] uppercase tracking-[0.1em] text-[--fg-muted]/60">{label}</div>
      <div className="flex items-center gap-1 rounded-[7px] border border-[--line] bg-[--bg] px-2 py-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          className="font-mono text-base leading-none text-[--fg-muted] hover:text-[--fg]"
        >−</button>
        <span className="flex-1 text-center font-mono text-sm tabular-nums text-[--fg]">{value}s</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(15, value + 1))}
          className="font-mono text-base leading-none text-[--fg-muted] hover:text-[--fg]"
        >+</button>
      </div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--accent)' }}
      />
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[--fg-muted]">{label}</span>
    </label>
  )
}

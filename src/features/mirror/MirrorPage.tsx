import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChunksAwareResource, RoomSettings } from '../../domain/types'
import { MirrorLoopController, type LoopPhase } from '../../domain/mirrorLoop'
import { langName } from '../../domain/languages'
import { INTERACTION_MODES, MODE_META, modeIsDynamic, applyMode } from '../../domain/roomModes'
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

type SectionKey = 'mode' | 'flow' | 'cues' | 'timing' | 'speed' | 'filters' | 'mix'

export default function MirrorPage({ settings, pool, onLog, onSettingsChange, availableLangs }: MirrorPageProps) {
  const [phase, setPhase] = useState<LoopPhase>('idle')
  const [current, setCurrent] = useState<ChunksAwareResource | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [countdownPhase, setCountdownPhase] = useState<'O' | 'C' | null>(null)
  const [panelOpen, setPanelOpen] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024
  )
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    mode: true,
    flow: true,
    cues: true,
    timing: true,
    speed: false,
    filters: false,
    mix: true,
  })

  const toggleSection = (key: SectionKey) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))

  const playbackRef = useRef(new BrowserAudioPlaybackAdapter())
  const micRef = useRef(new BrowserMicRecordingAdapter())
  const controllerRef = useRef<MirrorLoopController | null>(null)
  const copyPreviewUrlRef = useRef<string | null>(null)

  // Live refs so the controller reads current settings/pool without being recreated.
  // Recreating it would reset the loop to idle — fatal for the dynamic offline/custom
  // modes, which are designed to be reconfigured mid-session.
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const poolRef = useRef(pool)
  poolRef.current = pool

  const showLog = useCallback((msg: string) => onLog?.(msg), [onLog])

  const retainCopyPreview = useCallback((blob?: Blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    if (copyPreviewUrlRef.current) URL.revokeObjectURL(copyPreviewUrlRef.current)
    copyPreviewUrlRef.current = url
  }, [])

  useEffect(() => {
    const cue = () => playAudioCue(CUE_URL)
    const controller = new MirrorLoopController({
      playback: playbackRef.current,
      mic: micRef.current,
      getSettings: () => settingsRef.current,
      getPool: () => poolRef.current,
      onPhaseChange: (p) => setPhase(p),
      onCurrentItemChange: (item) => setCurrent(item),
      onLog: showLog,
      onAttempt: (a) => retainCopyPreview(a.copyBlob),
      onCountdown: (remaining, p) => {
        setCountdown(remaining)
        setCountdownPhase(p)
      },
      playListenCue: cue,
      playEndingCue: cue,
      playAfterCopyCue: cue,
    })
    controllerRef.current = controller
    setPhase('idle')
    setCurrent(null)
    return () => { controller.stop() }
    // Created once: settings/pool are read live via refs so toggling them never resets the loop.
  }, [retainCopyPreview, showLog])

  useEffect(() => () => {
    if (copyPreviewUrlRef.current) {
      URL.revokeObjectURL(copyPreviewUrlRef.current)
      copyPreviewUrlRef.current = null
    }
  }, [])

  useEffect(() => {
    if (phase === 'idle' || phase === 'waitingNext' || phase === 'preparing' || phase === 'betweenItems' || phase === 'awaitingCopy') {
      setCountdown(null)
      setCountdownPhase(null)
    }
  }, [phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = controllerRef.current
      if (!ctrl) return
      const advanceKey = e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'n'
      if (phase === 'awaitingCopy' && advanceKey) {
        e.preventDefault()
        ctrl.beginCopy()
        return
      }
      if ((phase === 'waitingNext' || phase === 'betweenItems') && advanceKey) {
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
  }, [phase])

  const handleButton = () => {
    const ctrl = controllerRef.current
    if (!ctrl) return
    if (phase === 'idle') ctrl.start()
    else if (phase === 'awaitingCopy') ctrl.beginCopy()
    else if (phase === 'waitingNext' || phase === 'betweenItems') ctrl.next() // running & waiting → advance
    else ctrl.stop()
  }

  const set = <K extends keyof RoomSettings>(key: K, val: RoomSettings[K]) =>
    onSettingsChange({ ...settings, [key]: val })

  const isListening = phase === 'playingOriginal'
  const isRecording = phase === 'recordingCopy'
  const isAwaitingCopy = phase === 'awaitingCopy'
  const isActive = phase !== 'idle' && phase !== 'waitingNext' && phase !== 'awaitingCopy'
  const showWave = isListening || isRecording

  const phaseLabel = isListening ? 'O · LISTEN'
    : isRecording ? 'C · MIRROR'
    : isAwaitingCopy ? 'C · TAP TO MIRROR'
    : phase === 'preparing' ? '···'
    : phase === 'betweenItems' ? 'NEXT'
    : phase === 'waitingNext' ? 'READY'
    : ''

  const phaseAccent = isRecording || isAwaitingCopy ? 'text-[--accent]' : isListening ? 'text-[--fg]' : 'text-[--fg-muted]'
  const dynamic = modeIsDynamic(settings.mode)

  return (
    <main className="flex min-h-[100dvh] bg-[--bg] text-[--fg]">
      {/* ─── Training area ──────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-5 py-20 sm:gap-10 sm:px-6 sm:py-16">

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.9rem,env(safe-area-inset-top))] pb-3 sm:px-5 sm:py-4">
          <span className="font-mono text-xs font-black uppercase tracking-[0.18em] text-[--accent] sm:text-sm">
            CHUNKS MIRROR
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-[--fg-muted] sm:inline">
              {pool.length} in pool
            </span>
            {/* settings toggle */}
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              aria-label="Open settings"
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-[--line] text-[--fg-muted] hover:border-[--accent] hover:text-[--fg] ${panelOpen ? 'lg:hidden' : ''}`}
            >
              <svg width="14" height="14" viewBox="0 0 13 13" fill="none">
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
          aria-label={phase === 'idle' || phase === 'waitingNext' ? 'Start' : isAwaitingCopy ? 'Start mirror' : 'Stop'}
          className={[
            'group relative flex aspect-square w-[min(72vw,14rem)] max-w-[14rem] items-center justify-center rounded-full border transition-all duration-300 active:scale-[0.975]',
            isRecording || isAwaitingCopy
              ? 'border-[--accent] bg-[--accent]/[0.08] shadow-[0_0_0_1px_rgba(255,69,58,0.2),0_32px_80px_-40px_rgba(255,69,58,0.7)]'
              : isActive
              ? 'border-[--fg]/15 bg-[--bg-elev] shadow-[0_32px_80px_-40px_rgba(255,255,255,0.12)]'
              : 'border-[--line-strong] bg-[--bg-elev] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_32px_100px_-60px_rgba(0,0,0,0.9)] hover:border-[--accent]',
          ].join(' ')}
        >
          {/* recording / ready pulse ring */}
          {(isRecording || isAwaitingCopy) && (
            <span className="pointer-events-none absolute inset-[-20px] animate-ring-pulse-fade rounded-full border border-[--accent]" />
          )}
          {/* inner ring */}
          <span className="pointer-events-none absolute inset-7 rounded-full border border-white/[0.05]" />

          {/* content */}
          {countdown !== null && countdownPhase ? (
            <span className={`relative font-mono text-7xl font-black tabular-nums leading-none ${countdownPhase === 'C' ? 'text-[--accent]' : 'text-[--fg]'}`}>
              {countdown}
            </span>
          ) : isAwaitingCopy ? (
            <span className="relative h-12 w-12 rounded-full bg-[--accent]" aria-hidden="true" />
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
        <div className="flex min-h-[5rem] max-w-sm flex-col items-center gap-2 px-2 text-center">
          {current ? (
            <>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[--fg-muted]">
                {[current.language?.toUpperCase(), `L${current.level}`, current.form].filter(Boolean).join(' · ')}
              </div>
              <p className="text-lg italic leading-relaxed text-[--fg]/80 sm:text-xl">
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

        {/* Self-paced / manual hint */}
        {(phase === 'waitingNext' || isAwaitingCopy) && (
          <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] font-mono text-[9px] uppercase tracking-[0.22em] text-[--fg-muted]">
            {isAwaitingCopy ? 'TAP / SPACE to mirror · ESC stop' : 'SPACE / → next · ESC stop'}
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

      {/* Collapse tab — visible on desktop when panel is closed */}
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
          'fixed inset-y-0 right-0 z-20 flex w-[86vw] max-w-[340px] flex-col border-l border-[--line] bg-[--bg-elev] transition-transform duration-200 sm:w-[300px] lg:w-[280px]',
          panelOpen ? 'translate-x-0 lg:relative lg:inset-auto lg:translate-x-0' : 'translate-x-full lg:translate-x-full lg:w-0 lg:border-l-0',
        ].join(' ')}
      >
        {/* Sticky header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[--line] bg-[--bg-elev] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[--accent]">Dynamic Settings</div>
            <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[--fg-muted]">{MODE_META[settings.mode].label} · {pool.length} in pool</div>
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[--line] text-[--fg-muted] hover:text-[--fg]"
            aria-label="Hide setup panel"
          >
            <svg width="10" height="10" viewBox="0 0 9 9" fill="none">
              <path d="M1 4.5h7M5 1.5l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Own scroll area — independent of the page */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="flex flex-col gap-2">

            {/* Mode */}
            <Accordion label="Mode" open={openSections.mode} onToggle={() => toggleSection('mode')}>
              <div className="grid grid-cols-2 gap-1.5">
                {INTERACTION_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onSettingsChange(applyMode(settings, m))}
                    className={`rounded-[7px] border py-2 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors ${
                      settings.mode === m
                        ? 'border-[--accent] bg-[--accent] text-white'
                        : 'border-[--line] text-[--fg-muted] hover:border-[--fg]/30 hover:text-[--fg]'
                    }`}
                  >
                    {MODE_META[m].label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-[--fg-muted]">{MODE_META[settings.mode].hint}</p>
            </Accordion>

            {/* Flow — dynamic modes only */}
            {dynamic && (
              <Accordion label="Flow" open={openSections.flow} onToggle={() => toggleSection('flow')}>
                <div className="space-y-2.5">
                  <ToggleRow
                    label="Auto-advance"
                    hint="Roll into the next item automatically"
                    checked={settings.autoAdvance}
                    onChange={(v) => set('autoAdvance', v)}
                  />
                  <ToggleRow
                    label="Pause before mirror"
                    hint="Wait for a tap before recording C"
                    checked={settings.gateBeforeCopy}
                    onChange={(v) => set('gateBeforeCopy', v)}
                  />
                </div>
              </Accordion>
            )}

            {/* Ending sounds */}
            <Accordion label="Ending sounds" open={openSections.cues} onToggle={() => toggleSection('cues')}>
              {dynamic ? (
                <div className="space-y-2.5">
                  <ToggleRow label="On listen (G→O)" hint="Cue when playback starts" checked={settings.cueOnListen} onChange={(v) => set('cueOnListen', v)} />
                  <ToggleRow label="On mirror (O→C)" hint="Cue when recording starts" checked={settings.cueOnMirror} onChange={(v) => set('cueOnMirror', v)} />
                  <ToggleRow label="On end (C→next)" hint="Cue when the item finishes" checked={settings.cueOnEnd} onChange={(v) => set('cueOnEnd', v)} />
                </div>
              ) : (
                <ToggleRow label="Transition cue" hint="Bell between listen and mirror" checked={settings.cueOnMirror} onChange={(v) => set('cueOnMirror', v)} />
              )}
            </Accordion>

            {/* Timing */}
            <Accordion label="Timing" open={openSections.timing} onToggle={() => toggleSection('timing')}>
              <div className="grid grid-cols-2 gap-2">
                <TimingControl label="Listen (O)" value={settings.oSeconds} onChange={(v) => set('oSeconds', v)} />
                <TimingControl label="Mirror (C)" value={settings.cSeconds} onChange={(v) => set('cSeconds', v)} />
              </div>
            </Accordion>

            {/* Speed */}
            <Accordion label="Speed" open={openSections.speed} onToggle={() => toggleSection('speed')}>
              <div className="flex items-center gap-1 rounded-[7px] border border-[--line] bg-[--bg] px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => set('playbackRate', Math.max(0.5, Math.round((settings.playbackRate ?? 1) * 10 - 1) / 10))}
                  className="flex h-7 w-7 items-center justify-center font-mono text-base leading-none text-[--fg-muted] hover:text-[--fg]"
                >−</button>
                <span className="flex-1 text-center font-mono text-sm tabular-nums text-[--fg]">
                  {(settings.playbackRate ?? 1).toFixed(1)}×
                </span>
                <button
                  type="button"
                  onClick={() => set('playbackRate', Math.min(2, Math.round((settings.playbackRate ?? 1) * 10 + 1) / 10))}
                  className="flex h-7 w-7 items-center justify-center font-mono text-base leading-none text-[--fg-muted] hover:text-[--fg]"
                >+</button>
              </div>
              <div className="mt-2 flex justify-between gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => set('playbackRate', r)}
                    className={`flex-1 rounded-[6px] border py-1.5 font-mono text-[8px] tabular-nums transition-all ${
                      (settings.playbackRate ?? 1) === r
                        ? 'border-[--accent] bg-[--accent] text-white'
                        : 'border-[--line] text-[--fg-muted] hover:text-[--fg]'
                    }`}
                  >
                    {r}×
                  </button>
                ))}
              </div>
            </Accordion>

            {/* Filters */}
            <Accordion label="Filters" open={openSections.filters} onToggle={() => toggleSection('filters')}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <SubLabel>Category</SubLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {CAT_CHIPS.map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => set('category', opt.value)}
                        className={`rounded-[999px] border px-2.5 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] transition-all ${
                          (settings.category ?? '') === (opt.value ?? '')
                            ? 'border-[--accent] bg-[--accent] text-white'
                            : 'border-[--line] text-[--fg-muted] hover:border-[--fg]/30 hover:text-[--fg]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <SubLabel>Language</SubLabel>
                  <select
                    value={settings.language ?? ''}
                    onChange={(e) => set('language', e.target.value)}
                    className="w-full rounded-[7px] border border-[--line] bg-[--bg] px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[--fg] outline-none focus:border-[--accent]"
                  >
                    <option value="">All languages</option>
                    {availableLangs.map((lang) => (
                      <option key={lang} value={lang}>{langName(lang)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <SubLabel>Level</SubLabel>
                  <div className="flex gap-1.5">
                    {([['', 'All'], ['1', 'L1'], ['2', 'L2'], ['3', 'L3']] as const).map(([val, lbl]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => set('level', val === '' ? '' : Number(val))}
                        className={`flex-1 rounded-[7px] border py-2 font-mono text-[9px] uppercase tracking-[0.1em] transition-all ${
                          String(settings.level ?? '') === val
                            ? 'border-[--accent] bg-[--accent] text-white'
                            : 'border-[--line] text-[--fg-muted] hover:text-[--fg]'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <SubLabel>Form</SubLabel>
                  <div className="flex gap-1.5">
                    {(['all', 'short', 'medium', 'long'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => set('sentenceForm', f)}
                        className={`flex-1 rounded-[7px] border py-2 font-mono text-[8px] uppercase tracking-[0.08em] transition-all ${
                          (settings.sentenceForm ?? 'all') === f
                            ? 'border-[--accent] bg-[--accent] text-white'
                            : 'border-[--line] text-[--fg-muted] hover:text-[--fg]'
                        }`}
                      >
                        {f === 'all' ? 'All' : f.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Accordion>

            {/* Mix */}
            <Accordion label="Mix" open={openSections.mix} onToggle={() => toggleSection('mix')}>
              <ToggleRow label="Random mix" hint="Shuffle the play order" checked={settings.randomMix} onChange={(v) => set('randomMix', v)} />
              <div className="mt-3 rounded-[10px] border border-[--line] bg-[--bg] px-4 py-3">
                <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-[--fg-muted]">Pool</div>
                <div className="mt-0.5 font-mono text-3xl font-black tabular-nums text-[--fg]">{pool.length}</div>
                <div className="mt-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-[--fg-muted]">resources available</div>
              </div>
            </Accordion>

          </div>
        </div>
      </aside>
    </main>
  )
}

function Accordion({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-[--line] bg-[--bg]/40">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left"
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[--fg-muted]">{label}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`text-[--fg-muted] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M2 3.5L5 6.5l3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </section>
  )
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[7px] uppercase tracking-[0.16em] text-[--fg-muted]/70">{children}</div>
}

function TimingControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[7px] uppercase tracking-[0.1em] text-[--fg-muted]/60">{label}</div>
      <div className="flex items-center gap-1 rounded-[7px] border border-[--line] bg-[--bg] px-2 py-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          className="flex h-7 w-7 items-center justify-center font-mono text-base leading-none text-[--fg-muted] hover:text-[--fg]"
        >−</button>
        <span className="flex-1 text-center font-mono text-sm tabular-nums text-[--fg]">{value}s</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(15, value + 1))}
          className="flex h-7 w-7 items-center justify-center font-mono text-base leading-none text-[--fg-muted] hover:text-[--fg]"
        >+</button>
      </div>
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ accentColor: 'var(--accent)' }}
      />
      <span className="flex flex-col">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[--fg]">{label}</span>
        {hint && <span className="mt-0.5 text-[10px] leading-snug text-[--fg-muted]">{hint}</span>}
      </span>
    </label>
  )
}

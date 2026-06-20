import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChunksAwareResource, MirrorAttempt, RoomSettings } from '../../domain/types'
import { MirrorLoopController, type LoopPhase } from '../../domain/mirrorLoop'
import { langName } from '../../domain/languages'
import { INTERACTION_MODES, MODE_META, modeIsDynamic, applyMode } from '../../domain/roomModes'
import { ERE_PART_OPTIONS, ERE_TOPIC_OPTIONS } from '../../domain/ere'
import { BrowserAudioPlaybackAdapter } from '../../adapters/audioPlayback'
import { BrowserMicRecordingAdapter } from '../../adapters/micCapture'
import { playAudioCue } from '../../adapters/audioCue'
import { evaluateEreAttempt, type EreEvaluationResult } from '../../adapters/ereEvaluation'

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
  { value: 'ere', label: 'ERE' },
]

type SectionKey = 'mode' | 'flow' | 'cues' | 'timing' | 'speed' | 'filters' | 'mix'

type EreEvaluationState =
  | { status: 'idle' }
  | { status: 'previewing' }
  | { status: 'recorded' }
  | { status: 'evaluating' }
  | { status: 'done'; result: EreEvaluationResult }
  | { status: 'error'; message: string }

export default function MirrorPage({ settings, pool, onLog, onSettingsChange, availableLangs }: MirrorPageProps) {
  const [phase, setPhase] = useState<LoopPhase>('idle')
  const [current, setCurrent] = useState<ChunksAwareResource | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [countdownPhase, setCountdownPhase] = useState<'O' | 'C' | null>(null)
  const [panelOpen, setPanelOpen] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024
  )
  const [ereEvaluation, setEreEvaluation] = useState<EreEvaluationState>({ status: 'idle' })
  const [lastControlSignal, setLastControlSignal] = useState('')
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
  const controlDebounceRef = useRef(0)
  const stageRef = useRef<HTMLDivElement | null>(null)

  // Live refs so the controller reads current settings/pool without being recreated.
  // Recreating it would reset the loop to idle — fatal for the dynamic offline/custom
  // modes, which are designed to be reconfigured mid-session.
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const poolRef = useRef(pool)
  poolRef.current = pool

  const showLog = useCallback((msg: string) => onLog?.(msg), [onLog])

  const retainCopyPreview = useCallback((blob?: Blob) => {
    if (!blob) return undefined
    const url = URL.createObjectURL(blob)
    if (copyPreviewUrlRef.current) URL.revokeObjectURL(copyPreviewUrlRef.current)
    copyPreviewUrlRef.current = url
    return url
  }, [])

  const playCopyPreview = useCallback((url: string) => new Promise<void>((resolve, reject) => {
    const audio = new Audio(url)
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('Could not play learner recording'))
    audio.play().catch(reject)
  }), [])

  const handleAttempt = useCallback(async (attempt: MirrorAttempt) => {
    const previewUrl = retainCopyPreview(attempt.copyBlob)
    if (attempt.resource?.category !== 'ere' || !attempt.copyBlob) return

    try {
      setEreEvaluation({ status: 'previewing' })
      showLog('ERE • playing learner recording')
      if (previewUrl) await playCopyPreview(previewUrl)

      if (!settingsRef.current.ereEvaluationEnabled) {
        setEreEvaluation({ status: 'recorded' })
        showLog('ERE • evaluation off — mirror recording kept local only')
        return
      }

      setEreEvaluation({ status: 'evaluating' })
      showLog('ERE • transcribing and comparing meaning')
      const result = await evaluateEreAttempt(attempt.resource, attempt.copyBlob)
      setEreEvaluation({ status: 'done', result })
      showLog(`ERE • ${result.passed ? 'PASS' : 'NOT YET'} · ${Math.round(result.score * 100)}%`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setEreEvaluation({ status: 'error', message })
      showLog(`ERE evaluation error: ${message}`)
    }
  }, [playCopyPreview, retainCopyPreview, showLog])

  useEffect(() => {
    const cue = () => playAudioCue(CUE_URL)
    const controller = new MirrorLoopController({
      playback: playbackRef.current,
      mic: micRef.current,
      getSettings: () => settingsRef.current,
      getPool: () => poolRef.current,
      onPhaseChange: (p) => setPhase(p),
      onCurrentItemChange: (item) => {
        setCurrent(item)
        if (item) setEreEvaluation({ status: 'idle' })
      },
      onLog: showLog,
      onAttempt: (a) => { void handleAttempt(a) },
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
  }, [handleAttempt, showLog])

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
    const interactiveSelector = 'button, input, select, textarea, a, label, [contenteditable="true"]'

    const isInteractiveTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      if (!el) return false
      return Boolean(el.closest(interactiveSelector))
    }

    const runControl = (action: 'advance' | 'previous' | 'pause' | 'stop', signal: string, event: Event) => {
      const now = performance.now()
      if (now - controlDebounceRef.current < 260) return
      controlDebounceRef.current = now
      setLastControlSignal(signal)

      const ctrl = controllerRef.current
      if (!ctrl) return

      event.preventDefault()

      if (action === 'stop') {
        if (phase !== 'idle') ctrl.stop()
        return
      }

      if (action === 'pause') {
        ctrl.togglePause()
        return
      }

      if (action === 'previous') {
        if (phase !== 'idle') ctrl.previous()
        return
      }

      if (phase === 'idle') ctrl.start()
      else if (phase === 'awaitingCopy') ctrl.beginCopy()
      else if (phase === 'waitingNext' || phase === 'betweenItems') ctrl.next()
    }

    const onKey = (e: KeyboardEvent) => {
      if (isInteractiveTarget(e.target)) return

      const key = e.key.toLowerCase()
      const code = e.code.toLowerCase()
      const signal = `${e.key || 'unknown'} / ${e.code || 'unknown'}`
      const names = new Set([key, code])

      const advanceKey = [
        'arrowright', 'pagedown', 'space', 'enter', 'numpadenter', 'n',
        'mediatracknext', 'medianexttrack', 'browserforward', 'audiovolumeup',
      ].some((name) => names.has(name))
      const previousKey = [
        'arrowleft', 'pageup', 'p', 'backspace',
        'mediatrackprevious', 'mediaprevioustrack', 'browserback', 'audiovolumedown',
      ].some((name) => names.has(name))
      const pauseKey = ['mediaplaypause', '.', 'k', 'pause'].some((name) => names.has(name))

      if (pauseKey) return runControl('pause', signal, e)
      if (previousKey) return runControl('previous', signal, e)
      if (advanceKey) return runControl('advance', signal, e)
      if (e.key === 'Escape') return runControl('stop', signal, e)
    }

    const onMouseUp = (e: MouseEvent) => {
      if (isInteractiveTarget(e.target)) return
      if (e.button === 0) runControl('advance', 'mouse-left', e)
      if (e.button === 2) runControl('previous', 'mouse-right', e)
    }

    const onContextMenu = (e: MouseEvent) => {
      if (!isInteractiveTarget(e.target)) e.preventDefault()
    }

    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)
    window.addEventListener('mouseup', onMouseUp, true)
    window.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keyup', onKey, true)
      window.removeEventListener('mouseup', onMouseUp, true)
      window.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [phase])

  const handleButton = () => {
    const ctrl = controllerRef.current
    if (!ctrl) return
    if (phase === 'idle') ctrl.start()
    else if (phase === 'awaitingCopy') ctrl.beginCopy()
    else if (phase === 'waitingNext' || phase === 'betweenItems') ctrl.next() // running & waiting → advance
    else ctrl.stop()
  }

  const applySettingsChange = (next: RoomSettings) => {
    onSettingsChange(next)

    if (phase !== 'idle') {
      controllerRef.current?.stop()
      showLog('Settings changed — loop paused. Press play to reload.')
    }
  }

  const set = <K extends keyof RoomSettings>(key: K, val: RoomSettings[K]) =>
    applySettingsChange({ ...settings, [key]: val })

  const setMode = (mode: RoomSettings['mode']) => {
    applySettingsChange(applyMode(settings, mode))
  }

  const setCategory = (category: RoomSettings['category']) => {
    applySettingsChange({
      ...settings,
      category,
      ...(category === 'ere'
        ? { level: '', sentenceForm: 'all' as const }
        : { ereTopic: '', erePart: '', ereEvaluationEnabled: false }),
    })
  }

  const focusRemoteStage = () => {
    stageRef.current?.focus()
    setLastControlSignal('armed')
  }

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
  const isEre = settings.category === 'ere'

  return (
    <main className="flex min-h-[100dvh] overflow-x-hidden bg-[--bg] text-[--fg]">
      {/* ─── Training area ──────────────────────────────────────── */}
      <div
        ref={stageRef}
        tabIndex={0}
        onClick={focusRemoteStage}
        className="relative flex flex-1 flex-col items-center justify-center gap-8 px-5 py-20 outline-none sm:gap-10 sm:px-6 sm:py-16"
      >

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.9rem,env(safe-area-inset-top))] pb-3 sm:px-5 sm:py-4">
          <span className="font-mono text-xs font-black uppercase tracking-[0.18em] text-[--accent] sm:text-sm">
            CHUNKS MIRROR
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={focusRemoteStage}
              className="hidden rounded-full border border-[--line] px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[--fg-muted] hover:border-[--accent] hover:text-[--fg] sm:inline-flex"
              title="Click once before using a presenter remote/clicker"
            >
              Arm remote
            </button>
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
                {current.category === 'ere'
                  ? [`ERE T${current.ereTopic ?? '?'}`, current.erePart, current.language?.toUpperCase()].filter(Boolean).join(' · ')
                  : [current.language?.toUpperCase(), `L${current.level}`, current.form].filter(Boolean).join(' · ')}
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

        {current?.category === 'ere' && ereEvaluation.status !== 'idle' && (
          <div className="w-full max-w-md rounded-[14px] border border-[--line] bg-[--bg-elev] px-4 py-3 text-left shadow-[0_24px_80px_-55px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between gap-3">
              <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[--fg-muted]">ERE evaluation</div>
              {ereEvaluation.status === 'done' && (
                <span className={`rounded-full px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.14em] ${ereEvaluation.result.passed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-[--accent]/15 text-[--accent]'}`}>
                  {ereEvaluation.result.passed ? 'Pass' : 'Not yet'} · {Math.round(ereEvaluation.result.score * 100)}%
                </span>
              )}
            </div>
            {ereEvaluation.status === 'previewing' && <p className="mt-2 text-sm text-[--fg]/80">Playing your recording back…</p>}
            {ereEvaluation.status === 'recorded' && <p className="mt-2 text-sm text-[--fg]/80">Evaluation is off. Mirror recording preview finished; no STT or LLM comparison was run.</p>}
            {ereEvaluation.status === 'evaluating' && <p className="mt-2 text-sm text-[--fg]/80">Transcribing and checking meaning…</p>}
            {ereEvaluation.status === 'error' && <p className="mt-2 text-sm text-[--accent]">{ereEvaluation.message}</p>}
            {ereEvaluation.status === 'done' && (
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-[--fg]/80">
                <p><span className="text-[--fg-muted]">Transcript:</span> “{ereEvaluation.result.transcript || '—'}”</p>
                <p><span className="text-[--fg-muted]">Feedback:</span> {ereEvaluation.result.feedback}</p>
              </div>
            )}
          </div>
        )}

        {/* Self-paced / manual hint */}
        {(phase === 'idle' || phase === 'waitingNext' || isAwaitingCopy) && (
          <div className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] text-center font-mono text-[8px] uppercase tracking-[0.18em] text-[--fg-muted]">
            <div>
              {isAwaitingCopy ? 'TAP / CLICKER NEXT to mirror · CLICKER PREV previous · . pause'
                : phase === 'idle' ? 'CLICKER NEXT / SPACE start · . play-pause'
                : 'CLICKER NEXT next · CLICKER PREV previous · . pause'}
            </div>
            {lastControlSignal && (
              <div className="mt-1 text-[7px] tracking-[0.14em] text-[--fg-muted]/70">
                Last remote: {lastControlSignal}
              </div>
            )}
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
          'fixed inset-y-0 right-0 z-20 flex max-h-[100dvh] min-h-0 w-[86vw] max-w-[340px] flex-col border-l border-[--line] bg-[--bg-elev] transition-transform duration-200 sm:w-[300px] lg:w-[280px]',
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
        <div className="settings-scrollbar min-h-0 flex-1 overflow-y-scroll overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 pr-4">
          <div className="flex flex-col gap-2">

            {/* Mode */}
            <Accordion label="Mode" open={openSections.mode} onToggle={() => toggleSection('mode')}>
              <div className="grid grid-cols-2 gap-1.5">
                {INTERACTION_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
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
                        onClick={() => setCategory(opt.value)}
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

                {isEre ? (
                  <>
                    <div className="space-y-2">
                      <SubLabel>Topic</SubLabel>
                      <select
                        value={settings.ereTopic ?? ''}
                        onChange={(e) => set('ereTopic', e.target.value ? Number(e.target.value) : '')}
                        className="w-full rounded-[7px] border border-[--line] bg-[--bg] px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[--fg] outline-none focus:border-[--accent]"
                      >
                        <option value="">All topics</option>
                        {ERE_TOPIC_OPTIONS.map((topic) => (
                          <option key={topic} value={topic}>Topic {topic}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <SubLabel>Part</SubLabel>
                      <select
                        value={settings.erePart ?? ''}
                        onChange={(e) => set('erePart', e.target.value)}
                        className="w-full rounded-[7px] border border-[--line] bg-[--bg] px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[--fg] outline-none focus:border-[--accent]"
                      >
                        <option value="">All parts</option>
                        {ERE_PART_OPTIONS.map((part) => (
                          <option key={part} value={part}>{part}</option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-[10px] border border-[--line] bg-[--bg]/60 px-3 py-2">
                      <ToggleRow
                        label="ERE evaluation"
                        hint="Off: only play + mirror audio. On: send recording to STT + semantic compare."
                        checked={Boolean(settings.ereEvaluationEnabled)}
                        onChange={(v) => set('ereEvaluationEnabled', v)}
                      />
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
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

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
}

const TRANSITION_CUE_URL = '/resources/audio/sfx/universfield-clear-bell-chime-487898.mp3'

export default function MirrorPage({ settings, pool, onLog }: MirrorPageProps) {
  const [phase, setPhase] = useState<LoopPhase>('idle')
  const [current, setCurrent] = useState<ChunksAwareResource | null>(null)

  const playbackRef = useRef(new BrowserAudioPlaybackAdapter())
  const micRef = useRef(new BrowserMicRecordingAdapter())
  const controllerRef = useRef<MirrorLoopController | null>(null)
  const copyPreviewUrlRef = useRef<string | null>(null)

  const showLog = useCallback((message: string) => {
    onLog?.(message)
  }, [onLog])

  const retainCopyPreview = useCallback((blob?: Blob) => {
    if (!blob) return
    const nextUrl = URL.createObjectURL(blob)
    if (copyPreviewUrlRef.current) {
      URL.revokeObjectURL(copyPreviewUrlRef.current)
    }
    copyPreviewUrlRef.current = nextUrl
  }, [])

  useEffect(() => {
    const controller = new MirrorLoopController({
      playback: playbackRef.current,
      mic: micRef.current,
      getSettings: () => settings,
      getPool: () => pool,
      onPhaseChange: (nextPhase) => setPhase(nextPhase),
      onCurrentItemChange: (item) => setCurrent(item),
      onLog: showLog,
      onAttempt: (attempt) => retainCopyPreview(attempt.copyBlob),
      playEndingCue: () => (settings.endingCue ? playAudioCue(TRANSITION_CUE_URL) : Promise.resolve()),
    })

    controllerRef.current = controller
    setPhase('idle')
    setCurrent(null)

    return () => {
      controller.stop()
    }
  }, [pool, retainCopyPreview, settings, showLog])

  useEffect(() => () => {
    if (copyPreviewUrlRef.current) {
      URL.revokeObjectURL(copyPreviewUrlRef.current)
      copyPreviewUrlRef.current = null
    }
  }, [])

  const isAuto = settings.mode === 'auto'

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const controller = controllerRef.current
      if (!controller) return

      const isManualWaiting = !isAuto && (phase === 'waitingNext' || phase === 'betweenItems')
      if (isManualWaiting && (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter' || event.key.toLowerCase() === 'n')) {
        event.preventDefault()
        controller.next()
      }

      if (event.key === 'Escape' && phase !== 'idle') {
        event.preventDefault()
        controller.stop()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [phase, isAuto])

  const handleMainButton = () => {
    const controller = controllerRef.current
    if (!controller) return

    if (phase === 'idle' || phase === 'waitingNext') {
      controller.start()
    } else if (phase === 'betweenItems') {
      controller.next()
    } else {
      controller.stop()
    }
  }

  const isActive = phase === 'preparing' || phase === 'playingOriginal' || phase === 'recordingCopy' || phase === 'betweenItems'
  const showWave = phase === 'playingOriginal' || phase === 'recordingCopy'
  const ariaLabel = phase === 'idle' || phase === 'waitingNext' || phase === 'betweenItems'
    ? 'Play mirror loop'
    : 'Stop mirror loop'

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[--bg] px-4">
      <button
        type="button"
        onClick={handleMainButton}
        aria-label={ariaLabel}
        data-has-current={current ? 'true' : 'false'}
        className={`group relative flex h-64 w-64 items-center justify-center rounded-full border transition-all duration-300 active:scale-[0.975] ${
          isActive
            ? 'border-[--accent] bg-[--accent] text-white shadow-[0_0_0_1px_rgba(255,69,58,0.24),0_40px_100px_-50px_rgba(255,69,58,0.9)]'
            : 'border-[#23232C] bg-[#0C0C0E] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_40px_120px_-70px_rgba(0,0,0,0.9)] hover:border-[--accent]'
        }`}
      >
        {phase === 'recordingCopy' && (
          <span className="pointer-events-none absolute inset-[-18px] rounded-full border border-[--accent] animate-ring-pulse-fade" />
        )}

        <span className="pointer-events-none absolute inset-6 rounded-full border border-white/10" />

        {showWave ? (
          <span className="relative flex h-16 items-center gap-2" aria-hidden="true">
            <span className="wave-bar wave-bar-1" />
            <span className="wave-bar wave-bar-2" />
            <span className="wave-bar wave-bar-3" />
            <span className="wave-bar wave-bar-4" />
            <span className="wave-bar wave-bar-5" />
          </span>
        ) : isActive ? (
          <span className="relative h-12 w-12 rounded-[10px] bg-current" aria-hidden="true" />
        ) : (
          <svg className="relative ml-2 h-20 w-20" viewBox="0 0 80 80" fill="none" aria-hidden="true">
            <path d="M25 14L64 40L25 66V14Z" fill="currentColor" />
          </svg>
        )}
      </button>
    </main>
  )
}

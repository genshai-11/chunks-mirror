import type { ChunksAwareResource, MirrorAttempt, RoomSettings } from './types'
import type { AudioPlaybackAdapter } from '../adapters/audioPlayback'
import type { MicRecordingAdapter } from '../adapters/micCapture'

export type LoopPhase =
  | 'idle'
  | 'preparing'        // G
  | 'playingOriginal'  // O
  | 'recordingCopy'    // C
  | 'awaitingCopy'     // self-paced gate before C (offline / custom)
  | 'betweenItems'
  | 'waitingNext'

export interface MirrorLoopControllerOptions {
  playback: AudioPlaybackAdapter
  mic: MicRecordingAdapter
  getSettings: () => RoomSettings
  getPool: () => ChunksAwareResource[]
  onPhaseChange: (phase: LoopPhase) => void
  onCurrentItemChange: (item: ChunksAwareResource | null) => void
  onLog: (message: string) => void
  onAttempt?: (attempt: MirrorAttempt) => void
  onCountdown?: (remaining: number, phase: 'O' | 'C') => void
  playListenCue?: () => void | Promise<void>   // G → O boundary
  playEndingCue?: () => void | Promise<void>    // O → C boundary ("mirror")
  playAfterCopyCue?: () => void | Promise<void> // C → next boundary ("done")
}

export class MirrorLoopController {
  private phase: LoopPhase = 'idle'
  private current: ChunksAwareResource | null = null
  private queue: ChunksAwareResource[] = []
  private queueIndex = 0
  private timer: number | null = null
  private isRunning = false
  private lastCopyBlob: Blob | null = null // kept for future scoring / export (used in betweenItems)

  constructor(private opts: MirrorLoopControllerOptions) {}

  getPhase(): LoopPhase {
    return this.phase
  }

  getCurrent(): ChunksAwareResource | null {
    return this.current
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.rebuildQueue()
    this.advance()
  }

  stop() {
    this.isRunning = false
    this.clearTimer()
    this.opts.playback.stop()
    if (this.opts.mic.isRecording()) {
      this.opts.mic.stop().catch(() => {})
    }
    this.setPhase('idle')
    this.current = null
    this.opts.onCurrentItemChange(null)
    this.lastCopyBlob = null
    this.opts.onLog('Stopped')
  }

  // For manual / offline / custom modes: advance to next item
  next() {
    if (!this.isRunning) return
    this.clearTimer()
    this.opts.playback.stop()
    if (this.opts.mic.isRecording()) {
      this.opts.mic.stop().catch(() => {})
    }
    this.advance()
  }

  previous() {
    if (!this.isRunning) return
    this.clearTimer()
    this.opts.playback.stop()
    if (this.opts.mic.isRecording()) {
      this.opts.mic.stop().catch(() => {})
    }
    this.queueIndex = Math.max(0, this.queueIndex - 2)
    this.advance()
  }

  togglePause() {
    if (this.isRunning) {
      this.stop()
    } else {
      this.start()
    }
  }

  // For offline / custom self-paced gate: begin Copy Capture when the learner is ready
  beginCopy() {
    if (!this.isRunning || this.phase !== 'awaitingCopy') return
    this.clearTimer()
    this.startCopyCapture(this.opts.getSettings())
  }

  private rebuildQueue() {
    const pool = this.opts.getPool()
    const settings = this.opts.getSettings()
    let items = [...pool]

    if (settings.randomMix) {
      items = items.sort(() => Math.random() - 0.5)
    }

    this.queue = items
    this.queueIndex = 0
  }

  private advance() {
    if (!this.isRunning) return

    const settings = this.opts.getSettings()

    if (this.queueIndex >= this.queue.length) {
      this.rebuildQueue()
      this.queueIndex = 0
    }

    if (this.queue.length === 0) {
      this.opts.onLog('No approved resources available.')
      this.stop()
      return
    }

    this.current = this.queue[this.queueIndex]
    this.queueIndex++
    this.opts.onCurrentItemChange(this.current)

    // G - prepare
    this.setPhase('preparing')
    this.opts.onLog(`G • preparing ${this.current.id}`)

    const prepDelay = 450 // small visual prep like prototype

    this.timer = window.setTimeout(() => {
      void this.playListenCueThenOriginal(settings)
    }, prepDelay)
  }

  private async playListenCueThenOriginal(settings: RoomSettings) {
    if (!this.current || !this.isRunning) return

    if (settings.cueOnListen && this.opts.playListenCue) {
      try {
        await this.opts.playListenCue()
      } catch {
        // cue failure should never block O
      }
    }

    if (this.isRunning) this.playOriginal(settings)
  }

  private playOriginal(settings: RoomSettings) {
    if (!this.current || !this.isRunning) return

    this.setPhase('playingOriginal')

    const oSeconds = settings.oSeconds || 3
    this.opts.onLog(`O • ${this.current.textPrompt} (${oSeconds}s)`)

    // Start playback (fire and forget timing — controller owns countdown)
    this.opts.playback.play(this.current, settings.playbackRate ?? 1).catch((e) => {
      this.opts.onLog(`Playback error: ${e?.message || e}`)
    })

    this.startCountdown(oSeconds, (remain) => {
      this.opts.onCountdown?.(remain, 'O')
    }, () => {
      void this.playCueThenCopy(settings)
    })
  }

  private async playCueThenCopy(settings: RoomSettings) {
    if (!this.current || !this.isRunning) return

    if (settings.cueOnMirror && this.opts.playEndingCue) {
      try {
        await this.opts.playEndingCue()
      } catch {
        // cue failure should never block C
      }
    }

    if (!this.isRunning) return

    // Self-paced gate: wait for a tap before recording C.
    // ERE always requires learner readiness before recording, independent of mode
    // and independent of whether semantic evaluation is enabled.
    if (settings.gateBeforeCopy || this.current.category === 'ere') {
      this.setPhase('awaitingCopy')
      this.opts.onLog('Ready when you are ▸ tap to mirror')
      return
    }

    this.startCopyCapture(settings)
  }

  private startCopyCapture(settings: RoomSettings) {
    if (!this.current || !this.isRunning) return

    this.setPhase('recordingCopy')
    this.lastCopyBlob = null

    const cSeconds = settings.cSeconds || 3
    this.opts.onLog(`C • mirror it (${cSeconds}s)`)

    // Start mic (best effort)
    this.opts.mic.start().catch(() => {
      this.opts.onLog('(mic unavailable — visual only)')
    })

    this.startCountdown(
      cSeconds,
      (remain) => {
        this.opts.onCountdown?.(remain, 'C')
      },
      async () => {
        let copyBlob: Blob | undefined
        try {
          if (this.opts.mic.isRecording()) {
            copyBlob = await this.opts.mic.stop()
            this.lastCopyBlob = copyBlob
          }
        } catch (error) {
          void error
        }

        if (settings.cueOnEnd && this.opts.playAfterCopyCue) {
          try { await this.opts.playAfterCopyCue() } catch { /* cue failure never blocks loop */ }
        }

        this.betweenItems(settings, copyBlob)
      }
    )
  }

  private betweenItems(settings: RoomSettings, copyBlob?: Blob) {
    if (!this.current) return

    this.setPhase('betweenItems')

    // Emit MirrorAttempt (score is off)
    const attempt: MirrorAttempt = {
      resourceId: this.current.id,
      resource: this.current,
      sourceAudioUrl: this.current.audioUrl,
      copyBlob: copyBlob || this.lastCopyBlob || undefined,
      startedAt: Date.now(),
      oDurationMs: (settings.oSeconds || 3) * 1000,
      cDurationMs: (settings.cSeconds || 3) * 1000,
    }
    this.opts.onAttempt?.(attempt)

    const shouldAutoAdvance = settings.autoAdvance && this.current.category !== 'ere'

    if (shouldAutoAdvance && this.isRunning) {
      this.opts.onLog('… next (auto)')
      this.setPhase('preparing') // brief visual
      this.timer = window.setTimeout(() => {
        if (this.isRunning) this.advance()
      }, 700)
    } else {
      this.setPhase('waitingNext')
      this.opts.onLog('Waiting for Next ▸')
    }
  }

  private startCountdown(
    seconds: number,
    onTick: (remaining: number) => void,
    onDone: () => void
  ) {
    this.clearTimer()
    const start = performance.now()
    const ms = seconds * 1000

    const tick = () => {
      const now = performance.now()
      const elapsed = now - start
      const progress = Math.min(1, elapsed / ms)
      const remain = Math.ceil(seconds - progress * seconds)
      onTick(Math.max(0, remain))

      if (progress < 1 && this.isRunning) {
        this.timer = window.setTimeout(tick, 100)
      } else if (this.isRunning) {
        onDone()
      }
    }

    tick()
  }

  private setPhase(p: LoopPhase) {
    this.phase = p
    this.opts.onPhaseChange(p)
  }

  private clearTimer() {
    if (this.timer != null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

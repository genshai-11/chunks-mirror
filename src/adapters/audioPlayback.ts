import type { ChunksAwareResource } from '../domain/types'

export interface AudioPlaybackAdapter {
  play(item: ChunksAwareResource | { audioUrl: string }, playbackRate?: number): Promise<void>
  stop(): void
  isPlaying(): boolean
}

/**
 * Browser implementation using HTMLAudioElement.
 * Simple and reliable for the ignition slice.
 * Countdown timing is handled by the caller (MirrorLoopController) for precision.
 */
export class BrowserAudioPlaybackAdapter implements AudioPlaybackAdapter {
  private audio: HTMLAudioElement | null = null
  // currentUrl tracking removed (not needed for ignition)

  async play(item: ChunksAwareResource | { audioUrl: string }, playbackRate = 1): Promise<void> {
    const url = 'audioUrl' in item ? item.audioUrl : (item as ChunksAwareResource).audioUrl

    this.stop()

    this.audio = new Audio(url)
    this.audio.playbackRate = Math.max(0.25, Math.min(4, playbackRate))

    try {
      await this.audio.play()
    } catch (err) {
      this.audio = null
      throw err
    }
  }

  stop(): void {
    if (this.audio) {
      try {
        this.audio.pause()
        this.audio.currentTime = 0
      } catch {
        // Ignore cleanup failures when the browser has already released the audio element.
      }
      this.audio = null
    }
  }

  isPlaying(): boolean {
    return !!this.audio && !this.audio.paused && !this.audio.ended
  }
}

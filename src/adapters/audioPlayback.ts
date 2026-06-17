import type { ChunksAwareResource } from '../domain/types'

export interface AudioPlaybackAdapter {
  play(item: ChunksAwareResource | { audioUrl: string }): Promise<void>
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

  async play(item: ChunksAwareResource | { audioUrl: string }): Promise<void> {
    const url = 'audioUrl' in item ? item.audioUrl : (item as ChunksAwareResource).audioUrl

    this.stop()

    this.audio = new Audio(url)

    // Make sure it can play (some browsers need interaction already happened)
    try {
      await this.audio.play()
    } catch (err) {
      // Re-throw so controller can handle (e.g. show message)
      this.audio = null
      throw err
    }
  }

  stop(): void {
    if (this.audio) {
      try {
        this.audio.pause()
        this.audio.currentTime = 0
      } catch {}
      this.audio = null
    }
  }

  isPlaying(): boolean {
    return !!this.audio && !this.audio.paused && !this.audio.ended
  }
}

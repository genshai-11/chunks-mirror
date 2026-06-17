export interface MicRecordingAdapter {
  start(): Promise<void>
  stop(): Promise<Blob>
  isRecording(): boolean
}

/**
 * Browser implementation using MediaRecorder + getUserMedia.
 * Returns a Blob (webm or whatever the browser supports).
 * Used for C / Copy Capture. Scoring is off in v1.
 */
export class BrowserMicRecordingAdapter implements MicRecordingAdapter {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private recording = false

  async start(): Promise<void> {
    if (this.recording) return

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.chunks = []

      // Prefer webm if available, fall back to default
      const options: MediaRecorderOptions = {}
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm'
      }

      this.recorder = new MediaRecorder(this.stream, options)

      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data)
      }

      this.recorder.start()
      this.recording = true
    } catch (err) {
      this.cleanup()
      throw err
    }
  }

  async stop(): Promise<Blob> {
    if (!this.recording || !this.recorder) {
      throw new Error('Not recording')
    }

    return new Promise((resolve, reject) => {
      const recorder = this.recorder!

      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' })
        this.cleanup()
        resolve(blob)
      }

      recorder.onerror = (e) => {
        this.cleanup()
        reject(e)
      }

      try {
        recorder.stop()
      } catch (e) {
        this.cleanup()
        reject(e)
      }
    })
  }

  isRecording(): boolean {
    return this.recording
  }

  private cleanup() {
    this.recording = false
    if (this.recorder) {
      this.recorder = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
    this.chunks = []
  }
}

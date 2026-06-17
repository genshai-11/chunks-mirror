export async function playAudioCue(url: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const audio = new Audio(url)
    audio.preload = 'auto'
    audio.volume = 1
    audio.onended = () => resolve()
    audio.onerror = () => resolve()
    const started = audio.play()
    if (started) {
      started.catch(() => resolve())
    }
  })
}

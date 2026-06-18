// TTSAdapter — calls the same-origin /api/tts (proxy hides the 9router key)

// Auto-voice map: language ISO code → edge-tts voice identifier
// Used when autoVoice=true in batch generation so every language gets its best voice automatically.
export const VOICE_MAP: Record<string, string> = {
  en:  'edge-tts/en-US-AriaNeural',
  vi:  'edge-tts/vi-VN-HoaiMyNeural',
  zh:  'edge-tts/zh-CN-XiaoxiaoNeural',
  fr:  'edge-tts/fr-FR-DeniseNeural',
  ko:  'edge-tts/ko-KR-SunHiNeural',
  ja:  'edge-tts/ja-JP-NanamiNeural',
  es:  'edge-tts/es-ES-ElviraNeural',
  de:  'edge-tts/de-DE-KatjaNeural',
  it:  'edge-tts/it-IT-ElsaNeural',
  pt:  'edge-tts/pt-BR-FranciscaNeural',
  ru:  'edge-tts/ru-RU-SvetlanaNeural',
  ar:  'edge-tts/ar-SA-ZariyahNeural',
  hi:  'edge-tts/hi-IN-SwaraNeural',
  th:  'edge-tts/th-TH-PremwadeeNeural',
  id:  'edge-tts/id-ID-GadisNeural',
  nl:  'edge-tts/nl-NL-ColetteNeural',
  tr:  'edge-tts/tr-TR-EmelNeural',
  pl:  'edge-tts/pl-PL-ZofiaNeural',
  sv:  'edge-tts/sv-SE-SofieNeural',
  el:  'edge-tts/el-GR-AthinaNeural',
  uk:  'edge-tts/uk-UA-PolinaNeural',
  ro:  'edge-tts/ro-RO-AlinaNeural',
  cs:  'edge-tts/cs-CZ-VlastaNeural',
  fil: 'edge-tts/fil-PH-BlessicaNeural',
}

// Returns the best edge-tts model string for a given ISO language code.
export function voiceForLang(lang: string): string {
  return VOICE_MAP[lang] ?? 'edge-tts/en-US-AriaNeural'
}

export interface TtsModel {
  id: string
  multilingual: boolean
  provider: string // 'edge-tts' | 'elevenlabs' | 'openai' | 'google' | 'other'
}

// Heuristic: flag models likely to support multiple languages
export function isMultilingual(id: string): boolean {
  const lower = id.toLowerCase()
  return (
    lower.includes('multilingual') ||
    lower.includes('eleven_') ||
    lower.startsWith('el/') ||
    lower.startsWith('openai/') ||
    lower.startsWith('google-tts/') ||
    lower.startsWith('azure/') ||
    lower.startsWith('ms-') ||
    lower.includes('turbo') ||
    lower.includes('flash')
  )
}

function providerOf(id: string): string {
  if (id.startsWith('edge-tts/')) return 'edge-tts'
  if (id.startsWith('el/') || id.includes('eleven')) return 'elevenlabs'
  if (id.startsWith('openai/') || id.startsWith('tts-')) return 'openai'
  if (id.startsWith('google-tts/')) return 'google'
  if (id.startsWith('azure/') || id.startsWith('ms-')) return 'azure'
  return 'other'
}

export async function listModels(): Promise<TtsModel[]> {
  const res = await fetch('/api/list-models')
  if (!res.ok) return []
  const data = await res.json()
  const raw: Array<{ id: string }> = data?.data || []
  return raw
    .filter((m) => typeof m.id === 'string' && m.id.length > 0)
    .map((m) => ({ id: m.id, multilingual: isMultilingual(m.id), provider: providerOf(m.id) }))
    .sort((a, b) => {
      // multilingual first, then alphabetical by provider+id
      if (a.multilingual !== b.multilingual) return a.multilingual ? -1 : 1
      return a.id.localeCompare(b.id)
    })
}

export interface GenerateSpeechParams {
  model: string // e.g. "edge-tts/en-US-AriaNeural", "el/eleven_multilingual_v2", "google-tts/vi"
  input: string
}

export async function generateSpeech({ model, input }: GenerateSpeechParams): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`TTS proxy error ${res.status}: ${text}`)
  }

  const ct = res.headers.get('content-type') || 'audio/mpeg'
  const buf = await res.arrayBuffer()
  return new Blob([buf], { type: ct })
}

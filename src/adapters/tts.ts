// TTSAdapter — calls the same-origin /api/tts (proxy hides the 9router key)

// Multi-voice map: language → array of edge-tts voices (rotated for variety)
export const VOICE_MAP: Record<string, string[]> = {
  en:  ['edge-tts/en-US-AriaNeural', 'edge-tts/en-US-GuyNeural', 'edge-tts/en-GB-SoniaNeural', 'edge-tts/en-AU-NatashaNeural'],
  vi:  ['edge-tts/vi-VN-HoaiMyNeural', 'edge-tts/vi-VN-NamMinhNeural'],
  zh:  ['edge-tts/zh-CN-XiaoxiaoNeural', 'edge-tts/zh-CN-YunxiNeural', 'edge-tts/zh-HK-HiuGaaiNeural', 'edge-tts/zh-TW-HsiaoChenNeural'],
  fr:  ['edge-tts/fr-FR-DeniseNeural', 'edge-tts/fr-FR-HenriNeural', 'edge-tts/fr-CA-SylvieNeural'],
  ko:  ['edge-tts/ko-KR-SunHiNeural', 'edge-tts/ko-KR-InJoonNeural'],
  ja:  ['edge-tts/ja-JP-NanamiNeural', 'edge-tts/ja-JP-KeitaNeural'],
  es:  ['edge-tts/es-ES-ElviraNeural', 'edge-tts/es-MX-DaliaNeural', 'edge-tts/es-ES-AlvaroNeural'],
  de:  ['edge-tts/de-DE-KatjaNeural', 'edge-tts/de-DE-ConradNeural'],
  it:  ['edge-tts/it-IT-ElsaNeural', 'edge-tts/it-IT-DiegoNeural'],
  pt:  ['edge-tts/pt-BR-FranciscaNeural', 'edge-tts/pt-PT-RaquelNeural'],
  ru:  ['edge-tts/ru-RU-SvetlanaNeural', 'edge-tts/ru-RU-DmitryNeural'],
  ar:  ['edge-tts/ar-SA-ZariyahNeural', 'edge-tts/ar-EG-SalmaNeural'],
  hi:  ['edge-tts/hi-IN-SwaraNeural', 'edge-tts/hi-IN-MadhurNeural'],
  th:  ['edge-tts/th-TH-PremwadeeNeural', 'edge-tts/th-TH-NiwatNeural'],
  id:  ['edge-tts/id-ID-GadisNeural', 'edge-tts/id-ID-ArdiNeural'],
  nl:  ['edge-tts/nl-NL-ColetteNeural', 'edge-tts/nl-NL-MaartenNeural'],
  tr:  ['edge-tts/tr-TR-EmelNeural', 'edge-tts/tr-TR-AhmetNeural'],
  pl:  ['edge-tts/pl-PL-ZofiaNeural', 'edge-tts/pl-PL-MarekNeural'],
  sv:  ['edge-tts/sv-SE-SofieNeural', 'edge-tts/sv-SE-MattiasNeural'],
  el:  ['edge-tts/el-GR-AthinaNeural', 'edge-tts/el-GR-NestorasNeural'],
  uk:  ['edge-tts/uk-UA-PolinaNeural', 'edge-tts/uk-UA-OstapNeural'],
  ro:  ['edge-tts/ro-RO-AlinaNeural', 'edge-tts/ro-RO-EmilNeural'],
  cs:  ['edge-tts/cs-CZ-VlastaNeural', 'edge-tts/cs-CZ-AntoninNeural'],
  fil: ['edge-tts/fil-PH-BlessicaNeural', 'edge-tts/fil-PH-AngeloNeural'],
}

// Returns a voice for the given language, rotating by index for variety.
export function voiceForLang(lang: string, index = 0): string {
  const voices = VOICE_MAP[lang] ?? VOICE_MAP['en']
  return voices[index % voices.length]
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

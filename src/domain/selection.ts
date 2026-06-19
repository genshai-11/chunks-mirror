import type { ChunksAwareResource, RoomSettings, SentenceForm } from './types'

export function estimateSyllables(text?: string): number {
  // Rough cross-language estimator: count vowel nuclei.
  return ((text || '').toLowerCase().match(/[aáàâãäåæeéèêëiíìîïoóòôõöøuúùûüyýÿаеёиоуыэюяіїєАЕЁИОУЫЭЮЯІЇЄ]/g) || []).length || 1
}

export function resolveSentenceForm(resource: Pick<ChunksAwareResource, 'category' | 'form' | 'textPrompt' | 'soundPrompt'>): SentenceForm | null {
  if (resource.form === 'short' || resource.form === 'medium' || resource.form === 'long') return resource.form
  if (resource.category !== 'speech') return null

  const syllableCount = estimateSyllables(resource.textPrompt || resource.soundPrompt)
  if (syllableCount <= 3) return 'short'
  if (syllableCount <= 6) return 'medium'
  return 'long'
}

export function filterResources(
  resources: ChunksAwareResource[],
  settings: RoomSettings,
): ChunksAwareResource[] {
  const { category, language, level, sentenceForm } = settings

  let pool = resources.filter((r) => {
    if (r.approvalStatus !== 'approved_resource') return false
    if (category && r.category !== category) return false
    if (language && r.language !== language) return false
    if (level && String(r.level) !== String(level)) return false
    if (sentenceForm && sentenceForm !== 'all') {
      if (resolveSentenceForm(r) !== sentenceForm) return false
    }
    return true
  })

  if (settings.randomMix) {
    // Stable-ish shuffle using simple hash of level + text length (same spirit as prototype)
    pool = [...pool].sort((a, b) => {
      const ha = Math.sin((a.level || 0) * 99 + (a.textPrompt?.length || 0))
      const hb = Math.sin((b.level || 0) * 99 + (b.textPrompt?.length || 0))
      return ha - hb
    })
  }

  return pool
}

export function buildPool(resources: ChunksAwareResource[], settings: RoomSettings): ChunksAwareResource[] {
  return filterResources(resources, settings)
}

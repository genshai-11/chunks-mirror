import type { ChunksAwareResource, RoomSettings } from './types'

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
      if (r.form && r.form !== sentenceForm) return false
    }
    return true
  })

  if (pool.length === 0) {
    // Fallback to all approved when filters are too strict
    pool = resources.filter((r) => r.approvalStatus === 'approved_resource')
  }

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

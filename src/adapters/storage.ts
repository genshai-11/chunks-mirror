import type { ResourceBank, ChunksAwareResource } from '../domain/types'

export type { ChunksAwareResource } from '../domain/types' // re-export for convenience

export interface StorageAdapter {
  loadResources(): Promise<ChunksAwareResource[]>
}

export async function loadStaticBank(): Promise<ResourceBank> {
  const mod = await import('../data/resources.json')
  // The JSON is plain; cast is acceptable for the static manifest at dev/build time
  return (mod.default || mod) as ResourceBank
}


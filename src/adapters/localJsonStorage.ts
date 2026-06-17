import type { StorageAdapter } from './storage'
import { loadStaticBank } from './storage'
import type { ChunksAwareResource } from '../domain/types' // canonical source

export class LocalJsonStorageAdapter implements StorageAdapter {
  async loadResources(): Promise<ChunksAwareResource[]> {
    const bank = await loadStaticBank()
    return bank.resources || []
  }
}

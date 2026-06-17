import type { ChunksAwareResource } from './types'

export function isApproved(r: ChunksAwareResource): boolean {
  return r.approvalStatus === 'approved_resource'
}

export function onlyApproved(list: ChunksAwareResource[]): ChunksAwareResource[] {
  return list.filter(isApproved)
}

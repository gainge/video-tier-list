import type { MoveTarget } from './boardReducer'

/**
 * Droppable ids for the buckets themselves. Video ids are fixed-length YouTube ids, so these
 * prefixed forms can never collide with a tile's id inside the same DndContext.
 */
export const POOL_DROPPABLE_ID = 'bucket:pool'

export function tierDroppableId(index: number): string {
  return `bucket:tier:${index}`
}

/** Returns null when the id belongs to a tile rather than a bucket. */
export function parseDropTarget(id: string): MoveTarget | null {
  if (id === POOL_DROPPABLE_ID) return { kind: 'pool' }
  const match = /^bucket:tier:(\d+)$/.exec(id)
  return match ? { kind: 'tier', index: Number(match[1]) } : null
}

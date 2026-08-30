import { MAX_TIERS } from '../lib/urlCodec'
import { createEmptyBoard } from '../types'
import type { BoardState, Tier, VideoId } from '../types'

/** Where a video is headed. A bucket plus a position is the whole placement. */
export type MoveTarget = { kind: 'tier'; index: number } | { kind: 'pool' }

export type BoardAction =
  | { type: 'addVideos'; ids: VideoId[] }
  | { type: 'removeVideo'; id: VideoId }
  | { type: 'moveVideo'; id: VideoId; to: MoveTarget; beforeId?: VideoId | null }
  | { type: 'renameTier'; index: number; label: string }
  | { type: 'addTier'; index: number }
  | { type: 'removeTier'; index: number }
  | { type: 'moveTier'; index: number; direction: TierDirection }
  | { type: 'resetBoard' }

export type TierDirection = 'up' | 'down'

/** The label a fresh row carries until it is renamed; never empty, since the codec drops those. */
export const NEW_TIER_LABEL = 'New'

function addVideos(state: BoardState, ids: VideoId[]): BoardState {
  const known = new Set(state.videos)
  const fresh: VideoId[] = []
  for (const id of ids) {
    if (known.has(id)) continue
    known.add(id)
    fresh.push(id)
  }
  if (fresh.length === 0) return state

  return {
    ...state,
    videos: [...state.videos, ...fresh],
    pool: [...state.pool, ...fresh],
  }
}

function removeVideo(state: BoardState, id: VideoId): BoardState {
  if (!state.videos.includes(id)) return state

  return {
    ...state,
    videos: state.videos.filter((existing) => existing !== id),
    tiers: state.tiers.map((tier) =>
      tier.items.includes(id)
        ? { ...tier, items: tier.items.filter((existing) => existing !== id) }
        : tier,
    ),
    pool: state.pool.filter((existing) => existing !== id),
  }
}

/**
 * Cross-bucket moves and within-bucket reordering are the same operation: pull the id out of
 * wherever it currently lives, then put it back in front of `beforeId`. Doing both halves in one
 * action means the "exactly one bucket" invariant is never briefly violated.
 */
function moveVideo(
  state: BoardState,
  id: VideoId,
  to: MoveTarget,
  beforeId: VideoId | null | undefined,
): BoardState {
  if (!state.videos.includes(id)) return state
  if (to.kind === 'tier' && !(to.index >= 0 && to.index < state.tiers.length)) return state

  const withoutId = (items: VideoId[]) => items.filter((existing) => existing !== id)

  const withIdInserted = (items: VideoId[]): VideoId[] => {
    const rest = withoutId(items)
    const at = beforeId == null ? -1 : rest.indexOf(beforeId)
    if (at === -1) return [...rest, id]
    return [...rest.slice(0, at), id, ...rest.slice(at)]
  }

  return {
    ...state,
    tiers: state.tiers.map((tier, index) => {
      if (to.kind === 'tier' && index === to.index)
        return { ...tier, items: withIdInserted(tier.items) }
      return tier.items.includes(id) ? { ...tier, items: withoutId(tier.items) } : tier
    }),
    pool: to.kind === 'pool' ? withIdInserted(state.pool) : withoutId(state.pool),
  }
}

function inRange(state: BoardState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < state.tiers.length
}

function withTiers(state: BoardState, tiers: Tier[]): BoardState {
  return { ...state, tiers }
}

/** An empty label leaves an unusable drop target and would be dropped by the codec. */
function renameTier(state: BoardState, index: number, label: string): BoardState {
  const trimmed = label.trim()
  if (!inRange(state, index) || trimmed.length === 0) return state
  if (state.tiers[index].label === trimmed) return state

  return withTiers(
    state,
    state.tiers.map((tier, i) => (i === index ? { ...tier, label: trimmed } : tier)),
  )
}

/** `index` is the insertion point, so `tiers.length` appends a row after the last one. */
function addTier(state: BoardState, index: number): BoardState {
  if (!Number.isInteger(index) || index < 0 || index > state.tiers.length) return state
  // Tiers past the 36th have no ranking char, so they could not survive a share link.
  if (state.tiers.length >= MAX_TIERS) return state

  const tiers = [...state.tiers]
  tiers.splice(index, 0, { label: NEW_TIER_LABEL, items: [] })
  return withTiers(state, tiers)
}

function removeTier(state: BoardState, index: number): BoardState {
  // A board with no tiers has nowhere to drop a video.
  if (!inRange(state, index) || state.tiers.length <= 1) return state

  const removed = state.tiers[index]
  return {
    ...state,
    tiers: state.tiers.filter((_, i) => i !== index),
    pool: [...state.pool, ...removed.items],
  }
}

/** Items travel with their row, so a reorder is purely a permutation of the tier list. */
function moveTier(state: BoardState, index: number, direction: TierDirection): BoardState {
  if (!inRange(state, index)) return state
  const target = direction === 'up' ? index - 1 : index + 1
  if (!inRange(state, target)) return state

  const tiers = [...state.tiers]
  tiers[index] = state.tiers[target]
  tiers[target] = state.tiers[index]
  return withTiers(state, tiers)
}

/** The bucket currently holding `id`, or null when the board does not know the id. */
export function findBucket(state: BoardState, id: VideoId): MoveTarget | null {
  const tierIndex = state.tiers.findIndex((tier) => tier.items.includes(id))
  if (tierIndex !== -1) return { kind: 'tier', index: tierIndex }
  return state.pool.includes(id) ? { kind: 'pool' } : null
}

export function bucketItems(state: BoardState, target: MoveTarget): VideoId[] {
  return target.kind === 'pool' ? state.pool : (state.tiers[target.index]?.items ?? [])
}

export function sameBucket(a: MoveTarget, b: MoveTarget): boolean {
  if (a.kind === 'pool' || b.kind === 'pool') return a.kind === b.kind
  return a.index === b.index
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'addVideos':
      return addVideos(state, action.ids)
    case 'removeVideo':
      return removeVideo(state, action.id)
    case 'moveVideo':
      return moveVideo(state, action.id, action.to, action.beforeId)
    case 'renameTier':
      return renameTier(state, action.index, action.label)
    case 'addTier':
      return addTier(state, action.index)
    case 'removeTier':
      return removeTier(state, action.index)
    case 'moveTier':
      return moveTier(state, action.index, action.direction)
    case 'resetBoard':
      return createEmptyBoard()
  }
}

/** Reading order of the board as rendered: each tier top to bottom, then the pool. */
export function boardOrder(state: BoardState): VideoId[] {
  return [...state.tiers.flatMap((tier) => tier.items), ...state.pool]
}

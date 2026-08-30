export type VideoId = string

export type Tier = {
  label: string
  items: VideoId[]
}

/**
 * `videos` is the canonical identity list; every id appears exactly once across the
 * tiers and the pool. Membership is the placement, so there is no separate mapping
 * that can drift out of sync with the buckets.
 */
export type BoardState = {
  videos: VideoId[]
  tiers: Tier[]
  pool: VideoId[]
}

export const DEFAULT_TIER_LABELS = ['S', 'A', 'B', 'C', 'D', 'F'] as const

/** Row colors cycle from hot to cold; index beyond the defaults wraps. */
export const TIER_COLORS = [
  '#ff7f7f',
  '#ffbf7f',
  '#ffdf7f',
  '#ffff7f',
  '#bfff7f',
  '#7fffff',
  '#7fbfff',
  '#bf7fff',
]

export function createEmptyBoard(): BoardState {
  return {
    videos: [],
    tiers: DEFAULT_TIER_LABELS.map((label) => ({ label, items: [] })),
    pool: [],
  }
}

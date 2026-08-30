import { describe, expect, it } from 'vitest'
import { boardOrder, boardReducer, NEW_TIER_LABEL } from './boardReducer'
import { MAX_TIERS } from '../lib/urlCodec'
import { createEmptyBoard } from '../types'
import type { BoardState } from '../types'

const A = 'aaaaaaaaaaa'
const B = 'bbbbbbbbbbb'
const C = 'ccccccccccc'

function boardWith(ids: string[]): BoardState {
  return boardReducer(createEmptyBoard(), { type: 'addVideos', ids })
}

describe('addVideos', () => {
  it('appends new ids to both the identity list and the pool', () => {
    const state = boardWith([A, B])
    expect(state.videos).toEqual([A, B])
    expect(state.pool).toEqual([A, B])
  })

  it('skips ids already on the board and ids repeated within one action', () => {
    const state = boardReducer(boardWith([A]), { type: 'addVideos', ids: [A, B, B, C] })
    expect(state.videos).toEqual([A, B, C])
    expect(state.pool).toEqual([A, B, C])
  })

  it('returns the same state when nothing is new', () => {
    const before = boardWith([A])
    expect(boardReducer(before, { type: 'addVideos', ids: [A] })).toBe(before)
  })

  it('does not mutate the previous state', () => {
    const before = boardWith([A])
    boardReducer(before, { type: 'addVideos', ids: [B] })
    expect(before.videos).toEqual([A])
    expect(before.pool).toEqual([A])
  })
})

describe('removeVideo', () => {
  it('removes an id from the pool', () => {
    const state = boardReducer(boardWith([A, B]), { type: 'removeVideo', id: A })
    expect(state.videos).toEqual([B])
    expect(state.pool).toEqual([B])
  })

  it('removes an id held by a tier', () => {
    const seeded = boardWith([A, B])
    const placed: BoardState = {
      ...seeded,
      pool: [B],
      tiers: seeded.tiers.map((tier, index) => (index === 0 ? { ...tier, items: [A] } : tier)),
    }

    const state = boardReducer(placed, { type: 'removeVideo', id: A })
    expect(state.videos).toEqual([B])
    expect(state.pool).toEqual([B])
    expect(state.tiers[0].items).toEqual([])
  })

  it('returns the same state for an unknown id', () => {
    const before = boardWith([A])
    expect(boardReducer(before, { type: 'removeVideo', id: C })).toBe(before)
  })
})

describe('moveVideo', () => {
  const tier = (state: BoardState, index: number) => state.tiers[index].items

  it('moves an id from the pool into a tier', () => {
    const state = boardReducer(boardWith([A, B]), {
      type: 'moveVideo',
      id: A,
      to: { kind: 'tier', index: 0 },
    })
    expect(state.pool).toEqual([B])
    expect(tier(state, 0)).toEqual([A])
    expect(state.videos).toEqual([A, B])
  })

  it('moves an id from one tier to another', () => {
    const first = boardReducer(boardWith([A, B]), {
      type: 'moveVideo',
      id: A,
      to: { kind: 'tier', index: 0 },
    })
    const state = boardReducer(first, { type: 'moveVideo', id: A, to: { kind: 'tier', index: 2 } })
    expect(tier(state, 0)).toEqual([])
    expect(tier(state, 2)).toEqual([A])
    expect(state.pool).toEqual([B])
  })

  it('moves an id from a tier back to the pool', () => {
    const first = boardReducer(boardWith([A, B]), {
      type: 'moveVideo',
      id: A,
      to: { kind: 'tier', index: 1 },
    })
    const state = boardReducer(first, {
      type: 'moveVideo',
      id: A,
      to: { kind: 'pool' },
      beforeId: B,
    })
    expect(tier(state, 1)).toEqual([])
    expect(state.pool).toEqual([A, B])
  })

  it('reorders within a tier, moving an id earlier', () => {
    let state = boardWith([A, B, C])
    for (const id of [A, B, C]) {
      state = boardReducer(state, { type: 'moveVideo', id, to: { kind: 'tier', index: 0 } })
    }
    expect(tier(state, 0)).toEqual([A, B, C])

    const moved = boardReducer(state, {
      type: 'moveVideo',
      id: C,
      to: { kind: 'tier', index: 0 },
      beforeId: A,
    })
    expect(tier(moved, 0)).toEqual([C, A, B])
  })

  it('reorders within a tier, moving an id later', () => {
    let state = boardWith([A, B, C])
    for (const id of [A, B, C]) {
      state = boardReducer(state, { type: 'moveVideo', id, to: { kind: 'tier', index: 0 } })
    }

    const moved = boardReducer(state, {
      type: 'moveVideo',
      id: A,
      to: { kind: 'tier', index: 0 },
      beforeId: C,
    })
    expect(tier(moved, 0)).toEqual([B, A, C])
  })

  it('sends an id to the end of the bucket it already occupies when no anchor is given', () => {
    const state = boardReducer(boardWith([A, B, C]), {
      type: 'moveVideo',
      id: A,
      to: { kind: 'pool' },
    })
    expect(state.pool).toEqual([B, C, A])
  })

  it('appends when the anchor is not in the target bucket', () => {
    const state = boardReducer(boardWith([A, B]), {
      type: 'moveVideo',
      id: A,
      to: { kind: 'tier', index: 0 },
      beforeId: C,
    })
    expect(tier(state, 0)).toEqual([A])
  })

  it('returns the same state for an unknown id', () => {
    const before = boardWith([A, B])
    expect(boardReducer(before, { type: 'moveVideo', id: C, to: { kind: 'tier', index: 0 } })).toBe(
      before,
    )
  })

  it('returns the same state for an out-of-range tier index', () => {
    const before = boardWith([A])
    expect(
      boardReducer(before, { type: 'moveVideo', id: A, to: { kind: 'tier', index: 99 } }),
    ).toBe(before)
    expect(
      boardReducer(before, { type: 'moveVideo', id: A, to: { kind: 'tier', index: -1 } }),
    ).toBe(before)
  })

  it('does not mutate the previous state', () => {
    const before = boardWith([A, B])
    boardReducer(before, { type: 'moveVideo', id: A, to: { kind: 'tier', index: 0 } })
    expect(before.pool).toEqual([A, B])
    expect(before.tiers[0].items).toEqual([])
  })
})

const labels = (state: BoardState) => state.tiers.map((tier) => tier.label)

function withTierItems(state: BoardState, index: number, items: string[]): BoardState {
  return {
    ...state,
    pool: state.pool.filter((id) => !items.includes(id)),
    tiers: state.tiers.map((tier, i) => (i === index ? { ...tier, items } : tier)),
  }
}

function boardWithTierCount(count: number): BoardState {
  return {
    ...createEmptyBoard(),
    tiers: Array.from({ length: count }, (_, i) => ({ label: `T${i}`, items: [] })),
  }
}

describe('renameTier', () => {
  it('renames a row and trims the label', () => {
    const state = boardReducer(createEmptyBoard(), {
      type: 'renameTier',
      index: 1,
      label: '  Top ',
    })
    expect(labels(state)[1]).toBe('Top')
  })

  it('refuses a blank label, leaving the previous one in place', () => {
    const before = createEmptyBoard()
    expect(boardReducer(before, { type: 'renameTier', index: 0, label: '   ' })).toBe(before)
  })

  it('returns the same state for an out-of-range index or an unchanged label', () => {
    const before = createEmptyBoard()
    expect(boardReducer(before, { type: 'renameTier', index: 99, label: 'X' })).toBe(before)
    expect(boardReducer(before, { type: 'renameTier', index: 0, label: 'S' })).toBe(before)
  })
})

describe('addTier', () => {
  it('inserts a row at the given position without disturbing the others', () => {
    const state = boardReducer(createEmptyBoard(), { type: 'addTier', index: 1 })
    expect(labels(state)).toEqual(['S', NEW_TIER_LABEL, 'A', 'B', 'C', 'D', 'F'])
  })

  it('appends when the index is the end of the list', () => {
    const before = createEmptyBoard()
    const state = boardReducer(before, { type: 'addTier', index: before.tiers.length })
    expect(labels(state).at(-1)).toBe(NEW_TIER_LABEL)
  })

  it('keeps existing placements attached to their rows', () => {
    const seeded = withTierItems(boardWith([A, B]), 0, [A])
    const state = boardReducer(seeded, { type: 'addTier', index: 0 })
    expect(state.tiers[0].items).toEqual([])
    expect(state.tiers[1].items).toEqual([A])
    expect(state.pool).toEqual([B])
  })

  it('refuses to grow past the number of tiers a share link can encode', () => {
    const full = boardWithTierCount(MAX_TIERS)
    expect(boardReducer(full, { type: 'addTier', index: MAX_TIERS })).toBe(full)

    const nearlyFull = boardWithTierCount(MAX_TIERS - 1)
    expect(boardReducer(nearlyFull, { type: 'addTier', index: 0 }).tiers).toHaveLength(MAX_TIERS)
  })

  it('returns the same state for an out-of-range index', () => {
    const before = createEmptyBoard()
    expect(boardReducer(before, { type: 'addTier', index: -1 })).toBe(before)
    expect(boardReducer(before, { type: 'addTier', index: before.tiers.length + 1 })).toBe(before)
  })
})

describe('removeTier', () => {
  it('drops the row and returns its videos to the pool', () => {
    const seeded = withTierItems(boardWith([A, B, C]), 1, [A, B])
    const state = boardReducer(seeded, { type: 'removeTier', index: 1 })

    expect(labels(state)).toEqual(['S', 'B', 'C', 'D', 'F'])
    expect(state.pool).toEqual([C, A, B])
    expect(state.videos).toEqual([A, B, C])
  })

  it('refuses to remove the last remaining tier', () => {
    const single = boardWithTierCount(1)
    expect(boardReducer(single, { type: 'removeTier', index: 0 })).toBe(single)
  })

  it('returns the same state for an out-of-range index', () => {
    const before = createEmptyBoard()
    expect(boardReducer(before, { type: 'removeTier', index: 99 })).toBe(before)
  })
})

describe('moveTier', () => {
  it('swaps a row with the one above it, items included', () => {
    const seeded = withTierItems(boardWith([A]), 1, [A])
    const state = boardReducer(seeded, { type: 'moveTier', index: 1, direction: 'up' })

    expect(labels(state)).toEqual(['A', 'S', 'B', 'C', 'D', 'F'])
    expect(state.tiers[0].items).toEqual([A])
    expect(state.tiers[1].items).toEqual([])
  })

  it('swaps a row with the one below it', () => {
    const state = boardReducer(createEmptyBoard(), {
      type: 'moveTier',
      index: 0,
      direction: 'down',
    })
    expect(labels(state)).toEqual(['A', 'S', 'B', 'C', 'D', 'F'])
  })

  it('refuses to move past either end of the board', () => {
    const before = createEmptyBoard()
    expect(boardReducer(before, { type: 'moveTier', index: 0, direction: 'up' })).toBe(before)
    expect(
      boardReducer(before, { type: 'moveTier', index: before.tiers.length - 1, direction: 'down' }),
    ).toBe(before)
  })

  it('does not mutate the previous state', () => {
    const before = createEmptyBoard()
    boardReducer(before, { type: 'moveTier', index: 0, direction: 'down' })
    expect(labels(before)).toEqual(['S', 'A', 'B', 'C', 'D', 'F'])
  })
})

describe('boardOrder', () => {
  it('walks the tiers in order and finishes with the pool', () => {
    const placed = boardReducer(boardWith([A, B, C]), {
      type: 'moveVideo',
      id: C,
      to: { kind: 'tier', index: 0 },
    })
    const withB = boardReducer(placed, { type: 'moveVideo', id: B, to: { kind: 'tier', index: 2 } })
    expect(boardOrder(withB)).toEqual([C, B, A])
  })

  it('is empty for an empty board', () => {
    expect(boardOrder(createEmptyBoard())).toEqual([])
  })
})

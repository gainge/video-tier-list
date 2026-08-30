import { describe, expect, it } from 'vitest'
import { poolShareLink, rankingShareLink, SAFE_URL_LENGTH } from './shareLinks'
import { decodeBoard } from './urlCodec'
import { DEFAULT_TIER_LABELS } from '../types'
import type { BoardState } from '../types'

const BASE = 'https://example.test/app'

const A = 'aaaaaaaaaaa'
const B = 'bbbbbbbbbbb'
const C = 'ccccccccccc'
const D = 'dddddddddd_'
const E = 'eeeeeeeeee-'

function board(partial: Partial<BoardState> = {}): BoardState {
  return {
    videos: [],
    tiers: DEFAULT_TIER_LABELS.map((label) => ({ label, items: [] })),
    pool: [],
    ...partial,
  }
}

function ranked(): BoardState {
  const state = board({ videos: [E, C, A, D, B], pool: [D] })
  state.tiers[0].items = [E, A]
  state.tiers[3].items = [C, B]
  state.pool = [D]
  return state
}

describe('poolShareLink', () => {
  it('carries no ranking', () => {
    const link = poolShareLink(ranked(), BASE)
    expect(link.url).not.toContain('r=')

    const decoded = decodeBoard(link.url.slice(link.url.indexOf('#')))!
    expect(decoded.tiers.every((tier) => tier.items.length === 0)).toBe(true)
    expect(decoded.pool).toHaveLength(5)
  })

  it('is identical for a board hydrated from that board’s ranking link', () => {
    const original = ranked()
    const rankingUrl = rankingShareLink(original, BASE).url
    const hydrated = decodeBoard(rankingUrl.slice(rankingUrl.indexOf('#')))!

    // `hydrated.videos` arrives in bucket order, which is exactly the sequence a pool link
    // must not reproduce.
    expect(hydrated.videos).not.toEqual(original.videos)
    expect(poolShareLink(hydrated, BASE).url).toBe(poolShareLink(original, BASE).url)
  })

  it('orders ids independently of how the board is bucketed', () => {
    const flat = board({ videos: [A, B, C, D, E], pool: [A, B, C, D, E] })
    expect(poolShareLink(ranked(), BASE).url).toBe(poolShareLink(flat, BASE).url)
    expect(poolShareLink(flat, BASE).url).toContain(`i=${[A, B, C, D, E].sort().join('')}`)
  })

  it('includes an id that only a tier knows about', () => {
    const drifted = board({ videos: [A], pool: [A] })
    drifted.tiers[1].items = [B]
    expect(poolShareLink(drifted, BASE).url).toContain(B)
  })
})

describe('rankingShareLink', () => {
  it('reproduces the exact placements', () => {
    const original = ranked()
    const url = rankingShareLink(original, BASE).url
    const decoded = decodeBoard(url.slice(url.indexOf('#')))!

    expect(decoded.tiers).toEqual(original.tiers)
    expect(decoded.pool).toEqual(original.pool)
    expect([...decoded.videos].sort()).toEqual([...original.videos].sort())
  })
})

describe('length reporting', () => {
  /** Everything ranked, which is the worst case the capacity estimate is built around. */
  function bigBoard(count: number): BoardState {
    const videos = Array.from({ length: count }, (_, i) => `v${String(i).padStart(10, '0')}`)
    const state = board({ videos })
    state.tiers[0].items = videos
    return state
  }

  it('reports no warning for a small board', () => {
    const link = rankingShareLink(bigBoard(10), BASE)
    expect(link.overLimit).toBe(false)
    expect(link.capacity).toBeGreaterThan(10)
  })

  it('flags a link past the safe length', () => {
    const link = rankingShareLink(bigBoard(400), BASE)
    expect(link.url.length).toBeGreaterThan(SAFE_URL_LENGTH)
    expect(link.overLimit).toBe(true)
  })

  it('reports a capacity that is exact at the boundary', () => {
    const link = rankingShareLink(bigBoard(400), BASE)

    expect(rankingShareLink(bigBoard(link.capacity), BASE).url.length).toBeLessThanOrEqual(
      SAFE_URL_LENGTH,
    )
    expect(rankingShareLink(bigBoard(link.capacity + 1), BASE).overLimit).toBe(true)
  })

  it('reports a pool capacity that is exact at the boundary', () => {
    const link = poolShareLink(bigBoard(400), BASE)
    expect(poolShareLink(bigBoard(link.capacity), BASE).overLimit).toBe(false)
    expect(poolShareLink(bigBoard(link.capacity + 1), BASE).overLimit).toBe(true)
  })
})

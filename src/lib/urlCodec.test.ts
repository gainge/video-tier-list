import { describe, expect, it } from 'vitest'
import type { BoardState } from '../types'
import { DEFAULT_TIER_LABELS } from '../types'
import { boardReducer } from '../state/boardReducer'
import { decodeBoard, encodeBoard, poolLink, rankingLink } from './urlCodec'

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

/** Every id sits in exactly one bucket and `videos` is precisely that union. */
function expectConsistent(state: BoardState): void {
  const placed = [...state.tiers.flatMap((tier) => tier.items), ...state.pool]
  expect(new Set(placed).size).toBe(placed.length)
  expect(new Set(state.videos).size).toBe(state.videos.length)
  expect([...state.videos].sort()).toEqual([...placed].sort())
}

describe('round trips', () => {
  const spread = board({
    videos: [A, B, C, D, E],
    tiers: DEFAULT_TIER_LABELS.map((label) => ({ label, items: [] })),
    pool: [D, E],
  })
  spread.tiers[0].items = [A, B]
  spread.tiers[2].items = [C]

  it('preserves tiers, pool and labels', () => {
    const decoded = decodeBoard(encodeBoard(spread))
    expect(decoded).toEqual(spread)
    expectConsistent(decoded!)
  })

  it('accepts a fragment with a leading hash', () => {
    expect(decodeBoard(`#${encodeBoard(spread)}`)).toEqual(spread)
  })

  it('drops every placement when ranking is excluded', () => {
    const fragment = encodeBoard(spread, { includeRanking: false })
    expect(fragment).not.toContain('r=')

    const decoded = decodeBoard(fragment)!
    expectConsistent(decoded)
    expect(decoded.pool).toEqual([A, B, C, D, E])
    expect(decoded.tiers.every((tier) => tier.items.length === 0)).toBe(true)
  })

  it('orders an unranked link by add order so it does not leak the ranking', () => {
    const reordered = board({ videos: [E, D, C, B, A], pool: [D, E] })
    reordered.tiers[0].items = [A, B]
    reordered.tiers[2].items = [C]
    expect(encodeBoard(reordered, { includeRanking: false })).toContain(`i=${E}${D}${C}${B}${A}`)
  })

  it('handles an empty board', () => {
    const decoded = decodeBoard(encodeBoard(board()))!
    expect(decoded).toEqual(board())
    expectConsistent(decoded)
  })
})

describe('tier labels', () => {
  it('omits t for the default labels', () => {
    expect(encodeBoard(board({ videos: [A], pool: [A] }))).not.toContain('t=')
  })

  it('round trips labels containing separator and delimiter characters', () => {
    const labels = ['a~b', '100%', 'x&y', 'k=v', 'né', 'plain']
    const custom = board({ videos: [A], tiers: labels.map((label) => ({ label, items: [] })) })
    custom.tiers[4].items = [A]

    const fragment = encodeBoard(custom)
    expect(fragment).toContain('t=')
    // A literal `~` inside a label must not read as a separator.
    expect(fragment.split('t=')[1].split('&')[0].split('~')).toHaveLength(labels.length)

    const decoded = decodeBoard(fragment)!
    expect(decoded.tiers.map((tier) => tier.label)).toEqual(labels)
    expect(decoded.tiers[4].items).toEqual([A])
    expectConsistent(decoded)
  })

  it('falls back to the default labels when t decodes to nothing', () => {
    const decoded = decodeBoard(`v=1&i=${A}&t=`)!
    expect(decoded.tiers.map((tier) => tier.label)).toEqual([...DEFAULT_TIER_LABELS])
  })

  it('does not throw on malformed percent-encoding', () => {
    const decoded = decodeBoard(`v=1&i=${A}&t=%zz~ok&r=1`)!
    expect(decoded.tiers.map((tier) => tier.label)).toEqual(['%zz', 'ok'])
    expect(decoded.tiers[1].items).toEqual([A])
    expectConsistent(decoded)
  })
})

describe('edited tier rows', () => {
  it('carries renamed and added rows through a ranking link', () => {
    let state = board({ videos: [A, B, C], pool: [A, B, C] })
    state = boardReducer(state, { type: 'renameTier', index: 0, label: 'Godlike' })
    state = boardReducer(state, { type: 'addTier', index: 1 })
    state = boardReducer(state, { type: 'renameTier', index: 1, label: 'Great' })
    state = boardReducer(state, { type: 'removeTier', index: 6 })
    state = boardReducer(state, { type: 'moveVideo', id: A, to: { kind: 'tier', index: 0 } })
    state = boardReducer(state, { type: 'moveVideo', id: B, to: { kind: 'tier', index: 1 } })

    const link = rankingLink(state, 'https://example.test/board')
    const decoded = decodeBoard(link.slice(link.indexOf('#')))!

    expect(decoded.tiers.map((tier) => tier.label)).toEqual([
      'Godlike',
      'Great',
      'A',
      'B',
      'C',
      'D',
    ])
    expect(decoded.tiers[0].items).toEqual([A])
    expect(decoded.tiers[1].items).toEqual([B])
    expect(decoded.pool).toEqual([C])
    expectConsistent(decoded)
  })
})

describe('damaged fragments', () => {
  it('drops a trailing partial id', () => {
    const decoded = decodeBoard(`v=1&i=${A}${B}abc`)!
    expect(decoded.videos).toEqual([A, B])
    expectConsistent(decoded)
  })

  it('drops an id with invalid characters but keeps the ranking aligned', () => {
    const bad = 'aaaa!aaaaaa'
    const decoded = decodeBoard(`v=1&i=${bad}${B}${C}&r=0.2`)!
    expect(decoded.videos).toEqual([B, C])
    expect(decoded.pool).toEqual([B])
    expect(decoded.tiers[2].items).toEqual([C])
    expectConsistent(decoded)
  })

  it('drops duplicate ids', () => {
    // The repeat occupies position 1, so B still reads its own ranking char at position 2.
    const decoded = decodeBoard(`v=1&i=${A}${A}${B}&r=01.`)!
    expect(decoded.videos).toEqual([A, B])
    expect(decoded.tiers[0].items).toEqual([A])
    expect(decoded.tiers[1].items).toEqual([])
    expect(decoded.pool).toEqual([B])
    expectConsistent(decoded)
  })

  it('pools the trailing ids when r is short', () => {
    const decoded = decodeBoard(`v=1&i=${A}${B}${C}&r=1`)!
    expect(decoded.tiers[1].items).toEqual([A])
    expect(decoded.pool).toEqual([B, C])
    expectConsistent(decoded)
  })

  it('ignores excess ranking characters', () => {
    const decoded = decodeBoard(`v=1&i=${A}&r=00000`)!
    expect(decoded.tiers[0].items).toEqual([A])
    expectConsistent(decoded)
  })

  it('pools an id whose ranking points past the last tier', () => {
    const decoded = decodeBoard(`v=1&i=${A}${B}&r=z0`)!
    expect(decoded.pool).toEqual([A])
    expect(decoded.tiers[0].items).toEqual([B])
    expectConsistent(decoded)
  })

  it('pools an id with an unrecognised ranking character', () => {
    const decoded = decodeBoard(`v=1&i=${A}&r=$`)!
    expect(decoded.pool).toEqual([A])
  })
})

describe('nothing decodable', () => {
  it('returns null for an unknown version', () => {
    expect(decodeBoard(`v=2&i=${A}`)).toBeNull()
  })

  it('returns null for empty fragments', () => {
    expect(decodeBoard('')).toBeNull()
    expect(decodeBoard('#')).toBeNull()
  })

  it('returns null for garbage', () => {
    expect(decodeBoard('#some-anchor')).toBeNull()
    expect(decodeBoard('a=b&c=d')).toBeNull()
  })
})

describe('links', () => {
  const state = board({ videos: [A, B], pool: [B] })
  state.tiers[0].items = [A]

  it('replaces an existing hash on the injected base', () => {
    expect(rankingLink(state, 'https://x.test/app?q=1#old')).toBe(
      `https://x.test/app?q=1#${encodeBoard(state)}`,
    )
  })

  it('builds a pool link without a ranking', () => {
    expect(poolLink(state, 'https://x.test/')).toBe(
      `https://x.test/#${encodeBoard(state, { includeRanking: false })}`,
    )
  })

  it('defaults the base to the current location', () => {
    expect(rankingLink(state).startsWith(window.location.href.split('#')[0] + '#')).toBe(true)
  })
})

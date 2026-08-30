import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearBoard, flushBoard, loadBoard, parseBoard, saveBoard } from './storage'
import { DEFAULT_TIER_LABELS } from '../types'
import type { BoardState } from '../types'

const KEY = 'vtl.board.v1'

const A = 'aaaaaaaaaaa'
const B = 'bbbbbbbbbbb'
const C = 'ccccccccccc'

function board(partial: Partial<BoardState> = {}): BoardState {
  return {
    videos: [],
    tiers: DEFAULT_TIER_LABELS.map((label) => ({ label, items: [] })),
    pool: [],
    ...partial,
  }
}

beforeEach(() => {
  localStorage.clear()
  clearBoard()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('saveBoard', () => {
  it('writes only after the debounce window', () => {
    saveBoard(board({ videos: [A], pool: [A] }))
    expect(localStorage.getItem(KEY)).toBeNull()

    vi.runAllTimers()
    expect(loadBoard()).toEqual(board({ videos: [A], pool: [A] }))
  })

  it('keeps only the last board of a burst', () => {
    saveBoard(board({ videos: [A], pool: [A] }))
    saveBoard(board({ videos: [A, B], pool: [A, B] }))
    vi.runAllTimers()

    expect(loadBoard()?.videos).toEqual([A, B])
  })

  it('round trips tier placements', () => {
    const ranked = board({ videos: [A, B, C], pool: [C] })
    ranked.tiers[0].items = [A]
    ranked.tiers[2].items = [B]

    saveBoard(ranked)
    flushBoard()

    expect(loadBoard()).toEqual(ranked)
  })

  it('stores an empty board as no saved board', () => {
    saveBoard(board({ videos: [A], pool: [A] }))
    vi.runAllTimers()

    saveBoard(board())
    vi.runAllTimers()

    expect(localStorage.getItem(KEY)).toBeNull()
    expect(loadBoard()).toBeNull()
  })

  it('survives a storage that refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })

    saveBoard(board({ videos: [A], pool: [A] }))
    expect(() => vi.runAllTimers()).not.toThrow()
  })
})

describe('clearBoard', () => {
  it('drops a pending save along with the stored board', () => {
    saveBoard(board({ videos: [A], pool: [A] }))
    vi.runAllTimers()

    saveBoard(board({ videos: [A, B], pool: [A, B] }))
    clearBoard()
    vi.runAllTimers()

    expect(loadBoard()).toBeNull()
  })
})

describe('loadBoard', () => {
  it('returns null when nothing was saved', () => {
    expect(loadBoard()).toBeNull()
  })

  it('returns null for junk that is not JSON', () => {
    localStorage.setItem(KEY, 'not json {')
    expect(loadBoard()).toBeNull()
  })

  it('returns null when reading throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadBoard()).toBeNull()
  })
})

describe('parseBoard', () => {
  it.each([
    ['a primitive', 42],
    ['null', null],
    ['an array', [A, B]],
    ['a board with no tiers', { videos: [A], tiers: [], pool: [A] }],
    ['tiers that are not objects', { videos: [A], tiers: ['S', 'A'], pool: [A] }],
    ['a tier missing its items', { videos: [A], tiers: [{ label: 'S' }], pool: [A] }],
    ['non-string ids', { videos: [1, 2], tiers: [{ label: 'S', items: [] }], pool: [] }],
    ['an older shape', { items: [A], ranks: { [A]: 0 } }],
  ])('rejects %s', (_name, stored) => {
    expect(parseBoard(stored)).toBeNull()
  })

  it('repairs an id claimed by two buckets', () => {
    const parsed = parseBoard({
      videos: [A, B],
      tiers: [
        { label: 'S', items: [A] },
        { label: 'A', items: [A, B] },
      ],
      pool: [A],
    })

    expect(parsed).toEqual({
      videos: [A, B],
      tiers: [
        { label: 'S', items: [A] },
        { label: 'A', items: [B] },
      ],
      pool: [],
    })
  })

  it('pools an id that no bucket claims and drops one no bucket knows', () => {
    const parsed = parseBoard({
      videos: [A, B],
      tiers: [{ label: 'S', items: [C] }],
      pool: [],
    })

    expect(parsed).toEqual({
      videos: [A, B],
      tiers: [{ label: 'S', items: [] }],
      pool: [A, B],
    })
  })

  it('drops a duplicated video id', () => {
    expect(
      parseBoard({ videos: [A, A], tiers: [{ label: 'S', items: [] }], pool: [A, A] }),
    ).toEqual({ videos: [A], tiers: [{ label: 'S', items: [] }], pool: [A] })
  })
})

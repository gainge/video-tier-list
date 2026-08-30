import { describe, expect, it } from 'vitest'
import { countUnranked, createPlayQueue, stepQueue } from './playQueue'
import type { BoardState } from '../types'

function board(tiers: string[][], pool: string[]): BoardState {
  return {
    videos: [...tiers.flat(), ...pool],
    tiers: tiers.map((items, index) => ({ label: `T${index}`, items })),
    pool,
  }
}

/** Placing a video the way the modal's rank buttons do. */
function place(state: BoardState, id: string, tierIndex: number): BoardState {
  return {
    videos: state.videos,
    tiers: state.tiers.map((tier, index) => ({
      ...tier,
      items: index === tierIndex ? [...tier.items, id] : tier.items.filter((it) => it !== id),
    })),
    pool: state.pool.filter((it) => it !== id),
  }
}

describe('createPlayQueue', () => {
  it('queues only the pool when opened from an unranked video', () => {
    const state = board([['a'], ['b']], ['c', 'd'])
    expect(createPlayQueue(state, 'c')).toEqual({ ids: ['c', 'd'], fromPool: true })
  })

  it('queues the whole board when opened from a ranked video', () => {
    const state = board([['a'], ['b']], ['c'])
    expect(createPlayQueue(state, 'a')).toEqual({ ids: ['a', 'b', 'c'], fromPool: false })
  })

  it('is a snapshot, not a view of the live board', () => {
    const state = board([[]], ['c', 'd'])
    const queue = createPlayQueue(state, 'c')
    const after = place(state, 'c', 0)
    expect(queue.ids).toEqual(['c', 'd'])
    expect(stepQueue(queue, after, 'c', 1)).toBe('d')
  })
})

describe('stepQueue', () => {
  it('advances to the next unranked video after the current one is placed', () => {
    const state = board([[]], ['c', 'd', 'e'])
    const queue = createPlayQueue(state, 'c')
    expect(stepQueue(queue, place(state, 'c', 0), 'c', 1)).toBe('d')
  })

  it('keeps its footing across a run of placements', () => {
    let state = board([[], []], ['c', 'd', 'e'])
    const queue = createPlayQueue(state, 'c')

    state = place(state, 'c', 0)
    const second = stepQueue(queue, state, 'c', 1)
    expect(second).toBe('d')

    state = place(state, 'd', 1)
    expect(stepQueue(queue, state, 'd', 1)).toBe('e')
  })

  it('skips already-placed videos when wrapping a pool queue', () => {
    let state = board([[]], ['c', 'd', 'e'])
    const queue = createPlayQueue(state, 'c')
    state = place(state, 'c', 0)
    state = place(state, 'd', 0)
    // From the end of the queue, 'c' and 'd' are done — 'e' is the only stop left.
    expect(stepQueue(queue, state, 'e', 1)).toBe('e')
  })

  it('falls back to the positional neighbour when nothing is left unranked', () => {
    let state = board([[]], ['c', 'd'])
    const queue = createPlayQueue(state, 'c')
    state = place(state, 'c', 0)
    state = place(state, 'd', 0)
    expect(stepQueue(queue, state, 'c', 1)).toBe('d')
  })

  it('steps backward without skipping, so a placed video can be revisited', () => {
    let state = board([[]], ['c', 'd', 'e'])
    const queue = createPlayQueue(state, 'c')
    state = place(state, 'c', 0)
    expect(stepQueue(queue, state, 'd', -1)).toBe('c')
  })

  it('wraps in both directions', () => {
    const state = board([[]], ['c', 'd', 'e'])
    const queue = createPlayQueue(state, 'c')
    expect(stepQueue(queue, state, 'e', 1)).toBe('c')
    expect(stepQueue(queue, state, 'c', -1)).toBe('e')
  })

  it('does not skip in a board queue, where placed videos are the point', () => {
    const state = board([['a', 'b']], [])
    const queue = createPlayQueue(state, 'a')
    expect(stepQueue(queue, state, 'a', 1)).toBe('b')
  })

  it('returns null when the queue cannot move', () => {
    const state = board([[]], ['c'])
    const queue = createPlayQueue(state, 'c')
    expect(stepQueue(queue, state, 'c', 1)).toBeNull()
    expect(stepQueue(createPlayQueue(board([[]], ['c', 'd']), 'c'), state, 'zz', 1)).toBeNull()
  })
})

describe('countUnranked', () => {
  it('counts only queue members still in the pool', () => {
    let state = board([[]], ['c', 'd', 'e'])
    const queue = createPlayQueue(state, 'c')
    expect(countUnranked(queue, state)).toBe(3)
    state = place(state, 'c', 0)
    expect(countUnranked(queue, state)).toBe(2)
  })
})

import { boardOrder } from './boardReducer'
import type { BoardState, VideoId } from '../types'

/**
 * The order the player's prev/next buttons walk, frozen when the modal opens.
 *
 * Placing a video from inside the modal moves it out of the pool, so an order derived from
 * the live board would reshuffle underneath the user mid-session: "next" from a video they
 * just ranked would jump to whatever now follows it in its new tier — material they have
 * already been through — instead of continuing to the next unranked video. Freezing the
 * order at open makes navigation depend only on where the user started.
 */
export type PlayQueue = {
  ids: VideoId[]
  /**
   * Whether the session started from an unranked video. Opening from the pool means
   * "work through what I haven't ranked yet"; opening from a tier means "browse the
   * board I've already built". The two want different queues.
   */
  fromPool: boolean
}

export function createPlayQueue(board: BoardState, videoId: VideoId): PlayQueue {
  const fromPool = board.pool.includes(videoId)
  return { ids: fromPool ? [...board.pool] : boardOrder(board), fromPool }
}

function isUnranked(board: BoardState, id: VideoId): boolean {
  return board.pool.includes(id)
}

/** How many of the queue's videos are still waiting to be placed. */
export function countUnranked(queue: PlayQueue, board: BoardState): number {
  return queue.ids.reduce((total, id) => (isUnranked(board, id) ? total + 1 : total), 0)
}

/**
 * The next video to play, or null when the queue cannot move.
 *
 * Wrapping rather than stopping at the ends keeps the control alive at the boundary. Going
 * forward through an unranked queue skips videos that have since been placed, so working to
 * the end and wrapping lands on something still needing attention rather than replaying the
 * ones just ranked. Going backward never skips — returning to the video you just placed is
 * how you change your mind about it.
 */
export function stepQueue(
  queue: PlayQueue,
  board: BoardState,
  current: VideoId,
  delta: number,
): VideoId | null {
  const { ids, fromPool } = queue
  if (ids.length < 2) return null

  const at = ids.indexOf(current)
  if (at === -1) return null

  const advance = (index: number) => (index + delta + ids.length) % ids.length

  let index = advance(at)
  if (fromPool && delta > 0) {
    // A full lap lands back on the positional neighbour, so an all-ranked queue still moves.
    for (let hops = 0; hops < ids.length && !isUnranked(board, ids[index]); hops++) {
      index = advance(index)
    }
  }

  return ids[index]
}

import { poolLink, rankingLink } from './urlCodec'
import type { BoardState, VideoId } from '../types'

/**
 * Beyond this, mail clients, chat apps and older proxies start truncating URLs. Nothing
 * breaks at exactly 2000 characters, so it is a warning threshold rather than a hard cap.
 */
export const SAFE_URL_LENGTH = 2000

/**
 * Fixed-width ids: 11 chars in `i`, plus one ranking char in `r` for a ranking link. A
 * ranking link is costed as if every video ends up ranked, so the reported capacity stays
 * honest once the recipient's board is actually full.
 */
const POOL_COST_PER_VIDEO = 11
const RANKING_COST_PER_VIDEO = 12

export type ShareLink = {
  url: string
  /** How many videos this link would hold before crossing SAFE_URL_LENGTH. */
  capacity: number
  overLimit: boolean
}

/**
 * A pool link must carry no trace of the ranking, and the id sequence is the last place it
 * could hide. Sorting by id makes the sequence a function of the id set alone, which holds
 * whether the board was built by hand or hydrated from someone else's ranking link — the
 * latter arrives with `videos` already in bucket order, so an add-order fallback would
 * faithfully re-encode the grouping it is supposed to hide.
 */
function unrankedBoard(state: BoardState): BoardState {
  const ids: VideoId[] = [
    ...new Set([...state.videos, ...state.tiers.flatMap((tier) => tier.items), ...state.pool]),
  ].sort()
  return {
    videos: ids,
    tiers: state.tiers.map((tier) => ({ label: tier.label, items: [] })),
    pool: ids,
  }
}

function measure(url: string, videoCount: number, costPerVideo: number): ShareLink {
  const overhead = url.length - videoCount * costPerVideo
  return {
    url,
    capacity: Math.max(0, Math.floor((SAFE_URL_LENGTH - overhead) / costPerVideo)),
    overLimit: url.length > SAFE_URL_LENGTH,
  }
}

export function poolShareLink(state: BoardState, base?: string): ShareLink {
  const normalized = unrankedBoard(state)
  return measure(poolLink(normalized, base), normalized.videos.length, POOL_COST_PER_VIDEO)
}

export function rankingShareLink(state: BoardState, base?: string): ShareLink {
  return measure(rankingLink(state, base), state.videos.length, RANKING_COST_PER_VIDEO)
}

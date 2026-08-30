import type { BoardState, Tier, VideoId } from '../types'
import { DEFAULT_TIER_LABELS } from '../types'

/**
 * Board state travels in the hash fragment rather than the query string: fragments are
 * never sent to the server, so they stay out of access logs and out of proxy limits on
 * query length.
 *
 *   #v=1&i=<ids>&t=<labels>&r=<ranking>
 *
 * `i` concatenates fixed-width 11-char YouTube ids with no separator, `t` carries the
 * tier labels only when they differ from the defaults, and `r` carries one base36 char
 * per id positionally matched to `i`.
 */

const VERSION = '1'
const ID_LENGTH = 11
const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const LABEL_SEPARATOR = '~'
const UNRANKED = '.'

/** One ranking char is one base36 digit, so 36 tiers is the ceiling the format allows. */
export const MAX_TIERS = 36

type EncodeOptions = { includeRanking?: boolean }

function isValidId(id: string): boolean {
  return ID_PATTERN.test(id)
}

/**
 * Labels are percent-encoded individually and then joined with `~`. Encoding per label
 * rather than encoding the joined string as a whole is what makes a label containing the
 * separator survive: `encodeURIComponent` leaves `~` alone, so it is escaped explicitly
 * afterwards and the only bare `~` left in `t` is a real separator. Everything else that
 * could confuse the fragment parser (`&`, `=`, `%`, non-ASCII) is already escaped by
 * `encodeURIComponent`.
 */
function encodeLabels(labels: string[]): string {
  return labels.map((label) => encodeURIComponent(label).replace(/~/g, '%7E')).join(LABEL_SEPARATOR)
}

/** A hand-edited or truncated link can carry `%zz`; the raw text beats throwing. */
function safeDecodeComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function decodeLabels(value: string): string[] {
  return value
    .split(LABEL_SEPARATOR)
    .map(safeDecodeComponent)
    .filter((label) => label.length > 0)
}

function isDefaultLabels(labels: string[]): boolean {
  return (
    labels.length === DEFAULT_TIER_LABELS.length &&
    labels.every((label, i) => label === DEFAULT_TIER_LABELS[i])
  )
}

/** Accepts upper case too, since links get retyped and hand-edited. */
function parseRankChar(char: string): number {
  const code = char.charCodeAt(0)
  if (code >= 48 && code <= 57) return code - 48
  if (code >= 97 && code <= 122) return code - 87
  if (code >= 65 && code <= 90) return code - 55
  return -1
}

/**
 * Collects the board's ids in bucket order (tiers top to bottom, then the pool) alongside
 * the tier each one sits in. Ids reachable only through `videos` are treated as pooled so
 * a state that drifted out of its invariant still encodes to something coherent.
 */
function collectPlacements(state: BoardState): { order: VideoId[]; tierOf: Map<VideoId, number> } {
  const order: VideoId[] = []
  const tierOf = new Map<VideoId, number>()
  const seen = new Set<VideoId>()

  const push = (id: VideoId, tier: number) => {
    if (!isValidId(id) || seen.has(id)) return
    seen.add(id)
    order.push(id)
    if (tier >= 0 && tier < MAX_TIERS) tierOf.set(id, tier)
  }

  state.tiers.forEach((tier, index) => tier.items.forEach((id) => push(id, index)))
  state.pool.forEach((id) => push(id, -1))
  state.videos.forEach((id) => push(id, -1))

  return { order, tierOf }
}

export function encodeBoard(state: BoardState, opts: EncodeOptions = {}): string {
  const includeRanking = opts.includeRanking !== false
  const { order, tierOf } = collectPlacements(state)

  // A pool-only link is meant to hide the ranking, but bucket order would leak it back
  // through the id sequence, so unranked links fall back to the board's add order.
  const ids = includeRanking ? order : sortByAddOrder(order, state.videos)

  const parts = [`v=${VERSION}`]
  if (ids.length > 0) parts.push(`i=${ids.join('')}`)

  const labels = state.tiers.map((tier) => tier.label)
  if (!isDefaultLabels(labels)) parts.push(`t=${encodeLabels(labels)}`)

  if (includeRanking && ids.length > 0) {
    const ranking = ids
      .map((id) => {
        const tier = tierOf.get(id)
        return tier === undefined ? UNRANKED : tier.toString(36)
      })
      .join('')
    // An all-unranked ranking carries no information, so a pool-only board omits `r`.
    if (ranking !== UNRANKED.repeat(ids.length)) parts.push(`r=${ranking}`)
  }

  return parts.join('&')
}

function sortByAddOrder(order: VideoId[], videos: VideoId[]): VideoId[] {
  const known = new Set(order)
  const result: VideoId[] = []
  const placed = new Set<VideoId>()
  for (const id of videos) {
    if (!known.has(id) || placed.has(id)) continue
    placed.add(id)
    result.push(id)
  }
  for (const id of order) {
    if (!placed.has(id)) result.push(id)
  }
  return result
}

function parseParams(raw: string): Map<string, string> {
  const params = new Map<string, string>()
  for (const part of raw.split('&')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq)
    if (!params.has(key)) params.set(key, part.slice(eq + 1))
  }
  return params
}

/**
 * Extracts whatever ids parse cleanly, remembering each one's position in the original
 * string: `r` is indexed by the encoded position, so dropping a corrupt id must not shift
 * the ranking of the ids after it.
 */
function parseIds(value: string): { id: VideoId; position: number }[] {
  const complete = value.length - (value.length % ID_LENGTH)
  const result: { id: VideoId; position: number }[] = []
  const seen = new Set<VideoId>()
  for (let i = 0; i < complete; i += ID_LENGTH) {
    const id = value.slice(i, i + ID_LENGTH)
    if (!isValidId(id) || seen.has(id)) continue
    seen.add(id)
    result.push({ id, position: i / ID_LENGTH })
  }
  return result
}

export function decodeBoard(fragment: string): BoardState | null {
  const raw = fragment.startsWith('#') ? fragment.slice(1) : fragment
  if (raw.length === 0) return null

  const params = parseParams(raw)
  const version = params.get('v')
  if (version !== undefined && version !== VERSION) return null

  const idsValue = params.get('i')
  const labelsValue = params.get('t')
  if (version === undefined && idsValue === undefined && labelsValue === undefined) return null

  const labels = labelsValue === undefined ? [] : decodeLabels(labelsValue)
  const tiers: Tier[] = (labels.length > 0 ? labels : [...DEFAULT_TIER_LABELS]).map((label) => ({
    label,
    items: [],
  }))

  const ranking = params.get('r') ?? ''
  const pool: VideoId[] = []
  const videos: VideoId[] = []

  for (const { id, position } of parseIds(idsValue ?? '')) {
    videos.push(id)
    const tierIndex = parseRankChar(ranking[position] ?? UNRANKED)
    // An index past the last decoded tier means the link outlived the tier it referenced.
    if (tierIndex >= 0 && tierIndex < tiers.length) tiers[tierIndex].items.push(id)
    else pool.push(id)
  }

  return { videos, tiers, pool }
}

function baseWithoutHash(base?: string): string {
  const href = base ?? (typeof window === 'undefined' ? '' : window.location.href)
  const hash = href.indexOf('#')
  return hash < 0 ? href : href.slice(0, hash)
}

export function poolLink(state: BoardState, base?: string): string {
  return `${baseWithoutHash(base)}#${encodeBoard(state, { includeRanking: false })}`
}

export function rankingLink(state: BoardState, base?: string): string {
  return `${baseWithoutHash(base)}#${encodeBoard(state, { includeRanking: true })}`
}

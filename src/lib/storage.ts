import type { BoardState, Tier, VideoId } from '../types'

/**
 * Autosave is the continuous persistence path: the board is written here on every edit,
 * while the URL is only ever written when the user explicitly asks for a share link.
 *
 * The key carries a version so a future shape change can ship without having to make
 * today's blobs forward compatible — an unreadable blob simply means "no saved board".
 */
const STORAGE_KEY = 'vtl.board.v1'

/** Long enough to swallow a burst of drag reorders, short enough to survive a tab close. */
const SAVE_DELAY_MS = 400

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parseTier(value: unknown): Tier | null {
  if (!value || typeof value !== 'object') return null
  const { label, items } = value as { label?: unknown; items?: unknown }
  if (typeof label !== 'string' || !isStringArray(items)) return null
  return { label, items }
}

/** Ids the board already accounts for are skipped, so a duplicated id lands in one bucket. */
function takeKnown(items: string[], known: Set<VideoId>, used: Set<VideoId>): VideoId[] {
  const result: VideoId[] = []
  for (const id of items) {
    if (!known.has(id) || used.has(id)) continue
    used.add(id)
    result.push(id)
  }
  return result
}

/**
 * Structural mismatches are rejected outright, but a blob whose buckets have drifted out of
 * the "every id sits in exactly one bucket" invariant is repaired rather than thrown away:
 * the placements are worth keeping and the rest of the app depends on that invariant holding.
 */
export function parseBoard(value: unknown): BoardState | null {
  if (!value || typeof value !== 'object') return null

  const { videos, tiers, pool } = value as { videos?: unknown; tiers?: unknown; pool?: unknown }
  if (!isStringArray(videos) || !isStringArray(pool) || !Array.isArray(tiers)) return null

  const parsedTiers: Tier[] = []
  for (const tier of tiers) {
    const parsed = parseTier(tier)
    if (!parsed) return null
    parsedTiers.push(parsed)
  }
  if (parsedTiers.length === 0) return null

  const known = new Set<VideoId>()
  const canonical: VideoId[] = []
  for (const id of videos) {
    if (id.length === 0 || known.has(id)) continue
    known.add(id)
    canonical.push(id)
  }
  // A board with nothing on it is indistinguishable from never having saved one.
  if (canonical.length === 0) return null

  const used = new Set<VideoId>()
  const repairedTiers = parsedTiers.map((tier) => ({
    label: tier.label,
    items: takeKnown(tier.items, known, used),
  }))
  const repairedPool = [...takeKnown(pool, known, used), ...canonical.filter((id) => !used.has(id))]

  return { videos: canonical, tiers: repairedTiers, pool: repairedPool }
}

export function loadBoard(): BoardState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return parseBoard(JSON.parse(raw))
  } catch {
    // Storage is unavailable or holds junk; starting empty beats refusing to load.
    return null
  }
}

let timer: ReturnType<typeof setTimeout> | null = null
let pending: BoardState | null = null

function write(state: BoardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota or privacy-mode failures only cost the board across reloads.
  }
}

function remove(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do: the read path treats an unreadable blob as no saved board anyway.
  }
}

/** Writes the pending board immediately, if there is one. */
export function flushBoard(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  if (pending === null) return
  const state = pending
  pending = null
  write(state)
}

export function saveBoard(state: BoardState): void {
  // An empty board is stored as the absence of a board so a reset leaves nothing behind.
  if (state.videos.length === 0) {
    clearBoard()
    return
  }
  pending = state
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(flushBoard, SAVE_DELAY_MS)
}

export function clearBoard(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  pending = null
  remove()
}

// A tab closed or backgrounded mid-debounce would otherwise drop the last edit.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushBoard)
}

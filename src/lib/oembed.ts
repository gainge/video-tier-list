import { useEffect, useState } from 'react'
import { watchUrl } from './youtube'

const STORAGE_KEY = 'vtl.titles.v1'

const memoryCache = new Map<string, string>()
const inFlight = new Map<string, Promise<string | null>>()

/**
 * Failures are remembered briefly but never persisted. A deleted or private video would
 * otherwise re-request on every remount — and a tile remounts on every drag — while a
 * permanent negative cache would strand a video behind one transient network blip.
 */
const failures = new Map<string, number>()
const FAILURE_TTL_MS = 5 * 60 * 1000

function recentlyFailed(id: string): boolean {
  const failedAt = failures.get(id)
  if (failedAt === undefined) return false
  if (Date.now() - failedAt < FAILURE_TTL_MS) return true
  failures.delete(id)
  return false
}

function noTitle(id: string): null {
  failures.set(id, Date.now())
  return null
}

function loadPersisted(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return
    for (const [id, title] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof title === 'string') memoryCache.set(id, title)
    }
  } catch {
    // Storage is unavailable or holds junk; the memory cache alone is still correct.
  }
}

loadPersisted()

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(memoryCache)))
  } catch {
    // Quota or privacy-mode failures only cost us the cache across reloads.
  }
}

export function getCachedTitle(id: string): string | null {
  return memoryCache.get(id) ?? null
}

/**
 * Resolves to null for any failure — private, deleted, offline, or garbage responses all
 * mean "no title available", and callers fall back to showing the raw id.
 */
export function fetchTitle(id: string): Promise<string | null> {
  const cached = memoryCache.get(id)
  if (cached !== undefined) return Promise.resolve(cached)
  if (recentlyFailed(id)) return Promise.resolve(null)

  const pending = inFlight.get(id)
  if (pending) return pending

  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(id))}&format=json`

  const request = (async () => {
    try {
      const response = await fetch(endpoint)
      if (!response.ok) return noTitle(id)
      const data: unknown = await response.json()
      const title = (data as { title?: unknown } | null)?.title
      if (typeof title !== 'string' || !title) return noTitle(id)
      failures.delete(id)
      memoryCache.set(id, title)
      persist()
      return title
    } catch {
      return noTitle(id)
    } finally {
      inFlight.delete(id)
    }
  })()

  inFlight.set(id, request)
  return request
}

export function useVideoTitle(id: string): string | null {
  const [title, setTitle] = useState<string | null>(() => getCachedTitle(id))

  useEffect(() => {
    const cached = getCachedTitle(id)
    if (cached !== null) {
      setTitle(cached)
      return
    }

    let active = true
    setTitle(null)
    void fetchTitle(id).then((resolved) => {
      if (active) setTitle(resolved)
    })

    return () => {
      active = false
    }
  }, [id])

  return title
}

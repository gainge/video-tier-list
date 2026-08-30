const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

/** Path prefixes that carry the id as the next segment, across every YouTube surface. */
const PATH_PREFIXES = ['shorts', 'embed', 'live', 'v', 'e']

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be'])

function validId(candidate: string | null | undefined): string | null {
  return candidate && ID_PATTERN.test(candidate) ? candidate : null
}

/**
 * Accepts any of the YouTube link shapes a user is likely to paste, or a bare id.
 * Returns null rather than guessing, so callers can report the offending input.
 */
export function parseVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const bare = validId(trimmed)
  if (bare) return bare

  // Bare `youtu.be/ID` and `youtube.com/...` pastes lack a scheme that URL requires.
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  const host = url.hostname.toLowerCase()
  const segments = url.pathname.split('/').filter(Boolean)

  if (SHORT_HOSTS.has(host)) return validId(segments[0])

  if (!YOUTUBE_HOSTS.has(host)) return null

  if (segments[0] === 'watch') return validId(url.searchParams.get('v'))
  if (segments.length > 1 && PATH_PREFIXES.includes(segments[0])) return validId(segments[1])

  return null
}

export function thumbnailUrl(id: string): string {
  // hqdefault exists for every video; maxresdefault 404s for anything not uploaded in HD.
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

export function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

export function embedUrl(id: string, { autoplay }: { autoplay?: boolean } = {}): string {
  const params = autoplay ? 'rel=0&autoplay=1' : 'rel=0'
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`
}

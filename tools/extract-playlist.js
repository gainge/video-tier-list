/*
 * Paste this into the DevTools console on a YouTube playlist page
 * (youtube.com/playlist?list=...) or on a watch page with the playlist panel open.
 *
 * It scrolls the playlist until YouTube stops loading more, collects every video id,
 * and copies the result to the clipboard ready to paste into the "Add videos" dialog.
 *
 * It reads the rendered page, so it sees exactly what your signed-in session sees —
 * including private videos in your own playlists. No API key, no quota.
 */
;(async () => {
  // 'ids' pastes shortest; 'urls' is easier to eyeball before pasting.
  const FORMAT = 'ids'

  // Set this to your deployed app to also get a ready-made pool link.
  const APP_URL = 'https://gainge.github.io/video-tier-list/'

  const SETTLE_ROUNDS = 3 // consecutive no-growth scrolls before we call it done
  const ROUND_MS = 700
  const TIMEOUT_MS = 180_000

  const ITEM_SELECTOR = [
    'ytd-playlist-video-renderer', // playlist page
    'ytd-playlist-panel-video-renderer', // watch-page side panel
  ].join(',')

  const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

  const collect = () => {
    const ids = new Map() // insertion order is playlist order
    for (const item of document.querySelectorAll(ITEM_SELECTOR)) {
      const anchor = item.querySelector('a[href*="watch?v="]')
      if (!anchor) continue // unavailable/deleted rows render without a link
      const id = new URL(anchor.href, location.origin).searchParams.get('v')
      if (id && ID_PATTERN.test(id) && !ids.has(id)) {
        ids.set(id, item.querySelector('#video-title')?.textContent?.trim() ?? '')
      }
    }
    return ids
  }

  /*
   * The playlist page scrolls the window, but the watch-page panel is its own overflow
   * box — scrolling the window there loads nothing. Walk up from a real item to find
   * whichever element actually owns the scrollbar.
   */
  const scroller = () => {
    let node = document.querySelector(ITEM_SELECTOR)
    while (node && node !== document.body) {
      const { overflowY } = getComputedStyle(node)
      if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) return node
      node = node.parentElement
    }
    return document.scrollingElement || document.documentElement
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const target = scroller()
  const scrollsWindow = target === document.scrollingElement || target === document.documentElement
  const deadline = Date.now() + TIMEOUT_MS

  let ids = collect()
  if (ids.size === 0) {
    console.warn(
      'No playlist items found. Open a playlist page, or open the playlist panel on a watch page, then rerun.',
    )
    return
  }

  console.log(
    `Loading playlist… ${ids.size} so far (scrolling ${scrollsWindow ? 'page' : 'panel'})`,
  )

  let stable = 0
  while (stable < SETTLE_ROUNDS && Date.now() < deadline) {
    if (scrollsWindow) window.scrollTo(0, document.body.scrollHeight)
    else target.scrollTop = target.scrollHeight

    await sleep(ROUND_MS)

    const next = collect()
    if (next.size > ids.size) {
      console.log(`  …${next.size}`)
      stable = 0
    } else {
      stable++
    }
    ids = next
  }

  if (Date.now() >= deadline) {
    console.warn('Stopped at the time limit — the list may be incomplete. Rerun to continue.')
  }

  const list = [...ids.keys()]
  const output = list.map((id) => (FORMAT === 'urls' ? `https://youtu.be/${id}` : id)).join('\n')

  console.log(`\n${list.length} videos found.\n`)
  console.table([...ids].map(([id, title]) => ({ id, title })))

  /*
   * Always print the raw list. The console's `copy` helper is unavailable in some
   * consoles and silently refuses in others when the page lacks focus, so the
   * selectable text is the reliable path and the clipboard is a bonus.
   */
  console.log(`\nPaste this into the "Add videos" dialog:\n\n${output}\n`)

  try {
    if (typeof copy === 'function') {
      copy(output)
      console.log('(Also copied to the clipboard.)')
    }
  } catch {
    // Falls through to the printed list above.
  }

  // Pool links concatenate ids with no separator, so the whole board is one URL.
  console.log(`\nPool link:\n${APP_URL}#v=1&i=${list.join('')}`)

  return output
})()

# Video Tier List

A tiermaker-style ranking board where the ranked items are YouTube videos rather than
static images. Tiles can be opened and watched in a modal while you rank, so the videos
can be experienced during the ranking rather than only recalled.

## Why it looks like this

**No backend.** The app is a static bundle. Everything shareable travels in the URL, which
is what makes the whole thing deployable to GitHub Pages and free to run.

**State lives in the hash fragment**, not the query string — it never reaches a server log
and it sidesteps proxy query-length handling. YouTube ids are exactly 11 characters from a
fixed alphabet, so the id list is concatenated with no separator and parsed by fixed-width
slicing. Tier labels are omitted from the URL entirely when they match the S–F default, and
the ranking string is omitted for a "rank this yourself" link. See `src/lib/urlCodec.ts`.

**Two share links.** *Share pool* hands someone an unranked board — an invitation. *Share
ranking* hands them the finished placement — a result. Same codec, one optional field.

**Metadata is fetched, not stored.** Thumbnails come from `i.ytimg.com` and titles from
YouTube's CORS-enabled oEmbed endpoint, both without an API key. Titles are never written
into the URL because they would dominate its length; a video whose title can't be fetched
falls back to showing its id.

**The player's queue is frozen when it opens.** Ranking a video from inside the player
moves it out of the pool, so navigation driven by the live board would reshuffle underneath
you: "next" from a video you just placed would follow it into its new tier — material you
have already worked through — instead of continuing to the next unranked video. The queue is
snapshotted at open, and where you entered from decides what is in it: from the pool you get
the unranked queue, from a tier you get the whole board to browse. Going forward through an
unranked queue skips what has since been placed; going back never skips, because returning to
the video you just placed is how you change your mind about it. See `src/state/playQueue.ts`.

**One list owns each id.** `BoardState` keeps every video in exactly one bucket — a tier's
`items` or the pool. Membership *is* the placement, so there is no parallel index to drift
out of sync.

## Development

```sh
npm install
npm run dev      # dev server
npm run test     # vitest
npm run build    # type-check + production bundle
npm run preview  # serve the production bundle
```

The Vite `base` is set to `/video-tier-list/` for GitHub Pages; `npm run preview` is the
way to confirm asset paths before deploying. Pushes to `main` build and publish via
`.github/workflows/deploy.yml`.

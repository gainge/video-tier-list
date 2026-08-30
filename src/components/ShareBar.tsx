import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { exportBoardPng } from '../lib/exportImage'
import { poolShareLink, rankingShareLink, SAFE_URL_LENGTH } from '../lib/shareLinks'
import type { ShareLink } from '../lib/shareLinks'
import type { BoardState } from '../types'

type ShareBarProps = {
  board: BoardState
  boardRef: RefObject<HTMLElement | null>
  onReset: () => void
}

const EXPORT_FILENAME = 'tier-list.png'

type LinkKind = 'pool' | 'ranking'

const CONFIRMATION_MS = 3000

const LINK_NAMES: Record<LinkKind, string> = {
  pool: 'Pool link',
  ranking: 'Ranking link',
}

export function ShareBar({ board, boardRef, onReset }: ShareBarProps) {
  const [copied, setCopied] = useState<LinkKind | null>(null)
  const [manual, setManual] = useState<{ kind: LinkKind; url: string } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const manualInputRef = useRef<HTMLInputElement>(null)

  const links = useMemo<Record<LinkKind, ShareLink>>(
    () => ({ pool: poolShareLink(board), ranking: rankingShareLink(board) }),
    [board],
  )

  const empty = board.videos.length === 0

  useEffect(() => {
    if (copied === null) return
    const timer = setTimeout(() => setCopied(null), CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [copied])

  // A link the user has to copy by hand is only useful already selected.
  useEffect(() => {
    if (manual) manualInputRef.current?.select()
  }, [manual])

  const copy = useCallback(
    async (kind: LinkKind) => {
      const { url } = links[kind]
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
        await navigator.clipboard.writeText(url)
        setManual(null)
        setCopied(kind)
      } catch {
        // Insecure origins, permission denials and older browsers all land here; the link
        // still has to reach the user, so it gets handed over for a manual copy.
        setCopied(null)
        setManual({ kind, url })
      }
    },
    [links],
  )

  const exportPng = useCallback(async () => {
    const node = boardRef.current
    if (!node) return
    setExporting(true)
    setExportError(null)
    try {
      await exportBoardPng(node, EXPORT_FILENAME)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The export failed.')
    } finally {
      setExporting(false)
    }
  }, [boardRef])

  const reset = () => {
    setConfirmingReset(false)
    setManual(null)
    setCopied(null)
    setExportError(null)
    onReset()
  }

  const oversized = (['ranking', 'pool'] as const).find((kind) => links[kind].overLimit)

  return (
    <section className="share-bar" aria-label="Share and reset">
      <div className="share-actions">
        <button type="button" className="button" disabled={empty} onClick={() => void copy('pool')}>
          Copy pool link
        </button>
        <button
          type="button"
          className="button"
          disabled={empty}
          onClick={() => void copy('ranking')}
        >
          Copy ranking link
        </button>

        <button
          type="button"
          className="button"
          disabled={empty || exporting}
          onClick={() => void exportPng()}
        >
          {exporting ? 'Exporting…' : 'Export PNG'}
        </button>

        <p className="share-status" role="status">
          {copied ? `${LINK_NAMES[copied]} copied to the clipboard.` : ''}
        </p>

        {confirmingReset ? (
          <>
            <span className="share-confirm-prompt">Clear every video and placement?</span>
            <button type="button" className="button button-danger" onClick={reset}>
              Yes, reset
            </button>
            <button type="button" className="button" onClick={() => setConfirmingReset(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="button"
            disabled={empty}
            onClick={() => setConfirmingReset(true)}
          >
            Reset board
          </button>
        )}
      </div>

      <p className="share-hint">
        A pool link invites someone to rank these videos themselves; a ranking link reproduces the
        board exactly as it stands.
      </p>

      {oversized && (
        <p className="share-warning" role="status">
          The {oversized} link is {links[oversized].url.length.toLocaleString()} characters. Some
          chat and mail clients truncate past {SAFE_URL_LENGTH.toLocaleString()} — about{' '}
          {links[oversized].capacity} videos fit at this address.
        </p>
      )}

      {exportError && (
        <p className="share-error" role="alert">
          {exportError} The image was not saved.
        </p>
      )}

      {manual && (
        <div className="share-manual">
          <label htmlFor="share-manual-url">
            Copying failed, so here is the {manual.kind} link to copy by hand:
          </label>
          <input
            id="share-manual-url"
            ref={manualInputRef}
            className="share-manual-input"
            type="text"
            readOnly
            value={manual.url}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </section>
  )
}

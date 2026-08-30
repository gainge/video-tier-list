import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useVideoTitle } from '../lib/oembed'
import { useModal } from '../lib/useModal'
import { embedUrl, watchUrl } from '../lib/youtube'
import { boardOrder, findBucket } from '../state/boardReducer'
import type { MoveTarget } from '../state/boardReducer'
import type { BoardState, VideoId } from '../types'

type PlayerModalProps = {
  board: BoardState
  videoId: VideoId
  onClose: () => void
  onNavigate: (id: VideoId) => void
  onPlace: (id: VideoId, to: MoveTarget) => void
}

const POOL_TARGET: MoveTarget = { kind: 'pool' }

function isSameTarget(a: MoveTarget | null, b: MoveTarget): boolean {
  if (!a) return false
  if (a.kind !== b.kind) return false
  return a.kind === 'pool' || b.kind === 'pool' || a.index === b.index
}

export function PlayerModal({ board, videoId, onClose, onNavigate, onPlace }: PlayerModalProps) {
  const videoIdRef = useRef(videoId)
  videoIdRef.current = videoId

  const focusCurrentTile = useCallback(
    () => document.querySelector<HTMLElement>(`[data-video-id="${videoIdRef.current}"]`),
    [],
  )
  const { containerRef, onBackdropMouseDown } = useModal({
    open: true,
    onClose,
    fallbackFocus: focusCurrentTile,
  })
  const title = useVideoTitle(videoId)
  const label = title ?? videoId

  const placement = findBucket(board, videoId)
  const placementLabel =
    placement?.kind === 'tier' ? `Tier ${board.tiers[placement.index]?.label ?? ''}` : 'Unranked'

  const order = useMemo(() => boardOrder(board), [board])

  // Wrapping rather than stopping at the ends: a queue you can keep cycling beats a dead key.
  const step = useCallback(
    (delta: number) => {
      if (order.length < 2) return
      const at = order.indexOf(videoId)
      if (at === -1) return
      onNavigate(order[(at + delta + order.length) % order.length])
    },
    [order, videoId, onNavigate],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault()
        step(1)
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault()
        step(-1)
        return
      }
      if (event.key === '0') {
        event.preventDefault()
        onPlace(videoId, POOL_TARGET)
        return
      }
      if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1
        if (index >= board.tiers.length) return
        event.preventDefault()
        onPlace(videoId, { kind: 'tier', index })
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [board.tiers.length, onPlace, step, videoId])

  return (
    <div className="dialog-backdrop player-backdrop" onMouseDown={onBackdropMouseDown}>
      <div
        ref={containerRef}
        className="player-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-title"
      >
        <div className="player-header">
          <h2 id="player-title" className="player-title">
            {label}
          </h2>
          <button
            type="button"
            className="button player-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="player-frame">
          {/* Keyed by id alone so re-ranking re-renders around the iframe instead of remounting it. */}
          <iframe
            key={videoId}
            src={embedUrl(videoId, { autoplay: true })}
            title={label}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          />
        </div>

        <div className="player-meta">
          <span className="player-placement">
            Currently: <strong>{placementLabel}</strong>
          </span>
          {/* Embedding can be disabled per video, and the parent frame cannot tell; this is the way out. */}
          <a
            className="player-watch-link"
            href={watchUrl(videoId)}
            target="_blank"
            rel="noreferrer noopener"
          >
            Watch on YouTube
          </a>
        </div>

        <div className="player-ranks" role="group" aria-label="Place this video">
          {board.tiers.map((tier, index) => {
            const current = isSameTarget(placement, { kind: 'tier', index })
            return (
              <button
                key={tier.label + String(index)}
                type="button"
                className={current ? 'player-rank is-current' : 'player-rank'}
                aria-pressed={current}
                onClick={() => onPlace(videoId, { kind: 'tier', index })}
              >
                <span className="player-rank-key">{index < 9 ? index + 1 : ''}</span>
                {tier.label}
              </button>
            )
          })}
          <button
            type="button"
            className={
              isSameTarget(placement, POOL_TARGET) ? 'player-rank is-current' : 'player-rank'
            }
            aria-pressed={isSameTarget(placement, POOL_TARGET)}
            onClick={() => onPlace(videoId, POOL_TARGET)}
          >
            <span className="player-rank-key">0</span>
            Unranked
          </button>
        </div>

        <div className="player-nav">
          <button type="button" className="button" onClick={() => step(-1)}>
            ← Previous
          </button>
          <button type="button" className="button" onClick={() => step(1)}>
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

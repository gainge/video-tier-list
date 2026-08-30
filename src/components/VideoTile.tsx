import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { useVideoTitle } from '../lib/oembed'
import { thumbnailUrl } from '../lib/youtube'

type VideoTileProps = {
  id: string
  onOpen?: (id: string) => void
} & Omit<ComponentPropsWithoutRef<'div'>, 'id' | 'onClick'>

/**
 * Deliberately drag-agnostic: extra props and the forwarded ref pass straight through to the
 * root element so a drag layer can attach listeners without this component knowing about it.
 */
export const VideoTile = forwardRef<HTMLDivElement, VideoTileProps>(function VideoTile(
  { id, onOpen, className, children, ...rest },
  ref,
) {
  const title = useVideoTitle(id)
  const label = title ?? id

  return (
    <div
      ref={ref}
      className={className ? `video-tile ${className}` : 'video-tile'}
      title={label}
      data-video-id={id}
      role="button"
      tabIndex={0}
      aria-label={`Open ${label}`}
      onClick={() => onOpen?.(id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen?.(id)
        }
      }}
      {...rest}
    >
      <img
        className="video-tile-thumb"
        src={thumbnailUrl(id)}
        alt=""
        loading="lazy"
        draggable={false}
        // Board export rasterizes this node; a tainted canvas would fail the export.
        crossOrigin="anonymous"
      />
      <span className="video-tile-caption">{label}</span>
      {children}
    </div>
  )
})

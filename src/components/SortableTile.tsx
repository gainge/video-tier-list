import { useRef } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { VideoTile } from './VideoTile'

/** Matches the PointerSensor activation distance so a click and a drag can never both fire. */
export const DRAG_ACTIVATION_DISTANCE = 8

type SortableTileProps = {
  id: string
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}

export function SortableTile({ id, onOpen, onRemove }: SortableTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })
  const pressOrigin = useRef<{ x: number; y: number } | null>(null)

  const rememberPress = (event: PointerEvent<HTMLDivElement>) => {
    pressOrigin.current = { x: event.clientX, y: event.clientY }
  }

  /**
   * A pointer gesture that travelled far enough to have been a drag still ends in a browser
   * click; swallowing it here keeps dropping a tile from also opening the video.
   */
  const suppressClickAfterDrag = (event: MouseEvent<HTMLDivElement>) => {
    const origin = pressOrigin.current
    pressOrigin.current = null
    if (!origin) return
    const travelled = Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
    if (travelled >= DRAG_ACTIVATION_DISTANCE) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Enter stays the open gesture, leaving Space as the keyboard sensor's pick-up key.
    if (event.key === 'Enter') {
      event.preventDefault()
      onOpen(id)
      return
    }
    listeners?.onKeyDown?.(event)
  }

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'tile-slot is-dragging' : 'tile-slot'}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onPointerDownCapture={rememberPress}
      onClickCapture={suppressClickAfterDrag}
    >
      <VideoTile
        ref={setActivatorNodeRef}
        id={id}
        onOpen={onOpen}
        {...attributes}
        {...listeners}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="tile-remove"
        aria-label={`Remove ${id}`}
        data-export-exclude
        onClick={() => onRemove(id)}
      >
        ×
      </button>
    </div>
  )
}

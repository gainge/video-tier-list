import { useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { tierDroppableId } from '../state/dropTargets'
import type { TierDirection } from '../state/boardReducer'

type TierRowProps = {
  index: number
  label: string
  color: string
  items: string[]
  canAdd: boolean
  canRemove: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  addHint: string
  onRename: (index: number, label: string) => void
  onAdd: (index: number) => void
  onRemove: (index: number) => void
  onMove: (index: number, direction: TierDirection) => void
  renderTile: (id: string) => ReactNode
}

export function TierRow({
  index,
  label,
  color,
  items,
  canAdd,
  canRemove,
  canMoveUp,
  canMoveDown,
  addHint,
  onRename,
  onAdd,
  onRemove,
  onMove,
  renderTile,
}: TierRowProps) {
  // The whole row is the droppable, not its tiles, so an empty tier is still a valid target.
  const { setNodeRef, isOver } = useDroppable({ id: tierDroppableId(index) })
  const [draft, setDraft] = useState<string | null>(null)

  // The reducer refuses a blank rename, which leaves the row with the label it already had.
  const commit = () => {
    if (draft !== null) onRename(index, draft)
    setDraft(null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(null)
    }
  }

  return (
    <div ref={setNodeRef} className={isOver ? 'tier-row is-over' : 'tier-row'}>
      <div className="tier-label" style={{ background: color }}>
        {draft === null ? (
          <button
            type="button"
            className="tier-label-text"
            aria-label={`Rename tier ${label}`}
            onClick={() => setDraft(label)}
          >
            {label}
          </button>
        ) : (
          <input
            className="tier-label-input"
            aria-label={`Tier ${index + 1} label`}
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={handleKeyDown}
            onBlur={commit}
          />
        )}
      </div>

      <SortableContext items={items} strategy={rectSortingStrategy}>
        <div className="tier-items">{items.map(renderTile)}</div>
      </SortableContext>

      <div className="tier-controls" data-export-exclude>
        <button
          type="button"
          className="tier-control"
          aria-label={`Move tier ${label} up`}
          disabled={!canMoveUp}
          onClick={() => onMove(index, 'up')}
        >
          ↑
        </button>
        <button
          type="button"
          className="tier-control"
          aria-label={`Move tier ${label} down`}
          disabled={!canMoveDown}
          onClick={() => onMove(index, 'down')}
        >
          ↓
        </button>
        <button
          type="button"
          className="tier-control"
          aria-label={`Add a tier below ${label}`}
          title={canAdd ? undefined : addHint}
          disabled={!canAdd}
          onClick={() => onAdd(index + 1)}
        >
          +
        </button>
        <button
          type="button"
          className="tier-control"
          aria-label={`Remove tier ${label}`}
          disabled={!canRemove}
          onClick={() => onRemove(index)}
        >
          ×
        </button>
      </div>
    </div>
  )
}

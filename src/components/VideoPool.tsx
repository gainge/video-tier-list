import type { ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { rectSortingStrategy, SortableContext } from '@dnd-kit/sortable'
import { POOL_DROPPABLE_ID } from '../state/dropTargets'

type VideoPoolProps = {
  items: string[]
  renderTile: (id: string) => ReactNode
}

export function VideoPool({ items, renderTile }: VideoPoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_DROPPABLE_ID })

  return (
    <section className="pool">
      <h2>Unranked</h2>
      <SortableContext items={items} strategy={rectSortingStrategy}>
        <div ref={setNodeRef} className={isOver ? 'pool-items is-over' : 'pool-items'}>
          {items.map(renderTile)}
        </div>
      </SortableContext>
    </section>
  )
}

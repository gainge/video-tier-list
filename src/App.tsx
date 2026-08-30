import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { Announcements, DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { AddVideosDialog } from './components/AddVideosDialog'
import { PlayerModal } from './components/PlayerModal'
import { ShareBar } from './components/ShareBar'
import { SortableTile, DRAG_ACTIVATION_DISTANCE } from './components/SortableTile'
import { TierBoard } from './components/TierBoard'
import { VideoPool } from './components/VideoPool'
import { VideoTile } from './components/VideoTile'
import { bucketItems, boardReducer, findBucket, sameBucket } from './state/boardReducer'
import { boardCollisionDetection } from './state/collision'
import { parseDropTarget } from './state/dropTargets'
import { clearBoard, loadBoard, saveBoard } from './lib/storage'
import { decodeBoard } from './lib/urlCodec'
import { createEmptyBoard } from './types'
import type { MoveTarget, TierDirection } from './state/boardReducer'
import type { BoardState } from './types'

const TOUCH_HOLD_MS = 200

/**
 * A shared link is an explicit request for that board, so it outranks whatever the last
 * session left behind; with no link, the autosaved board is the one the user expects back.
 */
function hydrate(): { board: BoardState; fromHash: boolean } {
  const shared = decodeBoard(window.location.hash)
  if (shared) return { board: shared, fromHash: true }
  return { board: loadBoard() ?? createEmptyBoard(), fromHash: false }
}

export default function App() {
  const [initial] = useState(hydrate)
  const [board, dispatch] = useReducer(boardReducer, initial.board)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const boardRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!initial.fromHash) return
    // The board diverges from the link the moment it is edited, and a reload would then
    // resurrect the sender's version over the user's own. `replaceState` drops the stale
    // fragment without touching the back button.
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [initial.fromHash])

  useEffect(() => {
    saveBoard(board)
  }, [board])

  const resetBoard = useCallback(() => {
    clearBoard()
    dispatch({ type: 'resetBoard' })
  }, [])

  const closeDialog = useCallback(() => setDialogOpen(false), [])
  const addVideos = useCallback((ids: string[]) => dispatch({ type: 'addVideos', ids }), [])
  const openVideo = useCallback((id: string) => setPlayingId(id), [])
  const closePlayer = useCallback(() => setPlayingId(null), [])
  const placeVideo = useCallback(
    (id: string, to: MoveTarget) => dispatch({ type: 'moveVideo', id, to, beforeId: null }),
    [],
  )
  const removeVideo = useCallback((id: string) => dispatch({ type: 'removeVideo', id }), [])
  const renameTier = useCallback(
    (index: number, label: string) => dispatch({ type: 'renameTier', index, label }),
    [],
  )
  const addTier = useCallback((index: number) => dispatch({ type: 'addTier', index }), [])
  const removeTier = useCallback((index: number) => dispatch({ type: 'removeTier', index }), [])
  const moveTier = useCallback(
    (index: number, direction: TierDirection) => dispatch({ type: 'moveTier', index, direction }),
    [],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: TOUCH_HOLD_MS, tolerance: DRAG_ACTIVATION_DISTANCE },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const describeTarget = useCallback(
    (target: MoveTarget) =>
      target.kind === 'pool'
        ? 'the unranked pool'
        : `tier ${board.tiers[target.index]?.label ?? ''}`,
    [board.tiers],
  )

  const describeDropId = useCallback(
    (id: string) => {
      const bucket = parseDropTarget(id) ?? findBucket(board, id)
      return bucket ? describeTarget(bucket) : 'an unknown position'
    },
    [board, describeTarget],
  )

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) =>
        `Picked up video ${active.id} from ${describeDropId(String(active.id))}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `Video ${active.id} is over ${describeDropId(String(over.id))}.`
          : `Video ${active.id} is not over a drop target.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `Video ${active.id} was dropped into ${describeDropId(String(over.id))}.`
          : `Video ${active.id} was dropped outside the board and stayed put.`,
      onDragCancel: ({ active }) => `Moving video ${active.id} was cancelled.`,
    }),
    [describeDropId],
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null)
      const { active, over } = event
      if (!over) return

      const id = String(active.id)
      const overId = String(over.id)

      const bucket = parseDropTarget(overId)
      if (bucket) {
        dispatch({ type: 'moveVideo', id, to: bucket, beforeId: null })
        return
      }

      const target = findBucket(board, overId)
      const source = findBucket(board, id)
      if (!target || !source) return

      const items = bucketItems(board, target)
      const overIndex = items.indexOf(overId)
      // Dragging a tile past a later sibling should land it after that sibling, not before it.
      const movingForward = sameBucket(source, target) && items.indexOf(id) < overIndex
      const beforeId = movingForward ? (items[overIndex + 1] ?? null) : overId

      dispatch({ type: 'moveVideo', id, to: target, beforeId })
    },
    [board],
  )

  const renderTile = useCallback(
    (id: string) => <SortableTile key={id} id={id} onOpen={openVideo} onRemove={removeVideo} />,
    [openVideo, removeVideo],
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1>Video Tier List</h1>
        <button type="button" className="button button-primary" onClick={() => setDialogOpen(true)}>
          Add videos
        </button>
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={boardCollisionDetection}
        accessibility={{ announcements }}
        // Rows resize as tiles enter and leave, so stale rects would misplace later drops.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <TierBoard
          tiers={board.tiers}
          boardRef={boardRef}
          onRenameTier={renameTier}
          onAddTier={addTier}
          onRemoveTier={removeTier}
          onMoveTier={moveTier}
          renderTile={renderTile}
        />
        <VideoPool items={board.pool} renderTile={renderTile} />

        <DragOverlay>
          {draggingId ? (
            <div className="tile-slot drag-overlay">
              <VideoTile id={draggingId} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <ShareBar board={board} boardRef={boardRef} onReset={resetBoard} />

      {playingId !== null && board.videos.includes(playingId) && (
        <PlayerModal
          board={board}
          videoId={playingId}
          onClose={closePlayer}
          onNavigate={setPlayingId}
          onPlace={placeVideo}
        />
      )}

      <AddVideosDialog
        open={dialogOpen}
        onClose={closeDialog}
        existingIds={board.videos}
        onAdd={addVideos}
      />
    </div>
  )
}

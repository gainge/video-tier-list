import type { ReactNode, RefObject } from 'react'
import type { Tier } from '../types'
import { TIER_COLORS } from '../types'
import { MAX_TIERS } from '../lib/urlCodec'
import { TierRow } from './TierRow'
import type { TierDirection } from '../state/boardReducer'

type TierBoardProps = {
  tiers: Tier[]
  boardRef: RefObject<HTMLElement | null>
  onRenameTier: (index: number, label: string) => void
  onAddTier: (index: number) => void
  onRemoveTier: (index: number) => void
  onMoveTier: (index: number, direction: TierDirection) => void
  renderTile: (id: string) => ReactNode
}

const ADD_LIMIT_HINT = `A share link can carry at most ${MAX_TIERS} tiers.`

export function TierBoard({
  tiers,
  boardRef,
  onRenameTier,
  onAddTier,
  onRemoveTier,
  onMoveTier,
  renderTile,
}: TierBoardProps) {
  const canAdd = tiers.length < MAX_TIERS

  return (
    <main className="board" ref={boardRef}>
      {tiers.map((tier, index) => (
        <TierRow
          key={index}
          index={index}
          label={tier.label}
          color={TIER_COLORS[index % TIER_COLORS.length]}
          items={tier.items}
          canAdd={canAdd}
          canRemove={tiers.length > 1}
          canMoveUp={index > 0}
          canMoveDown={index < tiers.length - 1}
          addHint={ADD_LIMIT_HINT}
          onRename={onRenameTier}
          onAdd={onAddTier}
          onRemove={onRemoveTier}
          onMove={onMoveTier}
          renderTile={renderTile}
        />
      ))}
      {!canAdd && (
        <p className="board-limit" data-export-exclude>
          {ADD_LIMIT_HINT}
        </p>
      )}
    </main>
  )
}

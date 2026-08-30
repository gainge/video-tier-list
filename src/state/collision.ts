import { closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core'
import type { CollisionDetection } from '@dnd-kit/core'

/**
 * Tier rows are full-width rects that are far taller than the tiles inside them, so
 * `closestCenter` alone compares the drag against row *centers* and biases every drop
 * toward whichever row's midpoint happens to be nearest — not the row under the pointer.
 * Pointer position is the honest signal while the cursor is over the board; the rect and
 * center passes only cover the case where it has left the board entirely.
 */
export const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions

  const rectCollisions = rectIntersection(args)
  return rectCollisions.length > 0 ? rectCollisions : closestCenter(args)
}

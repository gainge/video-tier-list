import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])'

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) => element.offsetParent !== null || element === document.activeElement,
  )
}

type UseModalOptions = {
  open: boolean
  onClose: () => void
  /** Focus target on open; the first focusable descendant is used when omitted. */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Where focus goes when the element that opened the modal is no longer in the document. */
  fallbackFocus?: () => HTMLElement | null
}

type UseModalResult = {
  containerRef: RefObject<HTMLDivElement | null>
  /**
   * Belongs on the backdrop element. Mousedown rather than click, so a gesture that starts
   * inside the dialog and releases over the backdrop does not count as a dismissal.
   */
  onBackdropMouseDown: (event: { target: EventTarget | null; currentTarget: EventTarget }) => void
}

/**
 * The dismissal, focus and scroll behaviour every modal in the app shares. Callers keep
 * ownership of their own markup and only mount it while `open`.
 */
export function useModal({
  open,
  onClose,
  initialFocusRef,
  fallbackFocus,
}: UseModalOptions): UseModalResult {
  const containerRef = useRef<HTMLDivElement>(null)
  const fallbackFocusRef = useRef(fallbackFocus)

  useEffect(() => {
    fallbackFocusRef.current = fallbackFocus
  })

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement
    const restoreOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const container = containerRef.current
    const target = initialFocusRef?.current ?? (container ? focusableWithin(container)[0] : null)
    target?.focus()

    return () => {
      document.body.style.overflow = restoreOverflow
      // Re-ranking replaces the opener's node, so a detached element means "ask for a fresh one".
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      } else {
        fallbackFocusRef.current?.()?.focus()
      }
    }
  }, [open, initialFocusRef])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const container = containerRef.current
      if (!container) return

      const focusable = focusableWithin(container)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (!(active instanceof HTMLElement) || !container.contains(active)) {
        event.preventDefault()
        first.focus()
        return
      }
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const onBackdropMouseDown = useCallback(
    (event: { target: EventTarget | null; currentTarget: EventTarget }) => {
      if (event.target === event.currentTarget) onClose()
    },
    [onClose],
  )

  return { containerRef, onBackdropMouseDown }
}

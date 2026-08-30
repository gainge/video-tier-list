import { useEffect, useRef, useState } from 'react'
import { parseVideoId } from '../lib/youtube'
import { useModal } from '../lib/useModal'

type AddVideosDialogProps = {
  open: boolean
  onClose: () => void
  existingIds: string[]
  onAdd: (ids: string[]) => void
}

type ParseResult = {
  added: string[]
  duplicates: number
  invalid: string[]
}

/** One path for both a single link and a bulk paste: every token is treated the same way. */
function parseInput(text: string, existingIds: string[]): ParseResult {
  const seen = new Set(existingIds)
  const added: string[] = []
  const invalid: string[] = []
  let duplicates = 0

  for (const token of text.split(/\s+/).filter(Boolean)) {
    const id = parseVideoId(token)
    if (!id) {
      invalid.push(token)
    } else if (seen.has(id)) {
      duplicates += 1
    } else {
      seen.add(id)
      added.push(id)
    }
  }

  return { added, duplicates, invalid }
}

export function AddVideosDialog({ open, onClose, existingIds, onAdd }: AddVideosDialogProps) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { containerRef, onBackdropMouseDown } = useModal({
    open,
    onClose,
    initialFocusRef: textareaRef,
  })

  useEffect(() => {
    if (!open) return
    setText('')
    setResult(null)
  }, [open])

  if (!open) return null

  const submit = () => {
    const parsed = parseInput(text, existingIds)
    if (parsed.added.length > 0) onAdd(parsed.added)
    setResult(parsed)
    // Invalid lines stay in the box so they can be corrected instead of retyped.
    setText(parsed.invalid.join('\n'))
  }

  return (
    <div className="dialog-backdrop" onMouseDown={onBackdropMouseDown}>
      <div
        ref={containerRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-videos-title"
      >
        <h2 id="add-videos-title">Add videos</h2>
        <p className="dialog-hint">Paste YouTube links or ids, one per line.</p>
        <textarea
          ref={textareaRef}
          className="dialog-textarea"
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-label="YouTube links or ids"
        />

        {result && (
          <div className="dialog-result" role="status">
            <p>
              Added {result.added.length}
              {result.duplicates > 0 && `, skipped ${result.duplicates} already on the board`}
              {result.invalid.length > 0 && `, could not read ${result.invalid.length}`}.
            </p>
            {result.invalid.length > 0 && (
              <ul className="dialog-invalid">
                {result.invalid.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="button button-primary" onClick={submit}>
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

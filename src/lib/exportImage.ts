import { toPng } from 'html-to-image'

/**
 * Marks nodes that belong to the editor rather than the tier list: row controls, remove
 * buttons and drag affordances are stripped so the export reads as a finished image.
 */
const EXCLUDE_ATTRIBUTE = 'data-export-exclude'

/** Below this a data URL holds a header and little else, which means nothing rasterized. */
const MIN_DATA_URL_LENGTH = 1024

const BACKGROUND = '#17181c'

/**
 * The rasterizer redraws the board inside an SVG foreignObject, where `-webkit-line-clamp`
 * does not clamp; captions would then spill out of their tiles. The class swaps in a plain
 * max-height clamp for the duration of the capture.
 */
const EXPORTING_CLASS = 'is-exporting'

function isIncluded(node: HTMLElement): boolean {
  return typeof node.hasAttribute !== 'function' || !node.hasAttribute(EXCLUDE_ATTRIBUTE)
}

function download(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

/**
 * Rejects rather than resolving on a blank result, so a tainted canvas or a failed image
 * fetch reaches the user as an error instead of a silently empty download.
 */
export async function exportBoardPng(node: HTMLElement, filename: string): Promise<void> {
  node.classList.add(EXPORTING_CLASS)
  let dataUrl: string
  try {
    dataUrl = await toPng(node, {
      filter: isIncluded,
      backgroundColor: BACKGROUND,
      pixelRatio: 2,
      // Thumbnails are cached by the browser; a plain cache hit can be a response fetched
      // without CORS, which would taint the canvas on rasterization.
      cacheBust: true,
      // The board is drawn entirely in system fonts, so there is no web font worth inlining.
      skipFonts: true,
    })
  } finally {
    node.classList.remove(EXPORTING_CLASS)
  }

  if (!dataUrl.startsWith('data:image/png') || dataUrl.length < MIN_DATA_URL_LENGTH) {
    throw new Error('The board rasterized to an empty image.')
  }

  download(dataUrl, filename)
}

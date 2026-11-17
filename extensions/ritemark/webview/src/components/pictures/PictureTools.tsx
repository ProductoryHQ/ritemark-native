/**
 * One picture editor (experience 49): the tools of a chosen picture in the words, one component for the Text editor and
 * the slide editor.
 *
 *  - The ring and the four corner handles, and in crop mode the whole picture with the frame, its eight handles and the
 *    thirds, the rest dimmed, are drawn inside the editor's own page: in the picture's block in a document, in the
 *    slide's canvas on a slide. On a slide, drawn with `transform: scale`, every measured rect and every drag is divided
 *    by the scale, so the handles scale with the slide and stay under the pointer (as the table's do, experience 48).
 *  - The corner handles keep the proportions and snap to S, M, L and Full. Nothing is written while dragging: the drop
 *    is one undo step.
 *  - Crop mode keeps the frame outside the document (`PICTURE_CROP`) until Done (Enter); Esc leaves it as it was.
 *  - The bar (`PictureBar`) under the picture; a press anywhere outside the picture and its bar leaves the picture.
 */
import { useCallback, useEffect, useReducer, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/core'
import {
  CROP_HANDLES,
  SIZE_WIDTHS,
  WHOLE,
  draggedWidth,
  dragRegion,
  lookOf,
  moveRegion,
  presetRegion,
  readRatio,
  regionOf,
  type CropHandle,
  type PictureContext,
  type Region,
} from '../../../../src/markdown/pictureLook'
import { sendToExtension } from '../../bridge'
import { commitCrop, imagePathOf } from '../../extensions/pictures/PictureNode'
import { chosenPicture, cropMeta, cropOf, leavePicture, removePicture, setPictureLook, setPictureWords, type CropState } from '../../extensions/pictures/pictureCommands'
import { runClipboardEdit } from '../tables/TableMenuItems'
import { PictureBar, type PicturePlace } from './PictureBar'
import { CORNERS, cornerOf, cropHandleAt, frameBox, localBox, resizedWidth, scaleOf, wholeBox, type Box, type Corner } from './pictureGeometry'

/** On a slide drawn small, the handles are never drawn under 70 % of their size on the screen. */
const MIN_SCREEN = 0.7
const HANDLE = 10

/** The Radix layers portalled out of the bar (its menu, its Description, their tooltips). */
const OWN_LAYERS = '[data-radix-popper-content-wrapper], .picture-bar, .pic-layer'

export interface PictureToolsProps {
  editor: Editor | null
  context: PictureContext
  /** Comments are on: the bar offers one on the picture. */
  comments: boolean
  onComment?: (pos: number) => void
  /** Replace picture…: the editor's own file picker, then the chosen picture in this one's place. */
  onReplace: (pos: number) => void
  /** The slide's Place group: the same picture moved beside or behind the words. */
  onPlace?: (pos: number, place: PicturePlace) => void
}

/** The parts of a chosen picture's view the tools measure and draw against. */
interface Parts {
  /** The element its size is set on (the image, or its frame). */
  root: HTMLElement
  /** The image. */
  image: HTMLImageElement
  /** The box the picture fills on the page (a cropped picture's box, else the image). */
  target: HTMLElement
  /** Where the handles are drawn: the picture's block in a document, the slide's canvas on a slide. */
  host: HTMLElement
}

function partsOf(editor: Editor, pos: number, context: PictureContext): Parts | null {
  const dom = editor.view.nodeDOM(pos) as HTMLElement | null
  if (!dom || !dom.isConnected || dom.classList.contains('is-missing')) return null
  const root = (context === 'document' ? dom.firstElementChild : dom) as HTMLElement | null
  if (!root) return null
  const image = (root.tagName === 'IMG' ? root : root.querySelector('img')) as HTMLImageElement | null
  const host = (context === 'slide' ? editor.view.dom.closest('.deck-sl') : dom) as HTMLElement | null
  if (!image || !host) return null
  return { root, image, target: (root.querySelector('.pic-box') as HTMLElement | null) ?? root, host }
}

/** The column a picture's width is a share of: its parent's content width, in its own pixels. */
function columnOf(root: HTMLElement): number {
  const parent = root.parentElement
  if (!parent) return root.offsetWidth
  const style = getComputedStyle(parent)
  return Math.max(1, parent.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0))
}

/** Copy the picture itself; where the webview won't, the editor's own copy of the chosen picture. */
export async function copyPicture(image: HTMLImageElement, editor: Editor | null): Promise<void> {
  try {
    const blob = await (await fetch(image.currentSrc || image.src)).blob()
    let png = blob
    if (blob.type !== 'image/png') {
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
      png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(made => (made ? resolve(made) : reject(new Error('no picture'))), 'image/png'))
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  } catch {
    if (editor) runClipboardEdit(editor, 'copy')
  }
}

interface ResizeDrag {
  corner: Corner
  startX: number
  startWidth: number
  column: number
  scale: number
  width: number
  previous: string
}

interface CropDrag {
  handle: CropHandle | 'move'
  startX: number
  startY: number
  start: Region
  whole: Box
  scale: number
}

export function PictureTools({ editor, context, comments, onComment, onReplace, onPlace }: PictureToolsProps) {
  const [, redraw] = useReducer((count: number) => count + 1, 0)
  const resize = useRef<ResizeDrag | null>(null)
  const cropDrag = useRef<CropDrag | null>(null)

  // Drawn again as the editor changes, the window moves, and a picture loads (it takes its height then).
  useEffect(() => {
    if (!editor) return
    const view = editor.view
    editor.on('transaction', redraw)
    window.addEventListener('resize', redraw)
    window.addEventListener('scroll', redraw, true)
    view.dom.addEventListener('load', redraw, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => redraw())
    observer?.observe(view.dom)
    return () => {
      editor.off('transaction', redraw)
      window.removeEventListener('resize', redraw)
      window.removeEventListener('scroll', redraw, true)
      view.dom.removeEventListener('load', redraw, true)
      observer?.disconnect()
    }
  }, [editor])

  const chosen = editor && !editor.isDestroyed ? chosenPicture(editor.state) : null

  // A press outside the picture, its handles and its bar leaves the picture (and crop mode, as Esc does).
  useEffect(() => {
    if (!editor || !chosen) return
    const press = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (!target || editor.isDestroyed || editor.view.dom.contains(target) || target.closest(OWN_LAYERS)) return
      const tr = leavePicture(editor.state)
      if (tr) editor.view.dispatch(tr)
    }
    document.addEventListener('pointerdown', press, true)
    return () => document.removeEventListener('pointerdown', press, true)
  }, [editor, chosen?.pos, !!chosen])

  const dispatch = useCallback((tr: ReturnType<typeof setPictureLook>, focus = true) => {
    if (!editor || editor.isDestroyed || !tr) return
    editor.view.dispatch(tr)
    if (focus) editor.view.focus()
  }, [editor])

  if (!editor || editor.isDestroyed || !chosen) return null
  const parts = partsOf(editor, chosen.pos, context)
  if (!parts) return null
  const { root, image, target, host } = parts
  const pos = chosen.pos
  const node = chosen.node
  const look = lookOf(node.attrs.picture as string | null)
  const crop = cropOf(editor.state)
  const cropping = crop && crop.pos === pos ? crop : null

  const hostRect = host.getBoundingClientRect()
  const scale = scaleOf(hostRect.width, host.offsetWidth)
  const box = localBox(target.getBoundingClientRect(), hostRect, scale)
  const size = HANDLE * Math.max(1, MIN_SCREEN / scale)
  const aspect = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 0

  // ---- the corner handles: the width follows the pointer, in proportion, snapped to the sizes on the drop

  const startResize = (event: ReactPointerEvent<HTMLElement>, corner: Corner) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const startWidth = root.getBoundingClientRect().width / scale
    resize.current = { corner, startX: event.clientX, startWidth, column: columnOf(root), scale, width: startWidth, previous: root.style.width }
  }
  const moveResize = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = resize.current
    if (!drag) return
    const width = Math.max(Math.min(48, drag.column), Math.min(drag.column, resizedWidth(drag.startWidth, drag.corner, (event.clientX - drag.startX) / drag.scale, look.align)))
    drag.width = width
    root.style.width = `${width}px`
    root.style.maxWidth = '100%'
    redraw()
  }
  const endResize = () => {
    const drag = resize.current
    resize.current = null
    if (!drag) return
    root.style.width = drag.previous
    if (Math.abs(drag.width - drag.startWidth) < 2) return redraw()
    dispatch(setPictureLook(editor.state, pos, { width: draggedWidth(drag.width, drag.column, context) }))
  }

  // ---- crop mode

  const setCrop = (next: CropState | null) => {
    if (!editor.isDestroyed) editor.view.dispatch(cropMeta(editor.state, next))
  }
  const startCrop = () => {
    if (!aspect) return
    setCrop({ pos, aspect, region: regionOf(look, aspect), ratio: look.crop ?? undefined })
    editor.view.focus()
  }
  // The whole picture stays where it is while the frame moves over it: placed by the crop the picture has now.
  const whole = cropping ? wholeBox(box, regionOf(look, cropping.aspect)) : null
  const frame = cropping && whole ? frameBox(whole, cropping.region) : null
  const lockOf = (state: CropState) => (state.ratio === undefined ? null : state.ratio === null ? state.aspect : readRatio(state.ratio))

  const startCropDrag = (event: ReactPointerEvent<HTMLElement>, handle: CropHandle | 'move') => {
    if (!cropping || !whole) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    cropDrag.current = { handle, startX: event.clientX, startY: event.clientY, start: cropping.region, whole, scale }
  }
  const moveCropDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = cropDrag.current
    const state = cropOf(editor.state)
    if (!drag || !state) return
    const dx = (event.clientX - drag.startX) / drag.scale / drag.whole.width
    const dy = (event.clientY - drag.startY) / drag.scale / drag.whole.height
    const region = drag.handle === 'move' ? moveRegion(drag.start, dx, dy) : dragRegion(drag.start, drag.handle, dx, dy, lockOf(state), state.aspect)
    setCrop({ ...state, region })
  }
  const endCropDrag = () => { cropDrag.current = null }

  const layer = (
    <div className="pic-layer" contentEditable={false} data-context={context}>
      {cropping && whole && frame ? (
        <>
          <div className="pic-crop-whole" style={{ left: whole.left, top: whole.top, width: whole.width, height: whole.height }}>
            <img src={image.currentSrc || image.src} alt="" draggable={false} />
            <div className="pic-crop-dim" style={{ left: frame.left - whole.left, top: frame.top - whole.top, width: frame.width, height: frame.height }} />
          </div>
          <div
            className="pic-crop-frame"
            style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
            onPointerDown={event => startCropDrag(event, 'move')}
            onPointerMove={moveCropDrag}
            onPointerUp={endCropDrag}
            onPointerCancel={endCropDrag}
          >
            <span className="pic-third" style={{ left: '33.333%', top: 0, bottom: 0, width: 1 / scale }} />
            <span className="pic-third" style={{ left: '66.667%', top: 0, bottom: 0, width: 1 / scale }} />
            <span className="pic-third" style={{ top: '33.333%', left: 0, right: 0, height: 1 / scale }} />
            <span className="pic-third" style={{ top: '66.667%', left: 0, right: 0, height: 1 / scale }} />
            {CROP_HANDLES.map(handle => {
              const at = cropHandleAt(handle)
              return (
                <span
                  key={handle}
                  className={`pic-handle pic-crop-handle is-${handle}`}
                  style={{ left: at.x * frame.width - size / 2, top: at.y * frame.height - size / 2, width: size, height: size }}
                  onPointerDown={event => startCropDrag(event, handle)}
                  onPointerMove={moveCropDrag}
                  onPointerUp={endCropDrag}
                  onPointerCancel={endCropDrag}
                />
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="pic-ring" style={{ left: box.left, top: box.top, width: box.width, height: box.height, borderWidth: 2 / scale }} />
          {CORNERS.map(corner => {
            const at = cornerOf(box, corner)
            return (
              <span
                key={corner}
                className={`pic-handle is-${corner}`}
                data-corner={corner}
                style={{ left: at.x - size / 2, top: at.y - size / 2, width: size, height: size }}
                onPointerDown={event => startResize(event, corner)}
                onPointerMove={moveResize}
                onPointerUp={endResize}
                onPointerCancel={endResize}
              />
            )
          })}
        </>
      )}
    </div>
  )

  // Under the picture and its caption (the frame), or under the whole picture in crop mode.
  const anchorBox = whole ?? localBox(root.getBoundingClientRect(), hostRect, scale)
  const anchor = {
    left: hostRect.left + anchorBox.left * scale,
    top: hostRect.top + anchorBox.top * scale,
    width: anchorBox.width * scale,
    height: anchorBox.height * scale,
  }
  const done = () => {
    const tr = commitCrop(editor.state)
    if (tr) dispatch(tr)
  }

  return (
    <>
      {createPortal(layer, host)}
      <PictureBar
        anchor={anchor}
        context={context}
        kind="flow"
        look={look}
        alt={String(node.attrs.alt ?? '')}
        canCrop={aspect > 0}
        crop={cropping ? { ratio: cropping.ratio } : null}
        place={onPlace ? 'text' : undefined}
        comments={comments && !!onComment}
        onSize={choice => dispatch(setPictureLook(editor.state, pos, { width: SIZE_WIDTHS[context][choice] }))}
        // The alignment chosen again goes back to the column's own.
        onAlign={align => dispatch(setPictureLook(editor.state, pos, { align: look.align === align ? undefined : align }))}
        onCrop={startCrop}
        onCropShape={ratio => cropping && setCrop({ ...cropping, ratio, region: presetRegion(ratio, cropping.aspect, cropping.region) })}
        onCropReset={() => cropping && setCrop({ ...cropping, ratio: null, region: WHOLE })}
        onCropDone={done}
        onCropCancel={() => { setCrop(null); editor.view.focus() }}
        onPlace={onPlace ? place => onPlace(pos, place) : undefined}
        onWords={(alt, caption) => dispatch(setPictureWords(editor.state, pos, alt, caption))}
        onComment={onComment ? () => onComment(pos) : undefined}
        onReplace={() => onReplace(pos)}
        onCopy={() => void copyPicture(image, editor)}
        onReveal={() => {
          const path = imagePathOf(node.attrs)
          if (path) sendToExtension('revealImage', { relativePath: path })
        }}
        onRemove={() => dispatch(removePicture(editor.state, pos))}
        onLeave={() => dispatch(leavePicture(editor.state))}
      />
    </>
  )
}

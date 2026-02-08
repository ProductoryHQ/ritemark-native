/**
 * ResizableImage Component
 *
 * Custom React NodeView for TipTap images with resize handles.
 * When resized, shows confirmation dialog then resizes the actual image file.
 *
 * @see Sprint 26: Image Resize
 */

import { NodeViewWrapper } from '@tiptap/react'
import { useState, useRef, useCallback, useEffect } from 'react'
import { ImageIcon } from 'lucide-react'
import { sendToExtension } from '../bridge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogButton,
} from './ui/dialog'

interface ResizableImageProps {
  node: {
    attrs: {
      src: string
      alt?: string
      title?: string  // Contains relative path for local images
    }
  }
  selected: boolean
  updateAttributes: (attrs: Record<string, unknown>) => void
}

interface ResizeState {
  isResizing: boolean
  startX: number
  startY: number
  startWidth: number
  startHeight: number
  corner: 'se' | 'sw' | 'ne' | 'nw'
}

export function ResizableImage({ node, selected }: ResizableImageProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingSize, setPendingSize] = useState<{ width: number; height: number } | null>(null)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [previewSize, setPreviewSize] = useState<{ width: number; height: number } | null>(null)
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number } | null>(null)

  const { src, alt, title } = node.attrs

  // Get original image dimensions when loaded
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setOriginalSize({ width: img.naturalWidth, height: img.naturalHeight })
  }, [])

  // Start resize on mousedown
  const handleResizeStart = useCallback((e: React.MouseEvent, corner: ResizeState['corner']) => {
    e.preventDefault()
    e.stopPropagation()

    if (!imgRef.current) return

    const rect = imgRef.current.getBoundingClientRect()
    setResizeState({
      isResizing: true,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
      corner,
    })
    setPreviewSize({ width: rect.width, height: rect.height })
  }, [])

  // Handle resize movement
  useEffect(() => {
    if (!resizeState?.isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeState || !originalSize) return

      const deltaX = e.clientX - resizeState.startX
      const deltaY = e.clientY - resizeState.startY
      const aspectRatio = originalSize.width / originalSize.height

      let newWidth = resizeState.startWidth
      let newHeight = resizeState.startHeight

      // Calculate new size based on corner being dragged
      switch (resizeState.corner) {
        case 'se':
          newWidth = Math.max(100, resizeState.startWidth + deltaX)
          break
        case 'sw':
          newWidth = Math.max(100, resizeState.startWidth - deltaX)
          break
        case 'ne':
          newWidth = Math.max(100, resizeState.startWidth + deltaX)
          break
        case 'nw':
          newWidth = Math.max(100, resizeState.startWidth - deltaX)
          break
      }

      // Maintain aspect ratio
      newHeight = newWidth / aspectRatio

      setPreviewSize({ width: Math.round(newWidth), height: Math.round(newHeight) })
    }

    const handleMouseUp = () => {
      if (previewSize && originalSize) {
        // Only show dialog if size actually changed significantly (> 5px)
        const widthChanged = Math.abs(previewSize.width - resizeState.startWidth) > 5
        if (widthChanged) {
          setPendingSize(previewSize)
          setShowConfirmDialog(true)
        }
      }
      setResizeState(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizeState, originalSize, previewSize])

  // Confirm resize - resize in browser using Canvas, then send to extension
  const handleConfirmResize = useCallback(async () => {
    if (!pendingSize || !title || !imgRef.current) {
      setShowConfirmDialog(false)
      setPendingSize(null)
      setPreviewSize(null)
      return
    }

    try {
      // Create canvas and resize image
      const canvas = document.createElement('canvas')
      canvas.width = pendingSize.width
      canvas.height = pendingSize.height

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')

      // Draw resized image
      ctx.drawImage(imgRef.current, 0, 0, pendingSize.width, pendingSize.height)

      // Get data URL (use original format if possible, fallback to PNG)
      const format = src.includes('.jpg') || src.includes('.jpeg') ? 'image/jpeg' : 'image/png'
      const quality = format === 'image/jpeg' ? 0.92 : undefined
      const dataUrl = canvas.toDataURL(format, quality)

      // Send to extension to save
      sendToExtension('resizeImage', {
        relativePath: title,  // title contains the relative path like ./images/photo.jpg
        dataUrl: dataUrl,
      })

      setShowConfirmDialog(false)
      setPendingSize(null)
      // Keep previewSize so image shows at new size until page refreshes
    } catch (error) {
      console.error('Failed to resize image:', error)
      setShowConfirmDialog(false)
      setPendingSize(null)
      setPreviewSize(null)
    }
  }, [pendingSize, title, src])

  // Cancel resize
  const handleCancelResize = useCallback(() => {
    setShowConfirmDialog(false)
    setPendingSize(null)
    setPreviewSize(null)
  }, [])

  // Check if this is a local image (has relative path in title)
  const isLocalImage = title && (title.startsWith('./') || title.startsWith('../'))

  return (
    <NodeViewWrapper className="resizable-image-wrapper" data-drag-handle>
      <div
        className={`resizable-image-container ${selected ? 'selected' : ''} ${resizeState?.isResizing ? 'resizing' : ''}`}
        style={previewSize ? { width: previewSize.width } : undefined}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          onLoad={handleImageLoad}
          draggable={false}
          style={previewSize ? { width: previewSize.width, height: previewSize.height } : undefined}
        />

        {/* Resize handles - only show for local images when selected */}
        {isLocalImage && selected && (
          <>
            <div
              className="resize-handle resize-handle-se"
              onMouseDown={(e) => handleResizeStart(e, 'se')}
            />
            <div
              className="resize-handle resize-handle-sw"
              onMouseDown={(e) => handleResizeStart(e, 'sw')}
            />
            <div
              className="resize-handle resize-handle-ne"
              onMouseDown={(e) => handleResizeStart(e, 'ne')}
            />
            <div
              className="resize-handle resize-handle-nw"
              onMouseDown={(e) => handleResizeStart(e, 'nw')}
            />
          </>
        )}

        {/* Size indicator during resize */}
        {resizeState?.isResizing && previewSize && (
          <div className="resize-indicator">
            {previewSize.width} × {previewSize.height}
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog && pendingSize !== null} onOpenChange={(open) => { if (!open) handleCancelResize() }}>
        <DialogContent className="max-w-[360px]">
          <DialogHeader icon={<ImageIcon size={18} />} onClose={handleCancelResize}>
            <DialogTitle>Resize Image</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-[var(--vscode-foreground)] m-0 mb-3">
              This will permanently resize the image file from{' '}
              <strong>{originalSize?.width} × {originalSize?.height}</strong> to{' '}
              <strong>{pendingSize?.width} × {pendingSize?.height}</strong>.
            </p>
            <p className="text-sm font-medium text-[var(--vscode-errorForeground,#f48771)] m-0">
              This action cannot be undone.
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogButton variant="secondary" onClick={handleCancelResize}>Cancel</DialogButton>
            <DialogButton onClick={handleConfirmResize}>Resize File</DialogButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .resizable-image-wrapper {
          display: block;
          /* No margin here - avoids double spacing with ProseMirror styles */
        }

        .resizable-image-container {
          position: relative;
          display: inline-block;
          max-width: 100%;
          margin: 0.5em 0;
        }

        .resizable-image-container img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          /* No margin - container handles spacing */
        }

        .resizable-image-container.selected img {
          outline: 2px solid var(--vscode-focusBorder, #007acc);
          outline-offset: 2px;
        }

        .resizable-image-container.resizing img {
          opacity: 0.8;
        }

        /* Resize handles */
        .resize-handle {
          position: absolute;
          width: 12px;
          height: 12px;
          background: var(--vscode-focusBorder, #007acc);
          border: 2px solid var(--vscode-editor-background, #fff);
          border-radius: 2px;
          cursor: nwse-resize;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .resizable-image-container.selected .resize-handle,
        .resizable-image-container.resizing .resize-handle {
          opacity: 1;
        }

        .resize-handle-se {
          bottom: -6px;
          right: -6px;
          cursor: nwse-resize;
        }

        .resize-handle-sw {
          bottom: -6px;
          left: -6px;
          cursor: nesw-resize;
        }

        .resize-handle-ne {
          top: -6px;
          right: -6px;
          cursor: nesw-resize;
        }

        .resize-handle-nw {
          top: -6px;
          left: -6px;
          cursor: nwse-resize;
        }

        /* Size indicator */
        .resize-indicator {
          position: absolute;
          bottom: 8px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.75);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
          pointer-events: none;
        }
      `}</style>
    </NodeViewWrapper>
  )
}

export default ResizableImage

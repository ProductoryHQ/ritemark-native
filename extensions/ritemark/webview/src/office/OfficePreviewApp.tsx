/**
 * Sprint 124 (#284) R3 — the Office preview webview: its own bundle
 * (`media/office-preview.js`), so an Office tab does not load the shared
 * 8.9 MB editor bundle, and the Office renderers do not ship inside it.
 * Sprint 125 (#285): PowerPoint decks join Word documents here.
 *
 * The host handshake is the editors' own: send `ready`, receive `load`
 * (base64 content) or `loadError` (the host's pre-check refused the file, or
 * the preview is turned off).
 */
import { useEffect, useState } from 'react'
import { onMessage, sendToExtension } from '../bridge'
import { Icon } from '../components/ui/Icon'
import { DOCXViewer, type DocxLoadError } from '../components/viewers/DOCXViewer'
import { PPTXViewer } from '../components/viewers/PPTXViewer'

type FileType = 'docx' | 'pptx'

type OfficeState =
  | { kind: 'waiting' }
  | { kind: 'docx'; content: string; filename: string; canSaveAsMarkdown: boolean }
  | { kind: 'pptx'; content: string; filename: string }
  | { kind: 'error'; fileType: FileType; filename: string; error: DocxLoadError }

export function OfficePreviewApp() {
  const [state, setState] = useState<OfficeState>({ kind: 'waiting' })

  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      const filename = (message.filename as string) || ''
      if (message.type === 'load' && message.fileType === 'docx') {
        const features = (message.features ?? {}) as { saveAsMarkdownFromPreview?: boolean }
        setState({
          kind: 'docx',
          content: message.content as string,
          filename,
          canSaveAsMarkdown: features.saveAsMarkdownFromPreview ?? false,
        })
      } else if (message.type === 'load' && message.fileType === 'pptx') {
        setState({ kind: 'pptx', content: message.content as string, filename })
      } else if (message.type === 'loadError') {
        setState({
          kind: 'error',
          fileType: message.fileType === 'pptx' ? 'pptx' : 'docx',
          filename,
          error: { title: message.title as string, detail: message.detail as string },
        })
      }
    })
    sendToExtension('ready', {})
    return unsubscribe
  }, [])

  if (state.kind === 'waiting') {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-surface font-ui text-[13px] text-ink-muted">
        <Icon name="circle-notch" size={16} className="animate-spin" />
        Opening…
      </div>
    )
  }
  if (state.kind === 'error') {
    return state.fileType === 'pptx'
      ? <PPTXViewer content={null} filename={state.filename} loadError={state.error} />
      : <DOCXViewer content={null} filename={state.filename} loadError={state.error} />
  }
  if (state.kind === 'pptx') return <PPTXViewer content={state.content} filename={state.filename} />
  return <DOCXViewer content={state.content} filename={state.filename} canSaveAsMarkdown={state.canSaveAsMarkdown} />
}

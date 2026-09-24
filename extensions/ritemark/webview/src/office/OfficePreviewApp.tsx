/**
 * Sprint 124 (#284) R3 — the Office preview webview: its own bundle
 * (`media/office-preview.js`), so a Word tab loads ~1 MB instead of the shared
 * 8.9 MB editor bundle, and the Word renderer no longer ships inside it.
 * Sprint 125's PowerPoint preview joins here.
 *
 * The host handshake is the editors' own: send `ready`, receive `load`
 * (base64 content) or `loadError` (the host's pre-check refused the file).
 */
import { useEffect, useState } from 'react'
import { onMessage, sendToExtension } from '../bridge'
import { Icon } from '../components/ui/Icon'
import { DOCXViewer, type DocxLoadError } from '../components/viewers/DOCXViewer'

type OfficeState =
  | { kind: 'waiting' }
  | { kind: 'docx'; content: string; filename: string; canSaveAsMarkdown: boolean }
  | { kind: 'error'; filename: string; error: DocxLoadError }

export function OfficePreviewApp() {
  const [state, setState] = useState<OfficeState>({ kind: 'waiting' })

  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      if (message.type === 'load' && message.fileType === 'docx') {
        const features = (message.features ?? {}) as { saveAsMarkdownFromPreview?: boolean }
        setState({
          kind: 'docx',
          content: message.content as string,
          filename: (message.filename as string) || '',
          canSaveAsMarkdown: features.saveAsMarkdownFromPreview ?? false,
        })
      } else if (message.type === 'loadError') {
        setState({
          kind: 'error',
          filename: (message.filename as string) || '',
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
    return <DOCXViewer content={null} filename={state.filename} loadError={state.error} />
  }
  return <DOCXViewer content={state.content} filename={state.filename} canSaveAsMarkdown={state.canSaveAsMarkdown} />
}

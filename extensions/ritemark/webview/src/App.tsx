import { useState, useEffect, useCallback, useRef } from 'react'
import { onMessage, sendToExtension } from './bridge'
import { Editor } from './components/Editor'
import { SpreadsheetViewer } from './components/SpreadsheetViewer'
import { marked } from 'marked'
import type { EditorSelection } from './types/editor'
import type { Editor as TipTapEditor } from '@tiptap/react'
import type { DocumentProperties } from './components/properties'

type FileType = 'markdown' | 'csv' | 'xlsx'

function App() {
  const [content, setContent] = useState<string>('')
  const [fileType, setFileType] = useState<FileType>('markdown')
  const [filename, setFilename] = useState<string>('')
  const [encoding, setEncoding] = useState<string | undefined>()
  const [sizeBytes, setSizeBytes] = useState<number | undefined>()
  const [properties, setProperties] = useState<DocumentProperties>({})
  const [hasProperties, setHasProperties] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [imageMappings, setImageMappings] = useState<Record<string, string>>({})

  // Track selection for AI tool execution
  const [selection, setSelection] = useState<EditorSelection | null>(null)

  // Editor ref for tool execution
  const editorRef = useRef<TipTapEditor | null>(null)

  useEffect(() => {
    // Listen for messages from VS Code extension
    onMessage((message) => {
      switch (message.type) {
        case 'load':
          setContent(message.content as string)
          setFileType((message.fileType as FileType) || 'markdown')
          setFilename((message.filename as string) || '')
          setEncoding(message.encoding as string | undefined)
          setSizeBytes(message.sizeBytes as number | undefined)
          setProperties((message.properties as DocumentProperties) || {})
          setHasProperties(message.hasProperties as boolean || false)
          setImageMappings((message.imageMappings as Record<string, string>) || {})
          setIsReady(true)
          break

        case 'ai-widget':
          // Handle AI tool execution from AI panel
          const toolName = message.toolName as string
          const args = message.args as Record<string, unknown>
          const toolSelection = message.selection as EditorSelection | undefined
          handleToolCall(toolName, args, toolSelection)
          break
      }
    })

    // Tell extension we're ready
    sendToExtension('ready', {})
  }, [])

  // Handle tool calls from AI panel
  const handleToolCall = useCallback((
    toolName: string,
    args: Record<string, unknown>,
    toolSelection?: EditorSelection
  ) => {
    if (!editorRef.current) return

    const editor = editorRef.current
    // Use selection from AI panel or fall back to current selection
    const sel = toolSelection || selection

    switch (toolName) {
      case 'rephraseText':
        // Apply rephrase directly to selection
        if (sel && !sel.isEmpty) {
          const newText = args.newText as string
          editor.chain()
            .focus()
            .insertContentAt({ from: sel.from, to: sel.to }, newText)
            .run()
        }
        break

      case 'findAndReplaceAll':
        // Simple find/replace
        const searchPattern = args.searchPattern as string
        const replacement = args.replacement as string
        const currentContent = editor.getText()
        const regex = new RegExp(searchPattern, 'gi')
        const matches = currentContent.match(regex)

        if (matches && matches.length > 0) {
          // Get HTML, replace, set back
          const html = editor.getHTML()
          const newHtml = html.replace(regex, replacement)
          editor.commands.setContent(newHtml)
        }
        break

      case 'insertText':
        const position = args.position as { type: string; location?: string; anchor?: string; placement?: string } | undefined
        const insertContent = args.content as string

        if (!insertContent) break

        let insertPos: number

        if (!position || position.type === 'absolute') {
          // Default to end if position not specified
          if (position?.location === 'start') {
            insertPos = 1
          } else {
            // End of document
            insertPos = editor.state.doc.content.size - 1
          }
        } else if (position.type === 'selection') {
          insertPos = editor.state.selection.from
        } else if (position.type === 'relative' && position.anchor) {
          // Find anchor text in document
          const docText = editor.getText()
          const anchorIndex = docText.indexOf(position.anchor)
          if (anchorIndex !== -1) {
            if (position.placement === 'before') {
              insertPos = anchorIndex + 1 // +1 for doc offset
            } else {
              insertPos = anchorIndex + position.anchor.length + 1
            }
          } else {
            // Anchor not found, insert at end
            insertPos = editor.state.doc.content.size - 1
          }
        } else {
          // Fallback: insert at end
          insertPos = editor.state.doc.content.size - 1
        }

        // Convert markdown to HTML so TipTap creates proper nodes
        const htmlContent = marked.parse(insertContent) as string
        editor.chain().focus().insertContentAt(insertPos, htmlContent).run()
        break
    }
  }, [selection])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    sendToExtension('contentChanged', { content: newContent, properties })
  }

  const handlePropertiesChange = useCallback((newProperties: DocumentProperties) => {
    setProperties(newProperties)
    setHasProperties(Object.keys(newProperties).length > 0)
    sendToExtension('propertiesChanged', { properties: newProperties })
  }, [])

  const handleSelectionChange = useCallback((sel: EditorSelection) => {
    setSelection(sel)
    // Send selection to AI panel via extension
    sendToExtension('selectionChanged', { selection: sel })
  }, [])

  const handleEditorReady = useCallback((editor: TipTapEditor) => {
    editorRef.current = editor
  }, [])

  // Handle CSV content changes (must be before any early returns!)
  const handleCSVChange = useCallback((newContent: string) => {
    setContent(newContent)
    sendToExtension('contentChanged', { content: newContent })
  }, [])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--vscode-editor-background)]">
        <div className="text-[var(--vscode-foreground)]">Loading...</div>
      </div>
    )
  }

  // Route to SpreadsheetViewer for CSV/Excel files
  if (fileType === 'csv' || fileType === 'xlsx') {
    return (
      <SpreadsheetViewer
        content={content}
        filename={filename}
        fileType={fileType}
        encoding={encoding}
        sizeBytes={sizeBytes}
        onChange={fileType === 'csv' ? handleCSVChange : undefined}
      />
    )
  }

  // Default: Markdown editor
  return (
    <div className="h-screen bg-[var(--vscode-editor-background)]">
      <Editor
        value={content}
        onChange={handleContentChange}
        onSelectionChange={handleSelectionChange}
        onEditorReady={handleEditorReady}
        placeholder="Start writing..."
        className="h-full"
        properties={properties}
        hasProperties={hasProperties}
        onPropertiesChange={handlePropertiesChange}
        imageMappings={imageMappings}
      />
    </div>
  )
}

export default App

import { useState, useEffect, useCallback, useRef } from 'react'
import { onMessage, sendToExtension, onInternalEvent, InternalEvent } from './bridge'
import { Editor, getSelectionHTML, turndownService, preprocessTableHTML } from './components/Editor'
import { SpreadsheetViewer } from './components/SpreadsheetViewer'
import { DocumentHeader, PropertiesModal, ExportMenu } from './components/header'
import { marked } from 'marked'
import type { EditorSelection } from './types/editor'
import type { Editor as TipTapEditor } from '@tiptap/react'
import type { DocumentProperties } from './components/properties'

type FileType = 'markdown' | 'csv' | 'xlsx'

// Dictation placeholder texts
const LISTENING_PLACEHOLDER = '🎤 Listening...'
const PROCESSING_PLACEHOLDER = '⏳ Processing...'

/**
 * Find and remove a dictation placeholder from the editor
 * Returns true if found and removed
 */
function removeDictationPlaceholder(editor: TipTapEditor): boolean {
  const { state } = editor
  const { doc } = state

  // Search for either placeholder text and remove it
  let found = false
  doc.descendants((node, pos) => {
    if (found) return false
    if (node.isText) {
      const text = node.text || ''
      const listeningIdx = text.indexOf(LISTENING_PLACEHOLDER)
      const processingIdx = text.indexOf(PROCESSING_PLACEHOLDER)

      if (listeningIdx !== -1) {
        const start = pos + listeningIdx
        const end = start + LISTENING_PLACEHOLDER.length
        editor.chain().deleteRange({ from: start, to: end }).run()
        found = true
        return false
      }
      if (processingIdx !== -1) {
        const start = pos + processingIdx
        const end = start + PROCESSING_PLACEHOLDER.length
        editor.chain().deleteRange({ from: start, to: end }).run()
        found = true
        return false
      }
    }
  })

  return found
}

/**
 * Insert a dictation placeholder at cursor position
 */
function insertDictationPlaceholder(editor: TipTapEditor, placeholder: string) {
  // First remove any existing placeholder
  removeDictationPlaceholder(editor)

  // Insert new placeholder with styling
  editor.chain()
    .focus()
    .insertContent(`<span style="color: var(--vscode-descriptionForeground, #888); font-style: italic;">${placeholder}</span>`)
    .run()
}

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

  // UI state
  const [showPropertiesModal, setShowPropertiesModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportButtonRef = useRef<HTMLElement | null>(null)

  // File change notification state
  const [showFileChangeNotification, setShowFileChangeNotification] = useState(false)
  const [fileChangeData, setFileChangeData] = useState({ filename: '', isDirty: false })

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

        case 'dictation:transcription':
          // Insert transcribed text at cursor position
          const transcribedText = message.text as string
          if (transcribedText && editorRef.current) {
            // Remove any placeholder, then insert text
            removeDictationPlaceholder(editorRef.current)
            editorRef.current.chain()
              .focus()
              .insertContent(transcribedText + ' ')
              .run()
            // If still listening, show placeholder again for next chunk
            // (This will be handled by the next dictation:listening-started event)
          }
          break

        case 'fileChanged':
          // File changed externally - show notification banner
          setFileChangeData({
            filename: (message.filename as string) || '',
            isDirty: (message.isDirty as boolean) || false
          })
          setShowFileChangeNotification(true)
          break
      }
    })

    // Listen for internal webview events (dictation state changes)
    // These events coordinate UI between components without involving extension
    onInternalEvent((event: InternalEvent) => {
      switch (event.type) {
        case 'dictation:listening-started':
          // Show "Listening..." placeholder when recording starts
          if (editorRef.current) {
            insertDictationPlaceholder(editorRef.current, LISTENING_PLACEHOLDER)
          }
          break

        case 'dictation:processing':
          // Change to "Processing..." when audio chunk is sent for transcription
          if (editorRef.current) {
            insertDictationPlaceholder(editorRef.current, PROCESSING_PLACEHOLDER)
          }
          break

        case 'dictation:listening-stopped':
          // Remove placeholder when dictation ends
          if (editorRef.current) {
            removeDictationPlaceholder(editorRef.current)
          }
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

  // Header button handlers
  const handlePropertiesClick = useCallback(() => {
    setShowPropertiesModal(true)
  }, [])

  const handleExportClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    exportButtonRef.current = event.currentTarget
    setShowExportMenu(prev => !prev)
  }, [])

  const handleClosePropertiesModal = useCallback(() => {
    setShowPropertiesModal(false)
  }, [])

  const handleCloseExportMenu = useCallback(() => {
    setShowExportMenu(false)
  }, [])

  // Export handlers
  const handleExportPDF = useCallback(() => {
    sendToExtension('exportPDF', {
      content,
      properties,
    })
  }, [content, properties])

  const handleExportWord = useCallback(() => {
    sendToExtension('exportWord', {
      markdown: content,
      properties,
    })
  }, [content, properties])

  const handleCopyAsMarkdown = useCallback(async () => {
    if (!editorRef.current) return

    try {
      // Get HTML from selection or full document
      const html = getSelectionHTML(editorRef.current)

      // Clean HTML for proper markdown conversion (removes colgroup, unwraps <p> in cells)
      const cleanedHTML = preprocessTableHTML(html)

      // Convert to markdown
      const markdown = turndownService.turndown(cleanedHTML)

      // Copy to clipboard
      await navigator.clipboard.writeText(markdown)
    } catch (error) {
      console.error('Failed to copy markdown:', error)
    }
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
    <div className="h-screen bg-[var(--vscode-editor-background)] flex flex-col">
      {/* Document Header - Sticky with Properties and Export buttons */}
      <DocumentHeader
        onPropertiesClick={handlePropertiesClick}
        onExportClick={handleExportClick}
        hasFileChanged={showFileChangeNotification}
        onRefresh={() => {
          setShowFileChangeNotification(false)
          sendToExtension('refresh')
        }}
      />

      {/* Editor - Takes remaining space */}
      <div className="flex-1 overflow-y-auto">
        <Editor
          value={content}
          onChange={handleContentChange}
          onSelectionChange={handleSelectionChange}
          onEditorReady={handleEditorReady}
          placeholder="Start writing..."
          className="h-full"
          imageMappings={imageMappings}
        />
      </div>

      {/* Properties Modal */}
      <PropertiesModal
        isOpen={showPropertiesModal}
        onClose={handleClosePropertiesModal}
        properties={properties}
        onPropertiesChange={handlePropertiesChange}
      />

      {/* Export Menu */}
      <ExportMenu
        isOpen={showExportMenu}
        onClose={handleCloseExportMenu}
        onExportPDF={handleExportPDF}
        onExportWord={handleExportWord}
        onCopyAsMarkdown={handleCopyAsMarkdown}
        anchorElement={exportButtonRef.current}
      />
    </div>
  )
}

export default App

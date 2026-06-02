import { useState, useEffect, useCallback, useRef } from 'react'
import { onMessage, sendToExtension, onInternalEvent, InternalEvent } from './bridge'
import { Editor, getSelectionHTML, turndownService, preprocessTableHTML } from './components/Editor'
import { SpreadsheetViewer } from './components/SpreadsheetViewer'
import { PDFViewer } from './components/viewers/PDFViewer'
import { DOCXViewer } from './components/viewers/DOCXViewer'
import { DocumentHeader, PropertiesModal, ExportMenu } from './components/header'
import { PropertiesSidePanel } from './components/properties'
import { AgentConfiguratorPanel } from './components/agent'
import type { AgentFrontmatter, AgentSkill } from './components/agent'
import { FindBar } from './components/FindBar'
import { InlineTableOfContents } from './components/InlineTableOfContents'
import { inlineMermaidDiagramsForExport } from './lib/mermaidExport'
import { writeClipboard } from './lib/clipboard'
import { getHeadings } from './lib/headingUtils'
import type { Heading } from './lib/headingUtils'
import { marked } from 'marked'
import type { EditorSelection } from './types/editor'
import type { Editor as TipTapEditor } from '@tiptap/react'
import type { DocumentProperties } from './components/properties'

type FileType = 'markdown' | 'csv' | 'xlsx' | 'pdf' | 'docx'
type SidePanel = 'none' | 'toc' | 'properties' | 'agent'

// Minimum container width (px) at which the inline ToC panel is shown.
// Tunable in T7 during live testing.

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

// Feature flags sent from extension
interface Features {
  voiceDictation: boolean
  markdownExport: boolean
  saveAsMarkdownFromPreview: boolean
}

function App() {
  const [content, setContent] = useState<string>('')
  const [fileType, setFileType] = useState<FileType>('markdown')
  const [filename, setFilename] = useState<string>('')
  const [encoding, setEncoding] = useState<string | undefined>()
  const [sizeBytes, setSizeBytes] = useState<number | undefined>()
  const [workerSrc, setWorkerSrc] = useState<string | undefined>()
  const [properties, setProperties] = useState<DocumentProperties>({})
  const [_hasProperties, setHasProperties] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [imageMappings, setImageMappings] = useState<Record<string, string>>({})
  const [features, setFeatures] = useState<Features>({
    voiceDictation: false,
    markdownExport: false,
    saveAsMarkdownFromPreview: false
  })

  // Track selection for AI tool execution
  const [selection, setSelection] = useState<EditorSelection | null>(null)

  // Editor ref for tool execution
  const editorRef = useRef<TipTapEditor | null>(null)

  // UI state
  const [showPropertiesModal, setShowPropertiesModal] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportButtonRef = useRef<HTMLElement | null>(null)

  // Agent mode state
  const [isAgentMode, setIsAgentMode] = useState(false)
  const [agentFrontmatter, setAgentFrontmatter] = useState<AgentFrontmatter>({})
  const [agentFlows, setAgentFlows] = useState<string[]>([])
  const [agentSkills, setAgentSkills] = useState<AgentSkill[]>([])

  // Side panel state — TOC and Properties share the same slot
  const [activePanel, setActivePanel] = useState<SidePanel>(() => {
    try {
      const stored = localStorage.getItem('ritemark.activePanel')
      if (stored === 'toc' || stored === 'properties') return stored
      // Migrate from old inlineTocEnabled preference
      const oldPref = localStorage.getItem('ritemark.inlineTocEnabled')
      if (oldPref === 'true') return 'toc'
    } catch { /* ignore */ }
    return 'none'
  })

  // Find bar state
  const [showFindBar, setShowFindBar] = useState(false)

  const contentsButtonRef = useRef<HTMLButtonElement>(null)

  // Inline ToC state
  const editorScrollRef = useRef<HTMLDivElement>(null)
  const flexWrapperRef = useRef<HTMLDivElement>(null)
  const [activeHeadingPos, setActiveHeadingPos] = useState<number | null>(null)
  const [headings, setHeadings] = useState<Heading[]>([])
  // Flag flipped when handleEditorReady fires so effects depending on
  // editorRef.current actually re-run (ref mutations don't trigger re-renders).
  const [editorReady, setEditorReady] = useState(false)
  // inlineTocEnabled is now derived from activePanel (see side panel state above)

  // File change notification state
  const [showFileChangeNotification, setShowFileChangeNotification] = useState(false)
  const [_fileChangeData, setFileChangeData] = useState({ filename: '', isDirty: false })

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
          if (message.workerSrc) setWorkerSrc(message.workerSrc as string)
          setProperties((message.properties as DocumentProperties) || {})
          setHasProperties(message.hasProperties as boolean || false)
          setImageMappings((message.imageMappings as Record<string, string>) || {})
          setFeatures((message.features as Features) || {
            voiceDictation: false,
            markdownExport: false,
            saveAsMarkdownFromPreview: false
          })
          if (message.isAgentMode) {
            setIsAgentMode(true)
            setAgentFrontmatter((message.agentFrontmatter as AgentFrontmatter) || {})
            setAgentFlows((message.agentFlows as string[]) || [])
            setAgentSkills((message.agentSkills as AgentSkill[]) || [])
            setActivePanel('agent')
          }
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
          // External edit while user has unsaved local changes — surface the
          // refresh button so they can decide whether to discard their work.
          setFileChangeData({
            filename: (message.filename as string) || '',
            isDirty: (message.isDirty as boolean) || false
          })
          setShowFileChangeNotification(true)
          break

        case 'externalChange':
          // External edit, document was clean → silently swap in the new
          // content (same payload shape as 'load'). Mirrors how collaborative
          // editors apply remote changes without prompting.
          setContent(message.content as string)
          setProperties((message.properties as DocumentProperties) || {})
          setHasProperties(message.hasProperties as boolean || false)
          setImageMappings((message.imageMappings as Record<string, string>) || {})
          // Clear any stale refresh banner from a previous dirty-state event.
          setShowFileChangeNotification(false)
          break

        case 'agentFlowsUpdated':
          setAgentFlows((message.flows as string[]) || [])
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

  // CMD+F keyboard shortcut to open find bar (or advance to next match if already open)
  // Only intercept in markdown mode — let PDF/DOCX/Spreadsheet viewers handle their own find
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (fileType !== 'markdown') return
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'f') {
        e.preventDefault()
        e.stopPropagation()
        if (showFindBar && editorRef.current) {
          // Already open: cycle to next match
          editorRef.current.commands.nextSearchResult()
        } else {
          setShowFindBar(true)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown, true) // capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [showFindBar, fileType])

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
    setEditorReady(true)
  }, [])

  // Handle CSV content changes (must be before any early returns!)
  const handleCSVChange = useCallback((newContent: string) => {
    setContent(newContent)
    sendToExtension('contentChanged', { content: newContent })
  }, [])

  // Side panel toggle helper — TOC / Properties / Agent share one slot, mutually exclusive.
  // 'agent' is intentionally not restored from localStorage on init (it's auto-pinned on
  // load only for agent files), so writing it here is harmless across sessions.
  const togglePanel = useCallback((panel: SidePanel) => {
    setActivePanel(prev => {
      const next = prev === panel ? 'none' : panel
      try { localStorage.setItem('ritemark.activePanel', next) } catch { /* ignore */ }
      // Also sync old preference key for backwards compat
      try { localStorage.setItem('ritemark.inlineTocEnabled', String(next === 'toc')) } catch { /* ignore */ }
      return next
    })
  }, [])

  const handleAgentFrontmatterChange = useCallback((fm: AgentFrontmatter) => {
    setAgentFrontmatter(fm)
    sendToExtension('applyFrontmatter', { frontmatter: fm })
  }, [])

  const handleCreateFlow = useCallback(() => {
    sendToExtension('createAgentFlow', {})
  }, [])

  // Header button handlers
  const handlePropertiesClick = useCallback(() => {
    togglePanel('properties')
  }, [togglePanel])

  const handleAgentPanelClick = useCallback(() => {
    togglePanel('agent')
  }, [togglePanel])

  const handleExportClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    exportButtonRef.current = event.currentTarget
    setShowExportMenu(prev => !prev)
  }, [])

  const toggleInlineToc = useCallback(() => {
    togglePanel('toc')
  }, [togglePanel])

  const handleClosePropertiesModal = useCallback(() => {
    setShowPropertiesModal(false)
  }, [])

  const handleCloseExportMenu = useCallback(() => {
    setShowExportMenu(false)
  }, [])

  // Export handlers
  const handleExportPDF = useCallback(async (templateId = 'default') => {
    const rawHtml = editorRef.current ? preprocessTableHTML(editorRef.current.getHTML()) : ''
    const html = await inlineMermaidDiagramsForExport(rawHtml)

    sendToExtension('exportPDF', {
      content, // markdown fallback (V1 compatibility)
      html,
      properties,
      templateId,
    })
  }, [content, properties])

  const handleExportWord = useCallback(async (templateId = 'default') => {
    const rawHtml = editorRef.current ? preprocessTableHTML(editorRef.current.getHTML()) : ''
    const html = await inlineMermaidDiagramsForExport(rawHtml)

    sendToExtension('exportWord', {
      markdown: content, // markdown fallback (V1 compatibility)
      html,
      properties,
      templateId,
    })
  }, [content, properties])

  const handleCopyAsMarkdown = useCallback(() => {
    if (!editorRef.current) return
    const html = getSelectionHTML(editorRef.current)
    const cleanedHTML = preprocessTableHTML(html)
    const markdown = turndownService.turndown(cleanedHTML)
    writeClipboard(markdown)
  }, [])

  // Scroll-spy: track which heading is currently topmost in the editor view.
  // Uses a scroll listener (not IntersectionObserver) so the active heading is
  // always well-defined — between headings, the most recently scrolled-past
  // heading stays active. Re-runs when heading count changes, visibility
  // toggles, or the user flips the inline-ToC preference.
  useEffect(() => {
    if (!editorRef.current) return
    if (activePanel !== 'toc') return
    if (headings.length < 2) return
    const editor = editorRef.current
    // The real scroll container is the Editor's inner `.overflow-y-auto` div
    // (see Editor.tsx:938), NOT our outer editorScrollRef. Use the same
    // lookup that FindBar and scrollToHeading use.
    const scrollContainer = editor.view.dom.closest('.overflow-y-auto') as HTMLElement | null
    if (!scrollContainer) return

    let rafId: number | null = null
    const computeActive = () => {
      rafId = null
      const nodes = Array.from(
        editor.view.dom.querySelectorAll('h1,h2,h3,h4,h5,h6')
      ) as HTMLElement[]
      const count = Math.min(nodes.length, headings.length)
      if (count === 0) return
      const containerTop = scrollContainer.getBoundingClientRect().top
      // Anchor line: 120px below the top of the scroll container. A heading
      // becomes "active" once its top crosses this line while scrolling down.
      const anchorOffset = 120
      let activeIdx = 0
      for (let i = 0; i < count; i++) {
        const top = nodes[i].getBoundingClientRect().top - containerTop
        if (top - anchorOffset <= 0) activeIdx = i
        else break
      }
      // Map by index, not by posAtDOM — DOM order matches headings array order,
      // and headings[i].pos is the canonical ProseMirror position used by the
      // InlineTableOfContents comparator.
      setActiveHeadingPos(headings[activeIdx].pos)
    }
    const onScroll = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(computeActive)
    }

    computeActive()
    scrollContainer.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      scrollContainer.removeEventListener('scroll', onScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [activePanel, headings])

  // Headings refresh: rebuild headings array whenever the editor content changes.
  // Depends on editorReady (a state flag) rather than editorRef.current directly —
  // ref mutations don't trigger effect re-runs.
  useEffect(() => {
    if (!editorReady || !editorRef.current) return
    const editor = editorRef.current
    const refresh = () => setHeadings(getHeadings(editor))
    refresh()
    editor.on('update', refresh)
    return () => { editor.off('update', refresh) }
  }, [editorReady])

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-foreground">Loading...</div>
      </div>
    )
  }

  // Route to PDFViewer for PDF files
  if (fileType === 'pdf') {
    return (
      <PDFViewer
        content={content}
        filename={filename}
        workerSrc={workerSrc}
        canSaveAsMarkdown={features.saveAsMarkdownFromPreview}
      />
    )
  }

  // Route to DOCXViewer for Word documents
  if (fileType === 'docx') {
    return (
      <DOCXViewer
        content={content}
        filename={filename}
        canSaveAsMarkdown={features.saveAsMarkdownFromPreview}
      />
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

  // Side panel visibility derivation
  const inlineTocShown = activePanel === 'toc' && headings.length >= 2
  const propertiesPanelShown = activePanel === 'properties'
  const agentPanelShown = activePanel === 'agent' && isAgentMode

  const contentsClick = headings.length >= 2 ? toggleInlineToc : undefined

  // Default: Markdown editor
  return (
    <div className="h-screen bg-surface flex flex-col">
      {/* Document Header - Sticky with Properties and Export buttons */}
      <DocumentHeader
        onPropertiesClick={handlePropertiesClick}
        onExportClick={handleExportClick}
        onContentsClick={contentsClick}
        contentsButtonRef={contentsButtonRef}
        contentsActive={inlineTocShown}
        propertiesActive={propertiesPanelShown}
        agentActive={agentPanelShown}
        onAgentClick={isAgentMode ? handleAgentPanelClick : undefined}
        hasFileChanged={showFileChangeNotification}
        onRefresh={() => {
          setShowFileChangeNotification(false)
          sendToExtension('refresh')
        }}
        features={features}
      />

      {/* Editor row — flex-row so side panel sits left of the scroll container */}
      <div ref={flexWrapperRef} className="flex-1 flex overflow-hidden" style={{ position: 'relative' }}>
        {/* Inline Table of Contents — mutually exclusive with Properties */}
        {inlineTocShown && editorRef.current && (
          <InlineTableOfContents
            editor={editorRef.current}
            headings={headings}
            activeHeadingPos={activeHeadingPos}
          />
        )}

        {/* Properties side panel — mutually exclusive with TOC */}
        {propertiesPanelShown && (
          <PropertiesSidePanel
            properties={properties}
            onChange={handlePropertiesChange}
          />
        )}

        {/* Agent configurator panel — shown when editing a .claude/agents/*.md file */}
        {agentPanelShown && (
          <AgentConfiguratorPanel
            frontmatter={agentFrontmatter}
            flows={agentFlows}
            skills={agentSkills}
            onFrontmatterChange={handleAgentFrontmatterChange}
            onCreateFlow={handleCreateFlow}
          />
        )}

        {/* Editor scroll container */}
        <div ref={editorScrollRef} className="flex-1 overflow-y-auto" style={{ position: 'relative' }}>
          {/* Find Bar */}
          {showFindBar && editorRef.current && (
            <FindBar
              editor={editorRef.current}
              onClose={() => setShowFindBar(false)}
            />
          )}

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

import { BubbleMenu, type Editor as TipTapEditor } from '@tiptap/react'
import { getMarkRange } from '@tiptap/core'
import { useState, useEffect, useRef } from 'react'
import { Icon } from './ui/Icon'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { modKey } from '@/hooks/usePlatform'
import { openExternalUrl, openInternalLink } from '../bridge'
import { classifyLinkTarget } from '../lib/linkTargets'
import {
  requestWorkspaceFileSearch,
  type WorkspaceFileLinkResult,
} from '../lib/workspaceFileSearch'

/**
 * FormattingBubbleMenu Component
 *
 * Provides a context-sensitive formatting toolbar that appears when text is selected.
 * Features: Bold, Italic, Headings (H1, H2, H3), and Link management with smart URL validation.
 *
 * @see /docs/components/FormattingBubbleMenu.md for full documentation
 */

interface FormattingBubbleMenuProps {
  /** The TipTap editor instance (required). Must have Bold, Italic, Heading, and Link extensions. */
  editor: TipTapEditor | null
  /** External link edit trigger - when set, opens dialog with this URL */
  externalLinkEdit?: { url: string } | null
  /** Callback when external link edit is handled (to clear the trigger) */
  onExternalLinkEditDone?: () => void
  /** Sprint 94 (#81): show the "Comment" action (gated on the comment-callouts flag). */
  commentCallouts?: boolean
}

export function FormattingBubbleMenu({
  editor,
  externalLinkEdit,
  onExternalLinkEditDone,
  commentCallouts = false
}: FormattingBubbleMenuProps) {
  // Link dialog state management
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  // Sprint 74 R4 (#93): optional visible text for the link
  const [linkDisplayText, setLinkDisplayText] = useState('')
  const [urlError, setUrlError] = useState('')
  const [fileSearchResults, setFileSearchResults] = useState<WorkspaceFileLinkResult[]>([])
  const [fileSearchReason, setFileSearchReason] = useState('')
  const [fileSearchLoading, setFileSearchLoading] = useState(false)
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const linkInputRef = useRef<HTMLInputElement>(null)
  const isFileSearchMode = linkUrl.trim().startsWith('@')

  // Handle external link edit trigger (from clicking a link in the editor)
  useEffect(() => {
    if (externalLinkEdit) {
      setLinkUrl(externalLinkEdit.url)
      // Pre-populate display text (Sprint 74 R4 / #93). Clicking a link leaves
      // a collapsed cursor inside it, so read the full link-mark range for the
      // field. NOTE: do NOT mutate the editor selection here — dispatching a
      // transaction inside this effect triggers a React render loop (#185).
      // handleSetLink recomputes the same range when applying the update.
      if (editor) {
        const { from, to } = editor.state.selection
        if (from !== to) {
          setLinkDisplayText(editor.state.doc.textBetween(from, to, ' '))
        } else {
          const range = getMarkRange(
            editor.state.selection.$from,
            editor.state.schema.marks.link,
          )
          setLinkDisplayText(
            range ? editor.state.doc.textBetween(range.from, range.to, ' ') : '',
          )
        }
      }
      setUrlError('')
      setShowLinkDialog(true)
      onExternalLinkEditDone?.()
    }
  }, [externalLinkEdit, onExternalLinkEditDone, editor])

  // Auto-focus link input when dialog opens (with small delay for animation)
  useEffect(() => {
    if (showLinkDialog && linkInputRef.current) {
      setTimeout(() => linkInputRef.current?.focus(), 100)
    }
  }, [showLinkDialog])

  useEffect(() => {
    if (!showLinkDialog || !isFileSearchMode) {
      setFileSearchResults([])
      setFileSearchReason('')
      setFileSearchLoading(false)
      setSelectedFileIndex(0)
      return
    }

    let cancelled = false
    const query = linkUrl.trim().slice(1)
    setFileSearchLoading(true)

    const timer = setTimeout(() => {
      requestWorkspaceFileSearch(query, 20).then((response) => {
        if (cancelled) return
        setFileSearchResults(response.results)
        setFileSearchReason(response.unavailableReason ?? '')
        setSelectedFileIndex(0)
        setFileSearchLoading(false)
      })
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [showLinkDialog, isFileSearchMode, linkUrl])

  // Global keyboard shortcut handler for Cmd+K / Ctrl+K (link dialog)
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.metaKey || event.ctrlKey

      if (isMod && event.key === 'k') {
        event.preventDefault()
        const { selection } = editor.state
        const { empty } = selection

        // Guard: Don't open dialog in code blocks (matches BubbleMenu shouldShow logic)
        if (!empty && !editor.isActive('codeBlock')) {
          const previousUrl = editor.getAttributes('link').href
          const { from, to } = editor.state.selection
          setLinkUrl(previousUrl || '')
          setLinkDisplayText(editor.state.doc.textBetween(from, to, ' '))
          setUrlError('')
          setShowLinkDialog(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editor])

  // No click-outside handler needed - Radix Dialog handles this automatically

  if (!editor) return null

  /**
   * Applies or updates a link on the selected text.
   * Validates URL format and shows inline error if invalid.
   * Provides user feedback if the link command fails.
   */
  const handleSetLink = () => {
    if (!linkUrl.trim()) {
      setUrlError('Please enter a URL or local file path')
      return
    }

    const target = classifyLinkTarget(linkUrl)
    if (target.kind === 'dangerous' || target.kind === 'empty') {
      setUrlError('Please enter a valid web URL or relative file path')
      return
    }

    // Sprint 74 R4 (#93): if the user provided display text that differs from
    // the current selection, replace the selection (or insert at the cursor)
    // with that text carrying the link mark. Empty/unchanged display text
    // preserves the original setLink behaviour.
    const displayText = linkDisplayText.trim()
    // When the cursor sits collapsed inside an existing link, operate on the
    // whole link-mark range so Update replaces its text instead of inserting
    // at the cursor (#93). With a real selection, respect it as-is.
    const sel = editor.state.selection
    let from = sel.from
    let to = sel.to
    if (sel.empty) {
      const markRange = getMarkRange(sel.$from, editor.state.schema.marks.link)
      if (markRange) {
        from = markRange.from
        to = markRange.to
      }
    }
    const selectedText = from !== to ? editor.state.doc.textBetween(from, to, ' ') : ''

    let success: boolean
    if (displayText && displayText !== selectedText) {
      success = editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
          const linkMark = state.schema.marks.link.create({ href: target.href })
          const textNode = state.schema.text(displayText, [linkMark])
          if (from !== to) {
            tr.replaceWith(from, to, textNode)
          } else {
            tr.insert(from, textNode)
          }
          return true
        })
        .run()
    } else {
      success = editor
        .chain()
        .focus()
        .setLink({ href: target.href })
        .run()
    }

    if (success) {
      setShowLinkDialog(false)
      setLinkUrl('')
      setLinkDisplayText('')
      setUrlError('')
    } else {
      setUrlError('Cannot add link here (links not allowed in this context)')
    }
  }

  /**
   * Removes the link from selected text while preserving the text itself.
   */
  const handleRemoveLink = () => {
    editor.chain().focus().unsetLink().run()
    setShowLinkDialog(false)
    setLinkUrl('')
    setLinkDisplayText('')
    setUrlError('')
  }

  /**
   * Opens link dialog and pre-fills with existing URL if text is already linked.
   * Display text pre-populates from the current selection (Sprint 74 R4).
   */
  const handleOpenLinkDialog = () => {
    const previousUrl = editor.getAttributes('link').href
    const { from, to } = editor.state.selection
    setLinkUrl(previousUrl || '')
    setLinkDisplayText(from !== to ? editor.state.doc.textBetween(from, to, ' ') : '')
    setUrlError('')
    setShowLinkDialog(true)
  }

  const selectFileSearchResult = (result: WorkspaceFileLinkResult) => {
    setLinkUrl(result.relativePath)
    setUrlError('')
    setFileSearchResults([])
    setFileSearchReason('')
    linkInputRef.current?.focus()
  }

  const handleLinkInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isFileSearchMode) {
      if (e.key === 'ArrowDown' && fileSearchResults.length > 0) {
        e.preventDefault()
        setSelectedFileIndex((selectedFileIndex + 1) % fileSearchResults.length)
        return
      }

      if (e.key === 'ArrowUp' && fileSearchResults.length > 0) {
        e.preventDefault()
        setSelectedFileIndex((selectedFileIndex + fileSearchResults.length - 1) % fileSearchResults.length)
        return
      }

      if (e.key === 'Enter' && fileSearchResults[selectedFileIndex]) {
        e.preventDefault()
        selectFileSearchResult(fileSearchResults[selectedFileIndex])
        return
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      handleSetLink()
    }
  }

  return (
    <>
      {/* Main formatting toolbar - appears on text selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{
          maxWidth: 'none', // Remove default max-width constraint
        }}
        shouldShow={({ editor, state }) => {
          const { selection } = state
          const { empty } = selection

          if (empty) return false
          if (editor.isActive('codeBlock')) return false

          return true
        }}
      >
        <div className="flex items-center gap-1 bg-white border border-hairline-strong rounded shadow-lg p-2">
          {/* Bold Button - Keyboard: Ctrl+B / Cmd+B */}
          <button
            onMouseDown={(e) => e.preventDefault()} // Prevents editor from losing focus
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-3 py-1 rounded text-sm font-semibold hover:bg-surface-soft transition-colors ${
              editor.isActive('bold') ? 'bg-surface-soft' : ''
            }`}
            title="Bold (Ctrl+B)"
          >
            B
          </button>

          {/* Italic Button - Keyboard: Ctrl+I / Cmd+I */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-3 py-1 rounded text-sm italic hover:bg-surface-soft transition-colors ${
              editor.isActive('italic') ? 'bg-surface-soft' : ''
            }`}
            title="Italic (Ctrl+I)"
          >
            I
          </button>

          {/* Visual divider between text styles and headings */}
          <div className="w-px h-6 bg-hairline-strong mx-1" />

          {/* Heading 1 Button - Large heading */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-1 rounded text-sm font-semibold hover:bg-surface-soft transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-surface-soft' : ''
            }`}
            title="Heading 1"
          >
            H1
          </button>

          {/* Heading 2 Button - Medium heading */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-1 rounded text-sm font-semibold hover:bg-surface-soft transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-surface-soft' : ''
            }`}
            title="Heading 2"
          >
            H2
          </button>

          {/* Heading 3 Button - Small heading */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-3 py-1 rounded text-sm font-semibold hover:bg-surface-soft transition-colors ${
              editor.isActive('heading', { level: 3 }) ? 'bg-surface-soft' : ''
            }`}
            title="Heading 3"
          >
            H3
          </button>

          {/* Visual divider between headings and lists */}
          <div className="w-px h-6 bg-hairline-strong mx-1" />

          {/* Bullet List Button - Toggle on/off */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-3 py-1 rounded text-sm hover:bg-surface-soft transition-colors flex items-center ${
              editor.isActive('bulletList') ? 'bg-surface-soft' : ''
            }`}
            title="Bullet List"
          >
            <Icon name="list" size={16} />
          </button>

          {/* Ordered List Button - Toggle on/off */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-3 py-1 rounded text-sm hover:bg-surface-soft transition-colors flex items-center ${
              editor.isActive('orderedList') ? 'bg-surface-soft' : ''
            }`}
            title="Numbered List"
          >
            <Icon name="list-numbers" size={16} />
          </button>

          {/* Task List Button - Toggle on/off */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`px-3 py-1 rounded text-sm hover:bg-surface-soft transition-colors flex items-center ${
              editor.isActive('taskList') ? 'bg-surface-soft' : ''
            }`}
            title="Task List"
          >
            <Icon name="list-checks" size={16} />
          </button>

          {/* Visual divider before blockquote and link */}
          <div className="w-px h-6 bg-hairline-strong mx-1" />

          {/* Blockquote Button - Toggle on/off */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`px-3 py-1 rounded text-sm hover:bg-surface-soft transition-colors flex items-center ${
              editor.isActive('blockquote') ? 'bg-surface-soft' : ''
            }`}
            title="Blockquote"
          >
            <Icon name="quotes" size={16} />
          </button>

          {/* Code Block Button - Toggle on/off */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`px-3 py-1 rounded text-sm hover:bg-surface-soft transition-colors flex items-center ${
              editor.isActive('codeBlock') ? 'bg-surface-soft' : ''
            }`}
            title="Code Block"
          >
            <Icon name="code" size={16} />
          </button>

          {/* Link Button - Keyboard: Cmd+K / Ctrl+K */}
          <button
            onClick={handleOpenLinkDialog}
            onMouseDown={(e) => e.preventDefault()}
            className={`px-3 py-1 rounded text-sm hover:bg-surface-soft transition-colors flex items-center ${
              editor.isActive('link') ? 'bg-surface-soft' : ''
            }`}
            title={`Add/Edit Link (${modKey}+K)`}
          >
            <Icon name="link-simple" size={16} />
          </button>

          {/* Comment Button (Sprint 94 #81) — anchors an empty comment on the
              selection; the margin rail opens a compose bubble for it. */}
          {commentCallouts && (
            <>
              <div className="w-px h-6 bg-hairline-strong mx-1" />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  editor.chain().focus().setCommentMark({ note: '', agentAlias: null }).run()
                }
                className="px-3 py-1 rounded text-sm hover:bg-surface-soft transition-colors flex items-center gap-1.5"
                title="Add comment"
              >
                <Icon name="chat" size={16} />
                Comment
              </button>
            </>
          )}
        </div>
      </BubbleMenu>

      {/*
        Link Dialog - Separate modal for better UX and accessibility
        Uses Radix Dialog for proper focus trapping and keyboard navigation
      */}
      <Dialog.Root
        open={showLinkDialog}
        onOpenChange={(open) => {
          setShowLinkDialog(open)
          if (!open) {
            setLinkUrl('')
            setLinkDisplayText('')
            setUrlError('')
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 z-50 w-96">
            <Dialog.Title className="text-lg font-semibold mb-4">
              {editor.isActive('link') ? 'Edit Link' : 'Add Link'}
            </Dialog.Title>
            <div className="space-y-4">
              <div>
                <div className="flex gap-2">
                  <input
                    ref={linkInputRef}
                    type="text"
                    value={linkUrl}
                    onChange={(e) => {
                      setLinkUrl(e.target.value)
                      setUrlError('') // Clear validation error while user types
                    }}
                    onKeyDown={handleLinkInputKeyDown}
                    placeholder="example.com, https://example.com, or @file"
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/*
                    Open-target icon — Sprint 72 R7 follow-up. Same affordance
                    for both external URLs and internal relative paths so
                    `Cmd+click` is not the only way to follow a link from the
                    dialog. Hidden while the user is typing an `@search`
                    query because that text is not yet a real target.
                  */}
                  {linkUrl && !isFileSearchMode && (() => {
                    const target = classifyLinkTarget(linkUrl)
                    // Only external URLs and in-workspace internal paths are
                    // openable from this dialog. Same-document anchors
                    // (`#section`), dangerous protocols, and empty targets
                    // have no "open" action — no icon, no surprise.
                    if (target.kind !== 'external' && target.kind !== 'internal') return null
                    const isExternal = target.kind === 'external'
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (isExternal) {
                            openExternalUrl(target.href)
                          } else {
                            openInternalLink(target.href)
                          }
                          setShowLinkDialog(false)
                        }}
                        className="px-3 py-2 border rounded text-ink-muted hover:text-ink-strong hover:bg-surface-muted transition-colors"
                        title={
                          isExternal
                            ? `Open in browser (${modKey}+click also works)`
                            : `Open file (${modKey}+click also works)`
                        }
                      >
                        <Icon name="arrow-square-out" size={16} />
                      </button>
                    )
                  })()}
                </div>
                {/* Inline validation error message */}
                {urlError && (
                  <p className="text-sm text-ritemark-error mt-1">{urlError}</p>
                )}
                {/* Sprint 74 R4 (#93): optional display text for the link.
                    Hidden during @file search — that flow picks a path first. */}
                {!isFileSearchMode && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-1 text-ink-muted">
                      Display text <span className="font-normal text-ink-faint">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={linkDisplayText}
                      onChange={(e) => setLinkDisplayText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleSetLink()
                        }
                      }}
                      placeholder="Visible text for the link"
                      className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
                {isFileSearchMode && (
                  <div className="mt-2 rounded border border-hairline-strong bg-white shadow-sm max-h-56 overflow-y-auto">
                    {fileSearchLoading ? (
                      <div className="px-3 py-2 text-sm text-ink-muted">Searching files...</div>
                    ) : fileSearchReason ? (
                      <div className="px-3 py-2 text-sm text-ink-muted">{fileSearchReason}</div>
                    ) : fileSearchResults.length > 0 ? (
                      fileSearchResults.map((result, index) => (
                        <button
                          key={result.workspacePath}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm border-none bg-transparent hover:bg-surface-soft"
                          style={{
                            background: index === selectedFileIndex
                              ? 'var(--r-surface-soft)'
                              : 'transparent',
                          }}
                          onMouseEnter={() => setSelectedFileIndex(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectFileSearchResult(result)}
                        >
                          <span className="block font-medium truncate">{result.label}</span>
                          <span className="block text-xs text-ink-muted truncate">
                            {result.directory || result.relativePath}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-ink-muted">No matching files</div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                {/* Remove button only shown when editing existing link */}
                {editor.isActive('link') && (
                  <Button
                    onClick={handleRemoveLink}
                    variant="destructive"
                  >
                    <Icon name="x" size={20} />
                    Remove
                  </Button>
                )}
                <Button
                  onClick={() => setShowLinkDialog(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                {/* Primary action button - changes label based on add vs. edit mode */}
                <Button
                  onClick={handleSetLink}
                  variant="default"
                >
                  <Icon name="check" size={20} />
                  {editor.isActive('link') ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

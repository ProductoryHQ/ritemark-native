import { BubbleMenu, type Editor as TipTapEditor } from '@tiptap/react'
import { useState, useEffect, useRef } from 'react'
import { Link2, Check, X, Table, List, ListOrdered, ListChecks, ExternalLink } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { TablePicker } from './TablePicker'
import { openExternalUrl } from '../bridge'

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
}

/**
 * Normalizes URLs by auto-prepending https:// if no protocol is present.
 * Converts protocol to lowercase for TipTap Link validator compatibility.
 *
 * @param url - Raw URL input from user
 * @returns Normalized URL with protocol, or empty string if input was empty
 *
 * @example
 * normalizeUrl('example.com') // Returns: 'https://example.com'
 * normalizeUrl('https://example.com') // Returns: 'https://example.com' (unchanged)
 * normalizeUrl('HTTPS://example.com') // Returns: 'https://example.com' (protocol lowercased)
 */
function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''

  // Auto-add https:// if no protocol
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`
  }

  // Convert protocol to lowercase for TipTap Link validator
  return trimmed.replace(/^HTTPS?:\/\//i, (match) => match.toLowerCase())
}

/**
 * Validates URL format using native URL() constructor.
 * Only allows http:// and https:// protocols for security.
 *
 * @param url - URL to validate (will be normalized before validation)
 * @returns true if URL is valid and uses http/https protocol
 *
 * @example
 * isValidUrl('example.com') // true (after normalization)
 * isValidUrl('not a url') // false
 * isValidUrl('ftp://example.com') // false (unsupported protocol)
 */
function isValidUrl(url: string): boolean {
  try {
    const normalized = normalizeUrl(url)
    const urlObj = new URL(normalized)
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

export function FormattingBubbleMenu({
  editor,
  externalLinkEdit,
  onExternalLinkEditDone
}: FormattingBubbleMenuProps) {
  // Link dialog state management
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const linkInputRef = useRef<HTMLInputElement>(null)

  // Table dialog state management
  const [showTableDialog, setShowTableDialog] = useState(false)

  // Handle external link edit trigger (from clicking a link in the editor)
  useEffect(() => {
    if (externalLinkEdit) {
      setLinkUrl(externalLinkEdit.url)
      setUrlError('')
      setShowLinkDialog(true)
      onExternalLinkEditDone?.()
    }
  }, [externalLinkEdit, onExternalLinkEditDone])

  // Auto-focus link input when dialog opens (with small delay for animation)
  useEffect(() => {
    if (showLinkDialog && linkInputRef.current) {
      setTimeout(() => linkInputRef.current?.focus(), 100)
    }
  }, [showLinkDialog])

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
          setLinkUrl(previousUrl || '')
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
      setUrlError('Please enter a URL')
      return
    }

    const normalized = normalizeUrl(linkUrl)
    if (!isValidUrl(linkUrl)) {
      setUrlError('Please enter a valid URL (e.g., example.com or https://example.com)')
      return
    }

    const success = editor
      .chain()
      .focus()
      .setLink({ href: normalized })
      .run()

    if (success) {
      setShowLinkDialog(false)
      setLinkUrl('')
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
    setUrlError('')
  }

  /**
   * Opens link dialog and pre-fills with existing URL if text is already linked.
   */
  const handleOpenLinkDialog = () => {
    const previousUrl = editor.getAttributes('link').href
    setLinkUrl(previousUrl || '')
    setUrlError('')
    setShowLinkDialog(true)
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
        <div className="flex items-center gap-1 bg-white border border-gray-300 rounded shadow-lg p-2">
          {/* Bold Button - Keyboard: Ctrl+B / Cmd+B */}
          <button
            onMouseDown={(e) => e.preventDefault()} // Prevents editor from losing focus
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100 transition-colors ${
              editor.isActive('bold') ? 'bg-gray-200' : ''
            }`}
            title="Bold (Ctrl+B)"
          >
            B
          </button>

          {/* Italic Button - Keyboard: Ctrl+I / Cmd+I */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-3 py-1 rounded text-sm italic hover:bg-gray-100 transition-colors ${
              editor.isActive('italic') ? 'bg-gray-200' : ''
            }`}
            title="Italic (Ctrl+I)"
          >
            I
          </button>

          {/* Visual divider between text styles and headings */}
          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Heading 1 Button - Large heading */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100 transition-colors ${
              editor.isActive('heading', { level: 1 }) ? 'bg-gray-200' : ''
            }`}
            title="Heading 1"
          >
            H1
          </button>

          {/* Heading 2 Button - Medium heading */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100 transition-colors ${
              editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''
            }`}
            title="Heading 2"
          >
            H2
          </button>

          {/* Heading 3 Button - Small heading */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100 transition-colors ${
              editor.isActive('heading', { level: 3 }) ? 'bg-gray-200' : ''
            }`}
            title="Heading 3"
          >
            H3
          </button>

          {/* Visual divider between headings and lists */}
          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Bullet List Button - Toggle on/off */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-3 py-1 rounded text-sm hover:bg-gray-100 transition-colors flex items-center ${
              editor.isActive('bulletList') ? 'bg-gray-200' : ''
            }`}
            title="Bullet List"
          >
            <List size={16} />
          </button>

          {/* Ordered List Button - Toggle on/off */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-3 py-1 rounded text-sm hover:bg-gray-100 transition-colors flex items-center ${
              editor.isActive('orderedList') ? 'bg-gray-200' : ''
            }`}
            title="Numbered List"
          >
            <ListOrdered size={16} />
          </button>

          {/* Task List Button - Toggle on/off */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`px-3 py-1 rounded text-sm hover:bg-gray-100 transition-colors flex items-center ${
              editor.isActive('taskList') ? 'bg-gray-200' : ''
            }`}
            title="Task List"
          >
            <ListChecks size={16} />
          </button>

          {/* Visual divider between lists and links */}
          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Link Button - Keyboard: Cmd+K / Ctrl+K */}
          <button
            onClick={handleOpenLinkDialog}
            onMouseDown={(e) => e.preventDefault()}
            className={`px-3 py-1 rounded text-sm hover:bg-gray-100 transition-colors flex items-center ${
              editor.isActive('link') ? 'bg-gray-200' : ''
            }`}
            title="Add/Edit Link (Cmd+K)"
          >
            <Link2 size={16} />
          </button>

          {/* Visual divider between links and tables */}
          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Table Button - Opens Dialog */}
          <button
            onClick={() => setShowTableDialog(true)}
            onMouseDown={(e) => e.preventDefault()}
            className="px-3 py-1 rounded text-sm hover:bg-gray-100 transition-colors flex items-center"
            title="Insert Table"
          >
            <Table size={16} />
          </button>
        </div>
      </BubbleMenu>

      {/*
        Link Dialog - Separate modal for better UX and accessibility
        Uses Radix Dialog for proper focus trapping and keyboard navigation
      */}
      <Dialog.Root open={showLinkDialog} onOpenChange={setShowLinkDialog}>
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
                    type="url"
                    value={linkUrl}
                    onChange={(e) => {
                      setLinkUrl(e.target.value)
                      setUrlError('') // Clear validation error while user types
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSetLink() // Submit on Enter key
                      }
                    }}
                    placeholder="example.com or https://example.com"
                    className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {/* Open in browser button - only shown when URL exists */}
                  {linkUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
                        openExternalUrl(url)
                      }}
                      className="px-3 py-2 border rounded text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                      title="Open in browser (Cmd+click also works)"
                    >
                      <ExternalLink size={16} />
                    </button>
                  )}
                </div>
                {/* Inline validation error message */}
                {urlError && (
                  <p className="text-sm text-red-500 mt-1">{urlError}</p>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                {/* Remove button only shown when editing existing link */}
                {editor.isActive('link') && (
                  <Button
                    onClick={handleRemoveLink}
                    variant="destructive"
                  >
                    <X />
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
                  <Check />
                  {editor.isActive('link') ? 'Update' : 'Add'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/*
        Table Dialog - Separate modal for table insertion
        Uses Radix Dialog for consistent UX with Link dialog
      */}
      <Dialog.Root open={showTableDialog} onOpenChange={setShowTableDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-6 z-50">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Insert Table
            </Dialog.Title>

            <TablePicker
              editor={editor}
              onClose={() => setShowTableDialog(false)}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}

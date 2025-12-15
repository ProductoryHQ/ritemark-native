import React, { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, useEditorState, type Editor as TipTapEditor } from '@tiptap/react'
import { sendToExtension, onMessage } from '../bridge'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Link from '@tiptap/extension-link'
import { createLowlight, common } from 'lowlight'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { tables, taskListItems } from 'turndown-plugin-gfm'
import { tableExtensions } from '../extensions/tableExtensions'
import { ImageExtension } from '../extensions/imageExtensions'
import { SlashCommands } from '../extensions/SlashCommands'
import { FormattingBubbleMenu } from './FormattingBubbleMenu'
import { TableOverlayControls } from './TableOverlayControls'
import { PropertiesPanel, type DocumentProperties } from './properties'
import type { EditorSelection } from '../types/editor'

// Initialize Turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',  // Use * for italic (matches TipTap BubbleMenu input)
  strongDelimiter: '**'  // Use ** for bold (matches TipTap BubbleMenu input)
})

// Enable GFM plugins for turndown
turndownService.use(tables)
turndownService.use(taskListItems)

/**
 * Preprocess HTML to make TipTap tables compatible with turndown-plugin-gfm
 *
 * TipTap generates tables with:
 * 1. <colgroup> elements that break GFM table parser
 * 2. <p> tags inside cells that add unwanted line breaks
 *
 * This function cleans the HTML in the DOM before Turndown processes it
 */
function preprocessTableHTML(html: string): string {
  // Create a temporary DOM element to parse and manipulate HTML
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Remove all <colgroup> elements from tables
  temp.querySelectorAll('colgroup').forEach(colgroup => colgroup.remove())

  // Unwrap <p> tags inside table cells (keep content, remove wrapper)
  temp.querySelectorAll('td > p, th > p').forEach(p => {
    const parent = p.parentElement
    if (parent) {
      // Move all child nodes of <p> to parent
      while (p.firstChild) {
        parent.insertBefore(p.firstChild, p)
      }
      // Remove the now-empty <p> tag
      p.remove()
    }
  })

  return temp.innerHTML
}

// Override the tableCell rule to escape pipe characters in cell content
// The turndown-plugin-gfm doesn't escape pipes by default, which breaks table structure
// when cell content contains | characters (e.g., code examples, commands)
turndownService.addRule('tableCellWithPipeEscape', {
  filter: ['th', 'td'],
  replacement: function (content, node) {
    // Escape pipe characters to prevent breaking table structure
    const escapedContent = content.replace(/\|/g, '\\|')

    // Replicate the original cell formatting logic from turndown-plugin-gfm
    // Table cells always have a parent (tr), so this is safe
    const index = node.parentNode ? Array.prototype.indexOf.call(node.parentNode.childNodes, node) : 0
    const prefix = index === 0 ? '| ' : ' '
    return prefix + escapedContent + ' |'
  }
})

// Keep Turndown's default escaping behavior to prevent content corruption
// The unescape logic below handles loading escaped files correctly

// Custom rule to handle images with webview URIs
// When an image has a title starting with ./, it means the relative path is stored there
// and the src is a webview URI for display purposes only
turndownService.addRule('imageWithRelativePath', {
  filter: 'img',
  replacement: function (_content, node) {
    const element = node as HTMLImageElement
    const alt = element.alt || ''
    const title = element.title || ''
    // If title contains a relative path, use it as the src
    const src = title.startsWith('./') ? title : element.src
    // Don't include title in markdown output
    return `![${alt}](${src})`
  }
})

// Create lowlight instance with common languages
const lowlight = createLowlight(common)

// Helper to read a File as base64 data URL
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Generate a unique filename for pasted images
function generateImageFilename(file: File): string {
  const timestamp = Date.now()
  const extension = file.type.split('/')[1] || 'png'
  return `image-${timestamp}.${extension}`
}

interface EditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onEditorReady?: (editor: TipTapEditor) => void
  onSelectionChange?: (selection: EditorSelection) => void
  properties?: DocumentProperties
  hasProperties?: boolean
  onPropertiesChange?: (properties: DocumentProperties) => void
}

export function Editor({
  value,
  onChange,
  placeholder = "Start writing...",
  className = "",
  onEditorReady,
  onSelectionChange,
  properties = {},
  hasProperties = false,
  onPropertiesChange,
}: EditorProps) {
  const isInitialMount = useRef(true)
  const lastExternalValue = useRef(value)
  const lastOnChangeValue = useRef<string>('')

  // Convert initial markdown to HTML (only runs once on mount)
  const [initialContent] = useState(() => {
    if (!value || !value.trim()) return ''

    const isHTML = /^<(p|div|h[1-6]|ul|ol|li|blockquote|pre|table|strong|em|code)[\s>]/i.test(value.trim())

    if (isHTML) {
      return value
    } else {
      // Convert markdown to HTML
      try {
        return marked(value, { breaks: true, gfm: true }) as string
      } catch (error) {
        console.error('Markdown conversion error:', error)
        return `<p>${value.replace(/\n/g, '</p><p>')}</p>`
      }
    }
  })

  const editor: TipTapEditor | null = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false, // Disable default to use enhanced version
        link: false, // Disable StarterKit's Link to use custom Link extension
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        bold: {
          HTMLAttributes: {
            class: 'font-bold',
          },
        },
        italic: {
          HTMLAttributes: {
            class: 'italic',
          },
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
        HTMLAttributes: {
          class: 'tiptap-code-block',
        },
      }),
      BulletList.configure({
        HTMLAttributes: {
          class: 'tiptap-bullet-list',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'tiptap-ordered-list',
        },
      }),
      ListItem.configure({
        HTMLAttributes: {
          class: 'tiptap-list-item',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'tiptap-task-list',
        },
      }),
      TaskItem.configure({
        HTMLAttributes: {
          class: 'tiptap-task-item',
        },
        nested: true,
      }),
      Placeholder.configure({
        placeholder: placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'tiptap-link',
        },
        validate: (url) => {
          return url.startsWith('https://') || url.startsWith('http://')
        },
      }),
      ...tableExtensions,
      ImageExtension,
      SlashCommands,
    ],
    content: initialContent,
    onCreate: ({ editor }) => {
      onEditorReady?.(editor)
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // Preprocess HTML to fix TipTap table formatting for GFM conversion
      const cleanedHTML = preprocessTableHTML(html)
      // Convert HTML back to markdown for storage
      const markdown = turndownService.turndown(cleanedHTML)

      // Only call onChange if content actually changed
      // This prevents unnecessary re-renders that close bubble menus
      if (markdown !== lastOnChangeValue.current) {
        lastOnChangeValue.current = markdown
        onChange(markdown)
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none',
      },
      handleDrop: (_view, event, _slice, _moved) => {
        // Handle image drag-and-drop
        if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const file = event.dataTransfer.files[0]
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            // Read file and send to extension
            readFileAsBase64(file).then(dataUrl => {
              const filename = file.name || generateImageFilename(file)
              sendToExtension('saveImage', { dataUrl, filename })
            })
            return true
          }
        }
        return false
      },
      handlePaste: (_view, event) => {
        // Handle image paste from clipboard
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
          const file = event.clipboardData.files[0]
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            // Read file and send to extension
            readFileAsBase64(file).then(dataUrl => {
              const filename = generateImageFilename(file)
              sendToExtension('saveImage', { dataUrl, filename })
            })
            return true
          }
        }
        return false
      },
      handleKeyDown: (view, event): boolean => {
        // Handle keyboard shortcuts
        const isMod = event.metaKey || event.ctrlKey

        // Code block shortcut: Mod+Shift+C
        if (isMod && event.shiftKey && event.key === 'C') {
          event.preventDefault()
          return editor?.commands.toggleCodeBlock() || false
        }

        // Table insertion: Remove keyboard shortcut entirely
        // Users will insert tables via toolbar button (Phase 2)
        // No safe keyboard shortcut exists (Cmd+Shift+T = reopen tab, Cmd+Option+T conflicts with apps)

        // Table row/column operations (only when inside a table)
        if (editor?.isActive('table')) {
          // Cmd+Shift+↑ - Add row before
          if (isMod && event.shiftKey && event.key === 'ArrowUp') {
            event.preventDefault()
            return editor?.commands.addRowBefore() || false
          }

          // Cmd+Shift+↓ - Add row after
          if (isMod && event.shiftKey && event.key === 'ArrowDown') {
            event.preventDefault()
            return editor?.commands.addRowAfter() || false
          }

          // Cmd+Shift+← - Add column before
          if (isMod && event.shiftKey && event.key === 'ArrowLeft') {
            event.preventDefault()
            return editor?.commands.addColumnBefore() || false
          }

          // Cmd+Shift+→ - Add column after
          if (isMod && event.shiftKey && event.key === 'ArrowRight') {
            event.preventDefault()
            return editor?.commands.addColumnAfter() || false
          }

          // Cmd+Backspace - Delete row
          if (isMod && event.key === 'Backspace') {
            event.preventDefault()
            return editor?.commands.deleteRow() || false
          }

          // Cmd+Delete - Delete column
          if (isMod && event.key === 'Delete') {
            event.preventDefault()
            return editor?.commands.deleteColumn() || false
          }
        }

        // Ordered list shortcut: Mod+Shift+7
        if (isMod && event.shiftKey && event.key === '&') { // Shift+7
          event.preventDefault()
          return editor?.commands.toggleOrderedList() || false
        }

        // Bullet list shortcut: Mod+Shift+8
        if (isMod && event.shiftKey && event.key === '*') { // Shift+8
          event.preventDefault()
          return editor?.commands.toggleBulletList() || false
        }

        // Tab handling for lists
        if (event.key === 'Tab') {
          const { selection } = view.state
          const { $from } = selection

          if ($from.parent.type.name === 'listItem') {
            event.preventDefault()
            if (event.shiftKey) {
              return editor?.commands.liftListItem('listItem') || false
            } else {
              return editor?.commands.sinkListItem('listItem') || false
            }
          }
        }

        // Enter handling for lists
        if (event.key === 'Enter') {
          const { selection } = view.state
          const { $from } = selection

          if ($from.parent.type.name === 'listItem') {
            const isEmpty = $from.parent.textContent.trim() === ''
            if (isEmpty) {
              return editor?.commands.liftListItem('listItem') || false
            }
          }
        }

        return false
      },
    },
  })

  // Track selection changes using TipTap's useEditorState hook (MUST be in same component as useEditor!)
  const editorSelection = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null
      }
      const { from, to, empty } = ctx.editor.state.selection
      const text = ctx.editor.state.doc.textBetween(from, to, ' ')

      const result = {
        text,
        from,
        to,
        isEmpty: empty,
        wordCount: text.trim() ? text.split(/\s+/).filter(Boolean).length : 0
      }

      return result
    }
  })

  // Pass selection changes up to parent component
  useEffect(() => {
    if (editorSelection && onSelectionChange) {
      onSelectionChange(editorSelection)
    }
  }, [editorSelection, onSelectionChange])

  // Listen for image saved response from extension
  useEffect(() => {
    if (!editor) return

    const handleMessage = (message: { type: string; path?: string; displaySrc?: string; error?: string }) => {
      if (message.type === 'imageSaved' && message.displaySrc && message.path) {
        // Insert image at current cursor position
        // Use displaySrc for rendering, store relative path in data attribute
        editor.chain().focus().setImage({
          src: message.displaySrc,
          alt: '',
          title: message.path  // Store relative path in title for turndown conversion
        }).run()
      } else if (message.type === 'imageError' && message.error) {
        console.error('Failed to save image:', message.error)
      }
    }

    onMessage(handleMessage)
  }, [editor])

  // Notify parent when editor is ready and available
  React.useEffect(() => {
    if (editor) {
      onEditorReady?.(editor)
    }
  }, [editor]) // Don't include onEditorReady to avoid re-calling when callback changes

  // Update editor content when value prop changes (e.g., when loading a file)
  // Skip updates during active editing to prevent bubble menus from closing
  useEffect(() => {
    if (!editor) return

    // Convert current editor HTML back to markdown to compare with incoming value
    const currentMarkdown = turndownService.turndown(editor.getHTML())

    // On initial mount, always process the value
    if (isInitialMount.current) {
      isInitialMount.current = false
      lastExternalValue.current = value
      lastOnChangeValue.current = value
      // Don't return - let it process the initial content below
    }

    // Only update if value changed externally (not from editor's own onChange)
    // This prevents the editor from updating during typing/formatting
    const isExternalChange = value !== currentMarkdown && value !== lastOnChangeValue.current

    if (isExternalChange || currentMarkdown === '') {
      // CURSOR JUMP BUG FIX: Don't update content if editor is focused
      // This prevents cursor from jumping during autosave cycles
      if (editor.isFocused) {
        // Skip update - user is actively editing
        return
      }

      // Check if value is HTML (starts with common HTML tags)
      // Only check for actual HTML block tags, not random < > characters
      const isHTML = /^<(p|div|h[1-6]|ul|ol|li|blockquote|pre|table|strong|em|code)[\s>]/i.test(value.trim())

      if (!isHTML && value.trim()) {
        // Treat all non-HTML text as markdown (including plain text)
        // marked.js will handle plain text gracefully, converting line breaks to <p> tags
        try {
          const html = marked(value, {
            breaks: true,
            gfm: true
          }) as string
          editor.commands.setContent(html, false) // emitUpdate: false to prevent loops
        } catch (error) {
          console.error('Markdown conversion error:', error)
          // Fallback: treat as plain text
          editor.commands.setContent(`<p>${value.replace(/\n/g, '</p><p>')}</p>`, false)
        }
      } else {
        // Already HTML or empty
        editor.commands.setContent(value, false) // emitUpdate: false to prevent loops
      }

      lastExternalValue.current = value
    }
  }, [editor, value])

  // Calculate word count - simple approach using editor state
  const [wordCount, setWordCount] = useState(0)

  // Update word count when editor content changes and send to extension
  useEffect(() => {
    if (!editor) return

    const updateWordCount = () => {
      const text = editor.state.doc.textContent
      const words = text.trim().split(/\s+/).filter(Boolean)
      const count = words.length
      setWordCount(count)
      // Send word count to extension for status bar display
      sendToExtension('wordCountChanged', { wordCount: count })
    }

    // Initial count
    updateWordCount()

    // Listen for updates
    editor.on('update', updateWordCount)

    return () => {
      editor.off('update', updateWordCount)
    }
  }, [editor])

  return (
    <div className={`wysiwyg-editor h-full overflow-y-auto ${className}`}>
      {/* Document Properties Panel */}
      {onPropertiesChange && (
        <PropertiesPanel
          properties={properties}
          hasProperties={hasProperties}
          onChange={onPropertiesChange}
        />
      )}

      <EditorContent editor={editor} />

      {editor ? (
        <>
          <FormattingBubbleMenu editor={editor} />
          <TableOverlayControls editor={editor} />
        </>
      ) : (
        <div style={{ display: 'none' }}>Editor not ready</div>
      )}

      <style>{`
        .wysiwyg-editor .ProseMirror {
          outline: none !important;
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
          min-height: 60vh !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
          font-size: 18px !important;
          line-height: 1.7 !important;
          color: #374151 !important;
          max-width: 100% !important;
          max-width: 900px !important;
          margin: 0 auto !important;
          padding: 2rem 2rem 0 2rem !important;
        }

        .wysiwyg-editor .ProseMirror p {
          margin: 0 0 1em 0 !important;
          font-size: 18px !important;
          line-height: 1.7 !important;
          color: #374151 !important;
        }

        .wysiwyg-editor .ProseMirror h1 {
          font-size: 2rem !important;
          font-weight: 600 !important;
          margin: 1.5em 0 0.5em 0 !important;
          color: #111827 !important;
        }

        .wysiwyg-editor .ProseMirror h2 {
          font-size: 1.5rem !important;
          font-weight: 600 !important;
          margin: 1.25em 0 0.5em 0 !important;
          color: #111827 !important;
        }

        .wysiwyg-editor .ProseMirror h3 {
          font-size: 1.25rem !important;
          font-weight: 600 !important;
          margin: 1em 0 0.5em 0 !important;
          color: #111827 !important;
        }

        .wysiwyg-editor .ProseMirror h4 {
          font-size: 1.125rem !important;
          font-weight: 600 !important;
          margin: 1em 0 0.5em 0 !important;
          color: #111827 !important;
        }

        .wysiwyg-editor .ProseMirror h5 {
          font-size: 1rem !important;
          font-weight: 600 !important;
          margin: 1em 0 0.5em 0 !important;
          color: #111827 !important;
        }

        .wysiwyg-editor .ProseMirror h6 {
          font-size: 0.875rem !important;
          font-weight: 600 !important;
          margin: 1em 0 0.5em 0 !important;
          color: #111827 !important;
        }

        .wysiwyg-editor .ProseMirror ul.tiptap-bullet-list {
          padding-left: 1.5em !important;
          margin: 0.5em 0 !important;
          list-style-type: disc !important;
        }

        .wysiwyg-editor .ProseMirror ol.tiptap-ordered-list {
          padding-left: 1.5em !important;
          margin: 0.5em 0 !important;
          list-style-type: decimal !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-list-item {
          margin: 0.25em 0 !important;
          line-height: 1.7 !important;
          display: list-item !important;
        }

        /* Task List (Checkbox) styling */
        .wysiwyg-editor .ProseMirror ul.tiptap-task-list {
          list-style-type: none !important;
          padding-left: 0 !important;
          margin: 0.5em 0 !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item {
          display: flex !important;
          align-items: baseline !important;
          margin: 0.25em 0 !important;
          line-height: 1.7 !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item > label {
          display: flex !important;
          align-items: center !important;
          margin-right: 0.5rem !important;
          user-select: none !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item > label > input[type="checkbox"] {
          width: 1rem !important;
          height: 1rem !important;
          margin: 0 !important;
          cursor: pointer !important;
          border: 2px solid #9ca3af !important;
          border-radius: 3px !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          background-color: white !important;
          position: relative !important;
          top: 1px !important;
          flex-shrink: 0 !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item > label > input[type="checkbox"]:checked {
          background-color: #4338ca !important;
          border-color: #4338ca !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item > label > input[type="checkbox"]:checked::after {
          content: '✓' !important;
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          color: white !important;
          font-size: 11px !important;
          font-weight: bold !important;
          line-height: 1 !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item > label > input[type="checkbox"]:hover {
          border-color: #4338ca !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item > div {
          flex: 1 !important;
        }

        /* Nested task lists */
        .wysiwyg-editor .ProseMirror li.tiptap-task-item ul.tiptap-task-list {
          margin-top: 0.5rem !important;
          padding-left: 1.5rem !important;
        }

        .wysiwyg-editor .ProseMirror strong {
          font-weight: 600 !important;
          color: #111827 !important;
        }

        .wysiwyg-editor .ProseMirror em {
          font-style: italic !important;
          color: #374151 !important;
        }

        .wysiwyg-editor .ProseMirror a.tiptap-link {
          color: #4338ca !important;
          text-decoration: underline !important;
          cursor: pointer !important;
        }

        .wysiwyg-editor .ProseMirror a.tiptap-link:hover {
          color: #3730a3 !important;
        }

        /* Blockquote styling */
        .wysiwyg-editor .ProseMirror blockquote {
          border-left: 4px solid #4338ca !important;
          padding-left: 1rem !important;
          margin: 1em 0 !important;
          color: #6b7280 !important;
          font-style: italic !important;
          background: #f9fafb !important;
          padding: 0.75rem 1rem !important;
          border-radius: 0 8px 8px 0 !important;
        }

        .wysiwyg-editor .ProseMirror blockquote p {
          margin: 0 !important;
        }

        /* Increased specificity to override Vite HMR styles in dev mode */
        div.wysiwyg-editor .ProseMirror.ProseMirror ::selection {
          background: rgba(67, 56, 202, 0.15) !important;
          border-radius: 2px !important;
        }

        div.wysiwyg-editor .ProseMirror.ProseMirror ::-moz-selection {
          background: rgba(67, 56, 202, 0.15) !important;
        }

        /* Code block styling with dark theme */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block {
          background: #1f2937 !important;
          color: #f9fafb !important;
          border-radius: 8px !important;
          padding: 1rem !important;
          margin: 1em 0 !important;
          overflow-x: auto !important;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace !important;
          font-size: 16px !important;
          line-height: 1.5 !important;
          position: relative !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block code {
          background: none !important;
          padding: 0 !important;
          font-size: inherit !important;
          color: inherit !important;
        }

        /* Syntax highlighting tokens */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-keyword { color: #c678dd !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-string { color: #98c379 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-number { color: #d19a66 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-comment { color: #7c7c7c !important; font-style: italic !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-function { color: #61afef !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-variable { color: #e06c75 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-type { color: #e5c07b !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-operator { color: #56b6c2 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-punctuation { color: #abb2bf !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-property { color: #d19a66 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-literal { color: #56b6c2 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-built_in { color: #e5c07b !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-class { color: #e5c07b !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-title { color: #61afef !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-attr { color: #d19a66 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-tag { color: #e06c75 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-name { color: #e06c75 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-selector-tag { color: #e06c75 !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-selector-class { color: #e5c07b !important; }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .hljs-selector-id { color: #61afef !important; }

        /* Enhanced mobile selection */
        @media (max-width: 768px) {
          div.wysiwyg-editor .ProseMirror.ProseMirror ::selection {
            background: rgba(67, 56, 202, 0.2) !important;
          }
        }

        .wysiwyg-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af !important;
          content: attr(data-placeholder) !important;
          float: left !important;
          height: 0 !important;
          pointer-events: none !important;
        }

        /* Table styling - Based on Sprint 11 research with user-requested colors */
        /* Table container */
        .wysiwyg-editor .ProseMirror table.tiptap-table-node {
          border-collapse: collapse !important;
          table-layout: fixed !important;
          width: 100% !important;
          margin: 1em 0 !important;
          overflow: hidden !important;
          border: 1px solid #d1d5db !important; /* User requested: 1px solid light grey */
        }

        /* Table cells */
        .wysiwyg-editor .ProseMirror td.tiptap-table-cell,
        .wysiwyg-editor .ProseMirror th.tiptap-table-header {
          min-width: 1em !important;
          border: 1px solid #d1d5db !important; /* User requested: 1px solid light grey */
          padding: 0.5rem 0.75rem !important;
          vertical-align: top !important;
          box-sizing: border-box !important;
          position: relative !important;
        }

        /* Header cells */
        .wysiwyg-editor .ProseMirror th.tiptap-table-header {
          font-weight: 600 !important;
          text-align: left !important;
          background-color: #f8fafc !important;
          color: #111827 !important;
        }

        /* Row hover effect */
        .wysiwyg-editor .ProseMirror tr.tiptap-table-row:hover td,
        .wysiwyg-editor .ProseMirror tr.tiptap-table-row:hover th {
          background-color: rgba(67, 56, 202, 0.05) !important;
        }

        /* Selected cell */
        .wysiwyg-editor .ProseMirror .selectedCell:after {
          z-index: 2 !important;
          position: absolute !important;
          content: "" !important;
          left: 0 !important;
          right: 0 !important;
          top: 0 !important;
          bottom: 0 !important;
          background: rgba(67, 56, 202, 0.1) !important;
          pointer-events: none !important;
        }

        /* Column resize handle */
        .wysiwyg-editor .ProseMirror table.tiptap-table-node .column-resize-handle {
          position: absolute !important;
          right: -2px !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 4px !important;
          background-color: #4338ca !important;
          cursor: col-resize !important;
          opacity: 0 !important;
          transition: opacity 0.2s !important;
        }

        .wysiwyg-editor .ProseMirror table.tiptap-table-node:hover .column-resize-handle {
          opacity: 0.5 !important;
        }

        /* Mobile adjustments */
        @media (max-width: 768px) {
          .wysiwyg-editor .ProseMirror table.tiptap-table-node {
            font-size: 14px !important;
          }

          .wysiwyg-editor .ProseMirror td.tiptap-table-cell,
          .wysiwyg-editor .ProseMirror th.tiptap-table-header {
            padding: 0.4rem 0.6rem !important;
          }
        }

        `}</style>
    </div>
  )
}

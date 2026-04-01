import React, { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, useEditorState, type Editor as TipTapEditor } from '@tiptap/react'
import { DOMSerializer } from '@tiptap/pm/model'
import { sendToExtension, onMessage } from '../bridge'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { CodeBlockWithCopyExtension } from '../extensions/CodeBlockWithCopyExtension'
import { CustomLink } from '../extensions/CustomLink'
import { createLowlight, common } from 'lowlight'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { tables, taskListItems } from 'turndown-plugin-gfm'
import { tableExtensions } from '../extensions/tableExtensions'
import { ImageExtension } from '../extensions/imageExtensions'
import { SlashCommands } from '../extensions/SlashCommands'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'
import AutoJoiner from 'tiptap-extension-auto-joiner'
import { FormattingBubbleMenu } from './FormattingBubbleMenu'
import { TableOverlayControls } from './TableOverlayControls'
import { BlockMenu } from './BlockMenu'
import type { EditorSelection } from '../types/editor'

// Initialize Turndown for HTML to Markdown conversion
export const turndownService = new TurndownService({
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
 * Preprocess HTML to convert GFM task lists to TipTap format
 *
 * marked generates: <ul><li><input type="checkbox" disabled> Task</li></ul>
 * TipTap expects: <ul data-type="taskList"><li data-type="taskItem" data-checked="false">Task</li></ul>
 */
function preprocessTaskListHTML(html: string): string {
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Find all list items that contain a checkbox
  temp.querySelectorAll('li').forEach(li => {
    const checkbox = li.querySelector('input[type="checkbox"]')
    if (checkbox) {
      // Check if checkbox is at the start (first element child)
      const firstElement = li.firstElementChild
      if (firstElement === checkbox) {
        // This is a task list item
        const isChecked = checkbox.hasAttribute('checked')
        li.setAttribute('data-type', 'taskItem')
        li.setAttribute('data-checked', isChecked ? 'true' : 'false')

        // Remove the checkbox - TipTap renders its own
        checkbox.remove()

        // Mark parent UL as task list
        const parentUl = li.parentElement
        if (parentUl && parentUl.tagName === 'UL') {
          parentUl.setAttribute('data-type', 'taskList')
        }
      }
    }
  })

  return temp.innerHTML
}

/**
 * Preprocess HTML to unwrap standalone images from paragraph tags
 *
 * marked generates: <p><img src="..." alt=""></p>
 * TipTap with inline:false images expects: <img src="..." alt="">
 *
 * Without this, TipTap creates both an empty paragraph AND an image node,
 * causing extra spacing above images when reopening files.
 */
function preprocessImageHTML(html: string): string {
  const temp = document.createElement('div')
  temp.innerHTML = html

  // Find all paragraphs that contain only an image (and maybe whitespace)
  temp.querySelectorAll('p').forEach(p => {
    const img = p.querySelector('img')
    if (img) {
      // Check if paragraph only contains the image (no text content besides whitespace)
      const textContent = p.textContent?.trim() || ''
      const imgAlt = img.getAttribute('alt') || ''

      // If the only text content is the img alt text (or empty), unwrap the image
      if (textContent === '' || textContent === imgAlt) {
        // Replace paragraph with just the image
        p.replaceWith(img)
      }
    }
  })

  return temp.innerHTML
}

/**
 * Preprocess HTML to make TipTap tables compatible with turndown-plugin-gfm
 *
 * TipTap generates tables with:
 * 1. <colgroup> elements that break GFM table parser
 * 2. <p> tags inside cells that add unwanted line breaks
 *
 * This function cleans the HTML in the DOM before Turndown processes it
 */
export function preprocessTableHTML(html: string): string {
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

// Custom rule to convert TipTap task list items to GFM syntax
// TipTap outputs: <li data-type="taskItem" data-checked="true">Task</li>
// GFM expects: - [x] Task
//
// BUG FIX: Handle nested task lists by preserving line breaks and indentation
// Previously, nested items were flattened to a single line with escaped brackets
turndownService.addRule('tiptapTaskItem', {
  filter: function (node) {
    return node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem'
  },
  replacement: function (content, node) {
    const element = node as HTMLElement
    const isChecked = element.getAttribute('data-checked') === 'true'
    const checkbox = isChecked ? '[x]' : '[ ]'

    // Split content into lines
    const lines = content.split('\n').filter(line => line.trim())

    // Check if we have nested task list items (lines starting with "- [")
    // These are already converted by turndown processing child nodes first
    const hasNestedTasks = lines.some((line, idx) => idx > 0 && line.match(/^- \[[ x]\]/))

    if (hasNestedTasks && lines.length > 1) {
      // First line is direct content, rest are nested items
      const firstLine = lines[0].trim()
      const nestedLines = lines.slice(1).map(line => '  ' + line).join('\n')
      return `- ${checkbox} ${firstLine}\n${nestedLines}\n`
    }

    // No nested items - single line (clean up whitespace and newlines)
    const cleanContent = content.replace(/^\s+|\s+$/g, '').replace(/\n+/g, ' ')
    return `- ${checkbox} ${cleanContent}\n`
  }
})

// Custom rule to handle TipTap task list UL (prevent default list handling)
turndownService.addRule('tiptapTaskList', {
  filter: function (node) {
    return node.nodeName === 'UL' && node.getAttribute('data-type') === 'taskList'
  },
  replacement: function (content, node) {
    // Content already formatted by taskItem rule
    // For nested lists, don't add extra newlines - let parent control formatting
    const parent = (node as HTMLElement).parentElement
    const isNested = parent && parent.getAttribute('data-type') === 'taskItem'
    return isNested ? content : '\n' + content + '\n'
  }
})

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

/**
 * Apply image mappings to HTML content
 * Converts relative image paths to webview URIs for display,
 * while storing the original relative path in the title attribute for turndown
 */
function applyImageMappings(html: string, imageMappings: Record<string, string>): string {
  if (!imageMappings || Object.keys(imageMappings).length === 0) {
    return html
  }

  // Process each mapping
  let result = html
  for (const [relativePath, webviewUri] of Object.entries(imageMappings)) {
    // Escape special regex characters in the path
    const escapedPath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Replace src="relativePath" with src="webviewUri" title="relativePath"
    // This preserves the relative path for turndown to use when saving
    const srcRegex = new RegExp(`src="${escapedPath}"`, 'g')
    result = result.replace(srcRegex, `src="${webviewUri}" title="${relativePath}"`)
  }

  return result
}

// Helper to read a File as base64 data URL
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Generate a unique filename for pasted/dropped images.
// macOS screenshots always have file.name = "image.png", so we must
// detect generic names and always generate a unique timestamp-based name.
function getUniqueImageFilename(file: File): string {
  const extension = file.type.split('/')[1] || 'png'
  const baseName = file.name ? file.name.replace(/\.[^.]+$/, '') : ''
  const isGeneric = !baseName || /^image$/i.test(baseName)
  if (isGeneric) {
    return `image-${Date.now()}.${extension}`
  }
  return file.name
}

function getClipboardImageFile(dataTransfer: DataTransfer | null): File | null {
  if (!dataTransfer) {
    return null
  }

  if (dataTransfer.items) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          return file
        }
      }
    }
  }

  if (dataTransfer.files && dataTransfer.files.length > 0) {
    for (const file of Array.from(dataTransfer.files)) {
      if (file.type.startsWith('image/')) {
        return file
      }
    }
  }

  return null
}

function extractPlainTextFromHtml(html: string): string {
  if (!html.trim()) {
    return ''
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent?.trim() ?? ''
  } catch {
    return ''
  }
}

function shouldPreferTextPaste(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) {
    return false
  }

  const types = Array.from(dataTransfer.types ?? [])
  const plainText = dataTransfer.getData('text/plain').trim()
  const html = dataTransfer.getData('text/html')
  const htmlText = extractPlainTextFromHtml(html)

  if (plainText.length > 0) {
    return true
  }

  if ((types.includes('text/html') || types.includes('text/rtf')) && htmlText.length > 0) {
    return true
  }

  return false
}

interface EditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onEditorReady?: (editor: TipTapEditor) => void
  onSelectionChange?: (selection: EditorSelection) => void
  imageMappings?: Record<string, string>
}

export function Editor({
  value,
  onChange,
  placeholder = "Start writing...",
  className = "",
  onEditorReady,
  onSelectionChange,
  imageMappings = {},
}: EditorProps) {
  const isInitialMount = useRef(true)
  const lastExternalValue = useRef(value)
  const lastOnChangeValue = useRef<string>('')
  const lastImageMappingsRef = useRef<Record<string, string>>({})
  const pendingImagePosRef = useRef<number | null>(null)

  // State for external link editing (triggered by clicking links)
  const [externalLinkEdit, setExternalLinkEdit] = useState<{ url: string } | null>(null)

  // State for block menu (triggered by + button)
  const [showBlockMenu, setShowBlockMenu] = useState(false)
  const [blockMenuPosition, setBlockMenuPosition] = useState({ top: 0, left: 0 })
  const [insertAtPos, setInsertAtPos] = useState<number | null>(null) // Document position to insert at

  // Convert initial markdown to HTML (only runs once on mount)
  const [initialContent] = useState(() => {
    if (!value || !value.trim()) return ''

    const isHTML = /^<(p|div|h[1-6]|ul|ol|li|blockquote|pre|table|strong|em|code)[\s>]/i.test(value.trim())

    if (isHTML) {
      return value
    } else {
      // Convert markdown to HTML
      try {
        const html = marked(value, { breaks: true, gfm: true }) as string
        // Preprocess: task lists and unwrap standalone images from paragraphs
        let processed = preprocessTaskListHTML(html)
        processed = preprocessImageHTML(processed)
        return processed
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
      CodeBlockWithCopyExtension.configure({
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
      CustomLink.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'tiptap-link',
        },
        validate: (url) => {
          return url.startsWith('https://') || url.startsWith('http://')
        },
        onLinkClick: (href) => {
          setExternalLinkEdit({ url: href })
        },
      }),
      ...tableExtensions,
      ImageExtension,
      SlashCommands,
      GlobalDragHandle.configure({
        dragHandleWidth: 24,
        scrollTreshold: 100,
      }),
      AutoJoiner.configure({
        elementsToJoin: ['bulletList', 'orderedList', 'taskList'],
      }),
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
              const filename = getUniqueImageFilename(file)
              sendToExtension('saveImage', { dataUrl, filename })
            })
            return true
          }
        }
        return false
      },
      handlePaste: (_view, event) => {
        const file = getClipboardImageFile(event.clipboardData)
        if (file && !shouldPreferTextPaste(event.clipboardData)) {
          event.preventDefault()
          readFileAsBase64(file).then(dataUrl => {
            const filename = getUniqueImageFilename(file)
            sendToExtension('saveImage', { dataUrl, filename })
          })
          return true
        }

        // Let TipTap handle rich HTML/text paste when there is no actual image file/item.
        if (event.clipboardData?.types?.includes('text/html')) {
          return false
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

  // Listen for pending image position from slash command
  useEffect(() => {
    const handler = ((e: CustomEvent) => {
      pendingImagePosRef.current = e.detail as number
    }) as EventListener
    window.addEventListener('image:pending-position', handler)
    return () => window.removeEventListener('image:pending-position', handler)
  }, [])

  // Listen for messages from extension (image upload, file changes)
  useEffect(() => {
    if (!editor) return

    const handleMessage = (message: { type: string; path?: string; displaySrc?: string; error?: string; filename?: string; isDirty?: boolean }) => {
      if (message.type === 'imageSaved' && message.displaySrc && message.path) {
        const savedPos = pendingImagePosRef.current
        pendingImagePosRef.current = null

        if (savedPos !== null && savedPos <= editor.state.doc.content.size) {
          // Insert at the saved slash command position
          editor.chain()
            .focus()
            .setTextSelection(savedPos)
            .setImage({
              src: message.displaySrc,
              alt: '',
              title: message.path
            })
            .run()
        } else {
          // Fallback: insert at current cursor
          editor.chain()
            .focus()
            .setImage({
              src: message.displaySrc,
              alt: '',
              title: message.path
            })
            .run()
        }
      } else if (message.type === 'imageError' && message.error) {
        console.error('Failed to save image:', message.error)
      }
      // Note: fileChanged is handled at App level, not here
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

    // Check if imageMappings changed - need to re-apply them
    const imageMappingsChanged = Object.keys(imageMappings).length > 0 &&
      Object.keys(imageMappings).length !== Object.keys(lastImageMappingsRef.current).length

    if (isExternalChange || currentMarkdown === '' || imageMappingsChanged) {
      // Update the ref
      lastImageMappingsRef.current = imageMappings
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
          // Convert GFM task list HTML to TipTap format
          let processedHtml = preprocessTaskListHTML(html)
          // Unwrap standalone images from paragraphs
          processedHtml = preprocessImageHTML(processedHtml)
          // Apply image mappings to convert relative paths to webview URIs
          processedHtml = applyImageMappings(processedHtml, imageMappings)
          editor.commands.setContent(processedHtml, false) // emitUpdate: false to prevent loops
        } catch (error) {
          console.error('Markdown conversion error:', error)
          // Fallback: treat as plain text
          editor.commands.setContent(`<p>${value.replace(/\n/g, '</p><p>')}</p>`, false)
        }
      } else {
        // Already HTML or empty - still apply image mappings
        const processedValue = applyImageMappings(value, imageMappings)
        editor.commands.setContent(processedValue, false) // emitUpdate: false to prevent loops
      }

      lastExternalValue.current = value
    }
  }, [editor, value, imageMappings])

  // Calculate word count - simple approach using editor state
  const [_wordCount, setWordCount] = useState(0)

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

  // Create and manage the + button alongside the drag handle
  useEffect(() => {
    if (!editor) return

    // Create the + button element
    const plusButton = document.createElement('button')
    plusButton.className = 'block-plus-btn'
    plusButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
    plusButton.title = 'Add block'
    plusButton.setAttribute('aria-label', 'Add block')

    // Handle + button click
    const handlePlusClick = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      // Find the block at the drag handle's position
      const dragHandle = document.querySelector('.drag-handle') as HTMLElement
      if (dragHandle && editor) {
        const handleRect = dragHandle.getBoundingClientRect()
        // Get the center Y of the drag handle
        const centerY = handleRect.top + handleRect.height / 2

        // Find the ProseMirror position at this Y coordinate
        // We need to look for a block element at this vertical position
        const editorView = editor.view
        const editorRect = editorView.dom.getBoundingClientRect()

        // Use posAtCoords to find the document position
        const coords = { left: editorRect.left + 50, top: centerY }
        const posAtCoords = editorView.posAtCoords(coords)

        if (posAtCoords) {
          // Find which top-level block contains this position
          const doc = editorView.state.doc
          let blockStart = 0

          doc.forEach((node, offset) => {
            const nodeEnd = offset + node.nodeSize
            // Check if the clicked position falls within this node
            if (posAtCoords.pos >= offset && posAtCoords.pos < nodeEnd) {
              blockStart = offset
              return false // Stop iteration
            }
          })

          setInsertAtPos(blockStart)
        }
      }

      const rect = plusButton.getBoundingClientRect()
      setBlockMenuPosition({ top: rect.bottom + 4, left: rect.left })
      setShowBlockMenu(true)
    }

    plusButton.addEventListener('click', handlePlusClick)
    plusButton.addEventListener('mousedown', (e) => e.preventDefault())

    // Append to body (will be positioned via CSS relative to drag-handle)
    document.body.appendChild(plusButton)

    // Sync + button visibility and position with drag handle
    const syncPlusButton = () => {
      const dragHandle = document.querySelector('.drag-handle') as HTMLElement
      if (dragHandle) {
        const style = window.getComputedStyle(dragHandle)
        const opacity = parseFloat(style.opacity)

        if (opacity > 0) {
          const rect = dragHandle.getBoundingClientRect()
          plusButton.style.top = `${rect.top}px`
          plusButton.style.left = `${rect.left - 28}px` // 24px width + 4px gap
          plusButton.style.opacity = style.opacity
          plusButton.style.display = 'flex'
        } else {
          plusButton.style.opacity = '0'
        }
      } else {
        plusButton.style.opacity = '0'
      }
    }

    // Use animation frame for smooth syncing
    let animationId: number
    const animate = () => {
      syncPlusButton()
      animationId = requestAnimationFrame(animate)
    }
    animationId = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationId)
      plusButton.removeEventListener('click', handlePlusClick)
      plusButton.remove()
    }
  }, [editor])

  // Close block menu when clicking outside
  useEffect(() => {
    if (!showBlockMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.querySelector('.block-menu-container')
      const plusBtn = document.querySelector('.block-plus-btn')
      if (
        menu && !menu.contains(event.target as Node) &&
        plusBtn && !plusBtn.contains(event.target as Node)
      ) {
        setShowBlockMenu(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowBlockMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showBlockMenu])

  return (
    <div className={`wysiwyg-editor h-full overflow-y-auto ${className}`}>
      <EditorContent editor={editor} />

      {editor ? (
        <>
          <FormattingBubbleMenu
            editor={editor}
            externalLinkEdit={externalLinkEdit}
            onExternalLinkEditDone={() => setExternalLinkEdit(null)}
          />
          <TableOverlayControls editor={editor} />
          {/* Block insertion menu (triggered by + button) */}
          {showBlockMenu && (
            <div
              className="block-menu-container"
              style={{
                position: 'fixed',
                top: blockMenuPosition.top,
                left: blockMenuPosition.left,
                zIndex: 100,
              }}
            >
              <BlockMenu editor={editor} onClose={() => setShowBlockMenu(false)} insertAtPos={insertAtPos} />
            </div>
          )}
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
          caret-color: #374151 !important;
          max-width: 100% !important;
          max-width: 900px !important;
          margin: 0 auto !important;
          padding: 2rem 2rem 0 4rem !important; /* Extra left padding for drag handle */
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

        /* Code block copy button */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn {
          position: absolute !important;
          top: 8px !important;
          right: 8px !important;
          display: flex !important;
          align-items: center !important;
          gap: 4px !important;
          padding: 4px 8px !important;
          background: rgba(255, 255, 255, 0.1) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 4px !important;
          color: #9ca3af !important;
          font-size: 12px !important;
          font-family: var(--ritemark-ui-font-family) !important;
          cursor: pointer !important;
          opacity: 0 !important;
          transition: opacity 0.2s, background 0.2s, color 0.2s !important;
          z-index: 10 !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block:hover .code-copy-btn {
          opacity: 1 !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn:hover {
          background: rgba(255, 255, 255, 0.2) !important;
          color: #f9fafb !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn:active {
          background: rgba(255, 255, 255, 0.3) !important;
        }

        /* Copied state - green feedback */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn.copied {
          color: #4ade80 !important;
          opacity: 1 !important;
        }

        /* Mermaid diagram styles */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block {
          padding-top: 36px !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block.mermaid-block--diagram {
          background: #f5f7fb !important;
          border: 1px solid var(--vscode-panel-border, rgba(0, 0, 0, 0.12)) !important;
          color: var(--vscode-editor-foreground, #111827) !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .mermaid-toolbar {
          position: absolute !important;
          top: 8px !important;
          right: 8px !important;
          display: flex !important;
          gap: 4px !important;
          z-index: 10 !important;
          opacity: 0 !important;
          transition: opacity 0.2s !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block:hover .mermaid-toolbar {
          opacity: 1 !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .mermaid-toolbar .code-copy-btn {
          position: static !important;
          top: auto !important;
          right: auto !important;
          opacity: 1 !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .mermaid-toggle-btn {
          opacity: 1 !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block.mermaid-block--diagram .mermaid-toolbar .code-copy-btn {
          background: rgba(255, 255, 255, 0.9) !important;
          border: 1px solid rgba(100, 116, 139, 0.24) !important;
          color: #64748b !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06) !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block.mermaid-block--diagram .mermaid-toolbar .code-copy-btn:hover {
          background: rgba(255, 255, 255, 1) !important;
          color: #334155 !important;
          border-color: rgba(67, 56, 202, 0.28) !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block.mermaid-block--diagram .mermaid-toolbar .code-copy-btn:active {
          background: rgba(238, 242, 255, 1) !important;
        }

        .wysiwyg-editor .ProseMirror .mermaid-rendered-diagram {
          display: flex !important;
          justify-content: center !important;
          align-items: flex-start !important;
          padding: 16px !important;
          min-height: 60px !important;
          max-height: 1024px !important;
          overflow: auto !important;
          background: #f5f7fb !important;
          border-radius: 12px !important;
        }

        .wysiwyg-editor .ProseMirror .mermaid-rendered-diagram svg {
          max-width: 100% !important;
          width: min(100%, 680px) !important;
          max-height: calc(1024px - 32px) !important;
          height: auto !important;
          flex-shrink: 0 !important;
        }

        .wysiwyg-editor .ProseMirror .mermaid-error {
          padding: 12px 16px !important;
          color: #f87171 !important;
          font-size: 13px !important;
          font-family: var(--vscode-editor-font-family, monospace) !important;
          border: 1px solid rgba(248, 113, 113, 0.3) !important;
          border-radius: 4px !important;
          margin: 8px 16px !important;
          background: rgba(248, 113, 113, 0.05) !important;
        }

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

        /* Drag handle styling - subtle ghost style */
        .drag-handle {
          position: fixed;
          opacity: 1 !important;
          transition: background-color 0.15s ease;
          border-radius: 4px;
          background-color: transparent;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='9' cy='5' r='1.5'/%3E%3Ccircle cx='9' cy='12' r='1.5'/%3E%3Ccircle cx='9' cy='19' r='1.5'/%3E%3Ccircle cx='15' cy='5' r='1.5'/%3E%3Ccircle cx='15' cy='12' r='1.5'/%3E%3Ccircle cx='15' cy='19' r='1.5'/%3E%3C/svg%3E");
          background-size: 16px;
          background-repeat: no-repeat;
          background-position: center;
          width: 24px;
          height: 28px;
          z-index: 50;
          cursor: grab;
          border: none;
          transform: translateX(-8px) !important; /* 8px gap from text */
        }

        .drag-handle:hover {
          background-color: rgba(0, 0, 0, 0.06);
        }

        .drag-handle:active {
          background-color: rgba(0, 0, 0, 0.1);
          cursor: grabbing;
        }

        .drag-handle.hide {
          opacity: 0 !important;
          pointer-events: none;
        }


        /* + button styling - subtle ghost style */
        .block-plus-btn {
          position: fixed;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 28px;
          border: none;
          border-radius: 4px;
          background-color: transparent;
          color: #9ca3af;
          cursor: pointer;
          opacity: 1 !important;
          transition: background-color 0.15s ease;
          z-index: 50;
        }

        .block-plus-btn:hover {
          background-color: rgba(0, 0, 0, 0.06);
        }

        .block-plus-btn:active {
          background-color: rgba(0, 0, 0, 0.1);
        }

        /* Block menu styling */
        .block-menu {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          padding: 4px;
          min-width: 200px;
          max-height: 300px;
          overflow-y: auto;
        }

        .block-menu-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: background-color 0.15s ease;
        }

        .block-menu-item:hover {
          background-color: #f3f4f6;
        }

        .block-menu-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          color: #6b7280;
        }

        .block-menu-text {
          display: flex;
          flex-direction: column;
        }

        .block-menu-title {
          font-size: 14px;
          font-weight: 500;
          color: #111827;
        }

        .block-menu-description {
          font-size: 12px;
          color: #9ca3af;
        }

        /* Hide drag handle and + button on mobile */
        @media (max-width: 768px) {
          .drag-handle,
          .block-plus-btn {
            display: none !important;
            pointer-events: none;
          }
        }

        `}</style>
    </div>
  )
}

/**
 * Extract HTML from editor selection or full document
 *
 * @param editor - TipTap editor instance
 * @returns HTML string of selected content (or full document if no selection)
 */
export function getSelectionHTML(editor: TipTapEditor): string {
  const { from, to, empty } = editor.state.selection

  // No selection - return full document HTML
  if (empty) {
    return editor.getHTML()
  }

  // Extract selected fragment using ProseMirror DOMSerializer
  const fragment = editor.state.doc.slice(from, to).content
  const schema = editor.schema
  const serializer = DOMSerializer.fromSchema(schema)
  const dom = serializer.serializeFragment(fragment)

  // Convert DOM fragment to HTML string
  const div = document.createElement('div')
  div.appendChild(dom)
  return div.innerHTML
}

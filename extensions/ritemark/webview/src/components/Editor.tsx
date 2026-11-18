import React, { useEffect, useRef, useState } from 'react'
import { countWords, onDocChanged } from '../lib/docChange'
import { useEditor, EditorContent, useEditorState, type Editor as TipTapEditor } from '@tiptap/react'
import { DOMSerializer } from '@tiptap/pm/model'
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { createNodeFromContent, type AnyExtension } from '@tiptap/core'
import { sendToExtension, onMessage } from '../bridge'
import { getClipboardImageFile, getUniqueImageFilename, readFileAsBase64, shouldPreferTextPaste } from '../lib/pastedImage'
import Placeholder from '@tiptap/extension-placeholder'
import { CodeBlockWithCopyExtension } from '../extensions/CodeBlockWithCopyExtension'
import { isRelativeImagePath, sameRelativeImagePath } from '../../../src/utils/imagePaths'
import { ImageExtension } from '../extensions/imageExtensions'
import { SlashCommands } from '../extensions/SlashCommands'
import { FileLinkSuggestions } from '../extensions/FileLinkSuggestions'
import { HeadingLevelShortcuts } from '../extensions/HeadingLevelShortcuts'
import { SelectionBoundaryKeys } from '../extensions/SelectionBoundaryKeys'
import { SearchExtension } from '../extensions/SearchExtension'
import { DictationPlaceholder } from '../extensions/DictationPlaceholder'
import { MathBlockWithView, MathEditing, MathInlineWithView } from '../extensions/math/mathEditing'
import { countEquations } from '../extensions/math/mathCount'
import { isEquationNodeSelection } from '../extensions/math/mathNodes'
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'
import AutoJoiner from 'tiptap-extension-auto-joiner'
import { FormattingBubbleMenu } from './FormattingBubbleMenu'
import { MarginCommentRail } from './MarginCommentRail'
import { TableHandlesLayer } from './tables/TableHandlesLayer'
import { PictureTools } from './pictures/PictureTools'
import { PictureMakerView, usePictureMaker, type PictureMode, type PicturePlaceRef } from './pictures/ChatgptPicture'
import { imagePathOf } from '../extensions/pictures/PictureNode'
import { caretBeforePicture, chosenPicture, chosenPictureUnder, replacePicture, replacePictureKeepingCaret } from '../extensions/pictures/pictureCommands'
import { startComment } from '../extensions/comment/CommentNode'
import { TableHandles, tableHandlesEnabled } from '../extensions/tables/TableHandles'
import { cellAtSelection, deleteColumn, deleteRow, insertColumn, insertRow } from '../extensions/tables/tableOps'
import { BlockMenu } from './BlockMenu'
import type { EditorSelection } from '../types/editor'
import type { DocumentApplyTarget } from '../types/documentSync'
import { documentReplacement } from '../lib/documentUpdate'
import {
  shouldApplyIncomingEditorValue,
  shouldPublishEditorChange,
} from '../editorValueReconciliation'
import {
  applyImageMappings,
  createEditorSchemaExtensions,
  editorHTMLToMarkdown,
  ensureCommentMarkedPipeline,
  markdownToEditorHTML,
} from '../utils/editorMarkdown'

// The editor's Markdown pipeline — `marked` on load, the schema, Turndown on
// save — lives in utils/editorMarkdown.ts (Sprint 137), so the round-trip and
// corpus tests drive the same code. The comment `marked` tokenizer registers
// lazily, gated on the flag (see ensureCommentMarkedPipeline there).

interface EditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onEditorReady?: (editor: TipTapEditor) => void
  onSelectionChange?: (selection: EditorSelection) => void
  imageMappings?: Record<string, string>
  /** Sprint 94 (#81): gate the comment-callout extensions (kill-switch flag). */
  commentCallouts?: boolean
  syncTarget?: DocumentApplyTarget
  onExternalApplied?: (target: DocumentApplyTarget) => void
  /** Sprint 130: content above the document inside the same scroll (a task
   *  card's title, state and files on its page). */
  header?: React.ReactNode
  /** Sprint 157: extra schema extensions for a mode of the editor (a deck's slide node and its guard), fixed at
   *  mount like the rest of the list. */
  extensions?: AnyExtension[]
  /** A mode's view of a host revision before it is applied (a deck draws its parts' headings into it, 16 November),
   *  so the smallest replacement is found against what the view shows. Called with the document the host's text reads
   *  as; returns it, or a copy with only view-side nodes added. */
  viewOfIncoming?: (doc: PMNode) => PMNode
}

/** A Text document's column: the editor's box is at most this wide, centred (a deck's handout alone takes it too). */
export const TEXT_COLUMN_WIDTH = 900

export function Editor({
  value,
  onChange,
  placeholder = "Start writing...",
  className = "",
  onEditorReady,
  onSelectionChange,
  imageMappings = {},
  commentCallouts = false,
  syncTarget,
  onExternalApplied,
  header,
  extensions,
  viewOfIncoming,
}: EditorProps) {
  // Register the comment `marked` tokenizer before initialContent is parsed on
  // mount — only when the flag is on (see ensureCommentMarkedPipeline above).
  if (commentCallouts) ensureCommentMarkedPipeline()

  // Scroll container element for the margin comment rail (Sprint 94 #81).
  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null)

  const isInitialMount = useRef(true)
  const lastExternalValue = useRef(value)
  const lastOnChangeValue = useRef<string>('')
  const lastImageMappingsRef = useRef<Record<string, string>>({})
  const pendingImagePosRef = useRef<number | null>(null)
  /** Experience 49: the chosen picture a paste, a drop or Replace picture… replaces once the host has saved the new one. */
  const replaceImagePosRef = useRef<number | null>(null)

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
        // Preprocess: task lists and unwrap standalone images from paragraphs
        return markdownToEditorHTML(value)
      } catch (error) {
        console.error('Markdown conversion error:', error)
        return `<p>${value.replace(/\n/g, '</p><p>')}</p>`
      }
    }
  })

  const editor: TipTapEditor | null = useEditor({
    // The editor's extensions in their order: the schema and its configuration
    // from utils/editorMarkdown.ts, with the editor's UI pieces in their slots.
    extensions: createEditorSchemaExtensions({
      afterStarterKit: [
        // Sprint 72 R4/R5: makes Mod-Alt-1..6 work from any cursor position
        // including the TOC click landing boundary. Must come after StarterKit
        // so this binding gets the first dispatch chance.
        HeadingLevelShortcuts,
        // Sprint 126 (#332): binds Shift-Home/Shift-End, which neither TipTap nor
        // ProseMirror binds. Without them Chrome's native contenteditable default
        // extended Shift+End to the end of the document, and the next Delete wiped
        // every block below the caret. Same placement reason as above.
        SelectionBoundaryKeys,
      ],
      codeBlock: CodeBlockWithCopyExtension,
      beforeLink: [
        Placeholder.configure({
          placeholder: placeholder,
        }),
      ],
      onLinkClick: (href) => {
        setExternalLinkEdit({ url: href })
      },
      image: ImageExtension,
      afterImage: [
        SlashCommands,
        FileLinkSuggestions,
        SearchExtension,
        DictationPlaceholder,
        GlobalDragHandle.configure({
          dragHandleWidth: 24,
          scrollTreshold: 100,
        }),
        AutoJoiner.configure({
          elementsToJoin: ['bulletList', 'orderedList', 'taskList'],
        }),
        // Sprint 138 (#481): writing and editing equations.
        MathEditing,
        // Tables you can change (experience 48): the grips, menus, + bars and keys of a table, unless its kill switch is off.
        ...(tableHandlesEnabled() ? [TableHandles] : []),
      ],
      commentCallouts,
      // Sprint 138 (#481): the equation nodes with their typesetting views.
      mathInline: MathInlineWithView,
      mathBlock: MathBlockWithView,
      // Sprint 157: a deck's slide node and its guard, only in a deck.
      deck: extensions,
    }),
    content: initialContent,
    onCreate: ({ editor }) => {
      // Establish the baseline from TipTap's parsed document, not the source
      // bytes. Plugin transactions after creation are then true no-ops.
      lastOnChangeValue.current = editorHTMLToMarkdown(editor.getHTML())
      onEditorReady?.(editor)
    },
    onUpdate: ({ editor }) => {
      const markdown = editorHTMLToMarkdown(editor.getHTML())

      // Only call onChange if content actually changed
      // This prevents unnecessary re-renders that close bubble menus
      if (shouldPublishEditorChange({
        nextMarkdown: markdown,
        canonicalBaseline: lastOnChangeValue.current,
      })) {
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
            // Experience 49: dropped onto the chosen picture, it replaces it; dropped anywhere else, it goes there.
            replaceImagePosRef.current = chosenPictureUnder(_view, event.target)?.pos ?? null
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
          // Experience 49: pasted onto the chosen picture, it replaces it.
          replaceImagePosRef.current = chosenPicture(_view.state)?.pos ?? null
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

        // Table row/column operations (only when inside a table), through the table's own operations (experience 48),
        // so the header row stays first and the delimiter row (alignment, column widths) follows the change.
        const tableCell = cellAtSelection(view.state)
        if (tableCell && isMod) {
          // A key whose operation does nothing here (Cmd+Backspace in the header row) stays the editor's own.
          const tableKey = (make: (state: typeof view.state) => ReturnType<typeof insertRow>) => {
            const tr = make(view.state)
            if (!tr) return false
            event.preventDefault()
            view.dispatch(tr)
            return true
          }
          const { pos: tablePos, row, col } = tableCell
          // Cmd+Shift+↑ / ↓ - Add row before / after
          if (event.shiftKey && event.key === 'ArrowUp') return tableKey(state => insertRow(state, tablePos, row, col))
          if (event.shiftKey && event.key === 'ArrowDown') return tableKey(state => insertRow(state, tablePos, row + 1, col))
          // Cmd+Shift+← / → - Add column before / after
          if (event.shiftKey && event.key === 'ArrowLeft') return tableKey(state => insertColumn(state, tablePos, col, row))
          if (event.shiftKey && event.key === 'ArrowRight') return tableKey(state => insertColumn(state, tablePos, col + 1, row))
          // Cmd+Backspace - Delete row (never the header row); Cmd+Delete - Delete column
          if (event.key === 'Backspace') return tableKey(state => deleteRow(state, tablePos, row, col))
          if (event.key === 'Delete') return tableKey(state => deleteColumn(state, tablePos, col))
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
      const { selection } = ctx.editor.state
      // Sprint 138: clicking or Entering an equation selects its node to open
      // it. That is the cursor's place, as a click into text is, so the AI gets
      // no "selected text"; a dragged or Shift-arrow selection still does.
      const opened = isEquationNodeSelection(selection)
      const from = selection.from
      const to = opened ? selection.from : selection.to
      const empty = opened || selection.empty
      const doc = ctx.editor.state.doc
      const text = doc.textBetween(from, to, ' ')

      // Capture surrounding context so the AI sidebar can give the agent
      // an unambiguous fingerprint of WHERE in the file the selection is.
      // Line numbers were unreliable (TipTap from/to are ProseMirror
      // positions, not source-character offsets, and a fallback indexOf
      // search hit the first occurrence — wrong when the same word appears
      // in frontmatter and body). 80 chars on each side is enough to
      // disambiguate from any other occurrence in a typical markdown file.
      const CONTEXT_CHARS = 80
      const contextBefore = empty ? '' : doc.textBetween(Math.max(0, from - CONTEXT_CHARS), from, ' ')
      const contextAfter = empty ? '' : doc.textBetween(to, Math.min(doc.content.size, to + CONTEXT_CHARS), ' ')

      const result = {
        text,
        from,
        to,
        isEmpty: empty,
        wordCount: text.trim() ? text.split(/\s+/).filter(Boolean).length : 0,
        contextBefore,
        contextAfter,
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

  // Pictures with ChatGPT (experience 49): Make a new picture… and Change this picture… on a chosen picture. The made
  // picture takes its place as one undo step, keeping its size, as Replace picture… does.
  const pictureRect = React.useCallback((place: PicturePlaceRef): DOMRect | null => {
    if (!editor || editor.isDestroyed || place.kind !== 'flow') return null
    const dom = editor.view.nodeDOM(place.pos) as HTMLElement | null
    const root = (dom?.firstElementChild ?? dom) as HTMLElement | null
    return root?.isConnected ? root.getBoundingClientRect() : null
  }, [editor])
  const pictureMaker = usePictureMaker({
    editor,
    rectOf: pictureRect,
    beforeMake: ask => (ask.place.kind === 'flow' && editor && !editor.isDestroyed && editor.state.doc.nodeAt(ask.place.pos)?.type.name === 'image' ? {} : null),
    placeMade: (place, picture, describe) => {
      if (!editor || editor.isDestroyed || place.kind !== 'flow') return
      const old = editor.state.doc.nodeAt(place.pos)
      const alt = describe(String(old?.attrs.alt ?? ''), old ? imagePathOf(old.attrs) : null)
      const tr = replacePictureKeepingCaret(editor.state, place.pos, { src: picture.url, title: picture.path }, alt)
      if (tr) editor.view.dispatch(tr)
    },
    undo: () => { if (editor && !editor.isDestroyed) editor.chain().focus().undo().run() },
  })
  const startPictureMaker = (pos: number, mode: PictureMode) => {
    const node = editor?.state.doc.nodeAt(pos)
    if (!node) return
    const alt = String(node.attrs.alt ?? '')
    pictureMaker.start({
      place: { kind: 'flow', pos, path: imagePathOf(node.attrs) ?? undefined },
      mode,
      // A new picture starts from the old one's description; a change from nothing.
      suggestion: mode === 'new' ? alt : '',
      ...(mode === 'change' ? { source: imagePathOf(node.attrs) ?? '' } : {}),
    })
  }

  // Experience 49: the picture being replaced follows its place through edits made while the host saves the new one.
  useEffect(() => {
    if (!editor) return
    // A picture deleted meanwhile is no longer replaced: nothing else takes its place (review of #774).
    const follow = ({ transaction }: { transaction: { docChanged: boolean; mapping: { mapResult: (pos: number, assoc?: number) => { pos: number; deleted: boolean } } } }) => {
      if (!transaction.docChanged || replaceImagePosRef.current === null) return
      const mapped = transaction.mapping.mapResult(replaceImagePosRef.current, 1)
      replaceImagePosRef.current = mapped.deleted ? null : mapped.pos
    }
    editor.on('transaction', follow)
    return () => { editor.off('transaction', follow) }
  }, [editor])

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
        // Experience 49: a paste, a drop or Replace picture… on a chosen picture puts the new one in its place, keeping
        // its size and description, as one undo step.
        const replacing = replaceImagePosRef.current
        replaceImagePosRef.current = null
        const replaced = replacing === null ? null : replacePicture(editor.state, replacing, { src: message.displaySrc, title: message.path })
        if (replaced) {
          editor.view.dispatch(replaced)
          editor.view.focus()
          sendToExtension('imageInserted', { path: message.path })
          return
        }
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
        // Ack so flows that open another editor next (e.g. /diagram) wait
        // until the insert has reached the TextDocument — opening a new tab
        // earlier steals focus, and an externalChange reload from disk (which
        // doesn't have the image yet) would wipe the fresh insert.
        sendToExtension('imageInserted', { path: message.path })
      } else if (message.type === 'imageRefreshed' && message.displaySrc && message.path) {
        // The image file changed on disk (e.g. a .drawio.svg saved from the
        // diagram editor) — surgically swap the src of matching image nodes.
        // title holds the markdown-relative path; the new displaySrc carries a
        // cache-buster so the webview actually refetches.
        const { state, view } = editor
        const tr = state.tr
        const changedPath = message.path
        let changed = false
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'image' && typeof node.attrs.title === 'string'
            && sameRelativeImagePath(node.attrs.title, changedPath)) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: message.displaySrc })
            changed = true
          }
        })
        if (changed) {
          tr.setMeta('addToHistory', false)
          view.dispatch(tr)
        }
      } else if (message.type === 'imageSelectionCancelled') {
        // Replace picture… cancelled: the picture stays, and a later paste goes where the caret is.
        replaceImagePosRef.current = null
      } else if (message.type === 'imageError' && message.error) {
        replaceImagePosRef.current = null
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

  // Apply host revisions even while focused. A structural transaction preserves
  // unaffected nodes and maps the selection; setContent is only a guarded fallback.
  useEffect(() => {
    if (!editor) return

    // Convert current editor HTML back to markdown to compare with incoming value
    const currentMarkdown = editorHTMLToMarkdown(editor.getHTML())

    // Initial mount is an explicit reconciliation reason. Do not infer it from
    // an empty Markdown projection: an empty heading created by `# ` also
    // serializes to an empty string until the first title character arrives.
    const initialMount = isInitialMount.current
    if (initialMount) {
      isInitialMount.current = false
      lastExternalValue.current = value
      lastOnChangeValue.current = currentMarkdown
    }

    // Check if imageMappings changed - need to re-apply them
    const imageMappingsChanged = Object.keys(imageMappings).length > 0 &&
      Object.keys(imageMappings).length !== Object.keys(lastImageMappingsRef.current).length

    if (shouldApplyIncomingEditorValue({
      initialMount,
      incomingValue: value,
      currentMarkdown,
      lastOnChangeValue: lastOnChangeValue.current,
      imageMappingsChanged,
    })) {
      // Update the ref
      lastImageMappingsRef.current = imageMappings
      // Check if value is HTML (starts with common HTML tags)
      // Only check for actual HTML block tags, not random < > characters
      const isHTML = /^<(p|div|h[1-6]|ul|ol|li|blockquote|pre|table|strong|em|code)[\s>]/i.test(value.trim())

      let processedContent: string
      if (!isHTML && value.trim()) {
        // Treat all non-HTML text as markdown (including plain text)
        // marked.js will handle plain text gracefully, converting line breaks to <p> tags
        try {
          // Convert GFM task list HTML to TipTap format, unwrap standalone
          // images from paragraphs, and apply image mappings to convert
          // relative paths to webview URIs
          processedContent = markdownToEditorHTML(value, imageMappings)
        } catch (error) {
          console.error('Markdown conversion error:', error)
          // Fallback: treat as plain text
          processedContent = `<p>${value.replace(/\n/g, '</p><p>')}</p>`
        }
      } else {
        // Already HTML or empty - still apply image mappings
        processedContent = applyImageMappings(value, imageMappings)
      }

      const wasFocused = editor.isFocused
      const { anchor, head } = editor.state.selection
      const scrollTop = scrollContainer?.scrollTop
      // Sprint 145 R1 (#588, experience 44): nothing moves under the person. When the caret is in view, the page
      // keeps its place by the caret's paragraph, so a change above the view doesn't push it; otherwise the
      // scroll position is kept as before. A merge of a writer's copy is one undo step; other host updates stay
      // out of the history.
      const undoable = syncTarget?.undoable === true
      let anchorAfter = anchor
      let caretTopBefore: number | undefined
      try {
        const view = scrollContainer?.getBoundingClientRect()
        const caret = editor.view.coordsAtPos(anchor)
        if (view && caret.top >= view.top && caret.bottom <= view.bottom) caretTopBefore = caret.top
      } catch {
        caretTopBefore = undefined
      }
      try {
        const parsed = createNodeFromContent(processedContent, editor.schema, {
          slice: false,
          parseOptions: { preserveWhitespace: 'full' },
          errorOnInvalidContent: true,
        })
        const hostDoc = parsed instanceof Fragment
          ? editor.schema.topNodeType.create(null, parsed)
          : parsed
        const nextDoc = viewOfIncoming ? viewOfIncoming(hostDoc) : hostDoc
        // The smallest replacement, with the front and back diffs kept from
        // overlapping (an overlap froze the editor; lib/documentUpdate.ts).
        const replacement = documentReplacement(editor.state.doc, nextDoc)
        if (replacement) {
          let transaction = editor.state.tr.replace(replacement.from, replacement.to, replacement.slice)
          const mappedAnchor = Math.max(0, Math.min(transaction.doc.content.size, transaction.mapping.map(anchor)))
          const mappedHead = Math.max(0, Math.min(transaction.doc.content.size, transaction.mapping.map(head)))
          anchorAfter = mappedAnchor
          transaction = transaction
            .setSelection(TextSelection.between(transaction.doc.resolve(mappedAnchor), transaction.doc.resolve(mappedHead)))
            .setMeta('addToHistory', undoable)
            .setMeta('preventUpdate', true)
            .setMeta('ritemarkDocumentRevision', syncTarget?.revision)
          if (!transaction.doc.eq(nextDoc)) throw new Error('Structural update did not reproduce the host document.')
          // A merge is its own undo step: not joined to the person's typing before it.
          editor.view.dispatch(undoable ? closeHistory(transaction) : transaction)
        }
      } catch {
        console.warn('[EditorSync] structural apply fell back to full replacement')
        editor.chain()
          .command(({ tr }) => { if (undoable) closeHistory(tr); return true })
          .setContent(processedContent, false)
          .setMeta('addToHistory', undoable)
          .setMeta('ritemarkDocumentRevision', syncTarget?.revision)
          .run()
        const position = Math.max(0, Math.min(editor.state.doc.content.size, anchor))
        anchorAfter = position
        editor.view.dispatch(editor.state.tr
          .setSelection(TextSelection.near(editor.state.doc.resolve(position)))
          .setMeta('addToHistory', false)
          .setMeta('preventUpdate', true))
      }
      // ...nor the typing after it: the next keystroke starts a new undo step.
      if (undoable) editor.view.dispatch(closeHistory(editor.state.tr).setMeta('addToHistory', false).setMeta('preventUpdate', true))

      // Structural application and the fallback both suppress onUpdate. Keep
      // the outgoing baseline aligned with the actual parsed TipTap document,
      // so a later plugin-only update cannot be published as a user edit.
      lastOnChangeValue.current = editorHTMLToMarkdown(editor.getHTML())

      lastExternalValue.current = value
      requestAnimationFrame(() => {
        if (scrollContainer && scrollTop !== undefined) {
          scrollContainer.scrollTop = scrollTop
          if (caretTopBefore !== undefined) {
            try {
              scrollContainer.scrollTop += editor.view.coordsAtPos(anchorAfter).top - caretTopBefore
            } catch {
              // The caret's place is gone (its paragraph was replaced): keep the scroll position.
            }
          }
        }
        if (wasFocused) editor.view.focus()
      })
      // #512: the acknowledgement does not wait for a frame. The document is
      // applied once the transaction above is dispatched, and a window behind
      // other windows (or minimized) runs no animation frames: an ack in one
      // never came, and the host showed a false "Retry document update" after
      // its delivery budget, on text the editor already showed. A microtask
      // runs after this effect, and is not throttled.
      if (syncTarget) queueMicrotask(() => onExternalApplied?.(syncTarget))
    } else if (syncTarget) {
      // The source view already rendered its own accepted edit. It still owes
      // the host an acknowledgement for the matching canonical revision —
      // also without waiting for a frame (#512).
      queueMicrotask(() => onExternalApplied?.(syncTarget))
    }
  }, [editor, value, imageMappings, scrollContainer, syncTarget, onExternalApplied])

  // Calculate word count - simple approach using editor state
  const [_wordCount, setWordCount] = useState(0)

  // Update word count when editor content changes and send to extension
  useEffect(() => {
    if (!editor) return

    const updateWordCount = () => {
      const count = countWords(editor.state.doc)
      setWordCount(count)
      // Send word count to extension for status bar display. Sprint 138
      // (experience 38): with the equations beside it, "96 words · 5 equations".
      sendToExtension('wordCountChanged', { wordCount: count, equationCount: countEquations(editor.state.doc) })
    }

    // Initial count
    updateWordCount()

    // Listen for every document change, including host-applied revisions
    return onDocChanged(editor, updateWordCount)
  }, [editor])

  // Create and manage the + button alongside the drag handle
  useEffect(() => {
    if (!editor) return

    // Create the + button element
    const plusButton = document.createElement('button')
    plusButton.className = 'block-plus-btn'
    plusButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
    plusButton.dataset.tooltip = 'Add block' // the one tooltip look, drawn by CSS (the button lives outside React; #576)
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
    <div
      ref={setScrollContainer}
      className={`wysiwyg-editor h-full overflow-y-auto relative ${className}`}
    >
      {header}
      <EditorContent editor={editor} />

      {editor ? (
        <>
          <FormattingBubbleMenu
            editor={editor}
            externalLinkEdit={externalLinkEdit}
            onExternalLinkEditDone={() => setExternalLinkEdit(null)}
            commentCallouts={commentCallouts}
          />
          {commentCallouts && (
            <MarginCommentRail editor={editor} container={scrollContainer} />
          )}
          {tableHandlesEnabled() ? <TableHandlesLayer editor={editor} /> : null}
          {/* Experience 49: the chosen picture's ring, handles, crop frame and bar. */}
          <PictureTools
            editor={editor}
            context="document"
            comments={commentCallouts}
            onComment={pos => commentOnPicture(editor, pos)}
            onReplace={pos => {
              replaceImagePosRef.current = pos
              sendToExtension('selectImageFile')
            }}
            onChatgpt={startPictureMaker}
            chatgptCanChange={pos => isRelativeImagePath(imagePathOf(editor.state.doc.nodeAt(pos)?.attrs ?? {}) ?? '')}
            barHidden={pictureMaker.state.phase !== 'idle'}
          />
          <PictureMakerView maker={pictureMaker} rectOf={pictureRect} />
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
          color: var(--r-ink-body) !important;
          caret-color: var(--r-ink-body) !important;
          max-width: 100% !important;
          max-width: ${TEXT_COLUMN_WIDTH}px !important;
          margin: 0 auto !important;
          padding: 2rem 2rem 0 4rem !important; /* Extra left padding for drag handle */
        }

        .wysiwyg-editor .ProseMirror p {
          margin: 0 0 1em 0 !important;
          font-size: 18px !important;
          line-height: 1.7 !important;
          color: var(--r-ink-body) !important;
        }

        .wysiwyg-editor .ProseMirror h1 {
          font-size: 2rem !important;
          font-weight: 600 !important;
          margin: 1.5em 0 0.5em 0 !important;
          color: var(--r-ink-strong) !important;
        }

        .wysiwyg-editor .ProseMirror h2 {
          font-size: 1.5rem !important;
          font-weight: 600 !important;
          margin: 1.25em 0 0.5em 0 !important;
          color: var(--r-ink-strong) !important;
        }

        .wysiwyg-editor .ProseMirror h3 {
          font-size: 1.25rem !important;
          font-weight: 600 !important;
          margin: 1em 0 0.5em 0 !important;
          color: var(--r-ink-strong) !important;
        }

        .wysiwyg-editor .ProseMirror h4 {
          font-size: 1.125rem !important;
          font-weight: 600 !important;
          margin: 1em 0 0.5em 0 !important;
          color: var(--r-ink-strong) !important;
        }

        .wysiwyg-editor .ProseMirror h5 {
          font-size: 1rem !important;
          font-weight: 600 !important;
          margin: 1em 0 0.5em 0 !important;
          color: var(--r-ink-strong) !important;
        }

        .wysiwyg-editor .ProseMirror h6 {
          font-size: 0.875rem !important;
          font-weight: 600 !important;
          margin: 1em 0 0.5em 0 !important;
          color: var(--r-ink-strong) !important;
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
          border: 2px solid var(--r-ink-faint) !important;
          border-radius: 3px !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          background-color: var(--r-surface) !important;
          position: relative !important;
          top: 1px !important;
          flex-shrink: 0 !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item > label > input[type="checkbox"]:checked {
          background-color: var(--r-accent) !important;
          border-color: var(--r-accent) !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item > label > input[type="checkbox"]:checked::after {
          content: '✓' !important;
          position: absolute !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
          color: #ffffff !important;
          font-size: 11px !important;
          font-weight: bold !important;
          line-height: 1 !important;
        }

        .wysiwyg-editor .ProseMirror li.tiptap-task-item > label > input[type="checkbox"]:hover {
          border-color: var(--r-accent) !important;
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
          color: var(--r-ink-strong) !important;
        }

        .wysiwyg-editor .ProseMirror em {
          font-style: italic !important;
          color: var(--r-ink-body) !important;
        }

        .wysiwyg-editor .ProseMirror a.tiptap-link {
          color: var(--r-accent) !important;
          text-decoration: underline !important;
          cursor: pointer !important;
        }

        .wysiwyg-editor .ProseMirror a.tiptap-link:hover {
          color: var(--r-accent-deep) !important;
        }

        /* Blockquote styling */
        .wysiwyg-editor .ProseMirror blockquote {
          border-left: 4px solid var(--r-accent) !important;
          padding-left: 1rem !important;
          margin: 1em 0 !important;
          color: var(--r-ink-muted) !important;
          font-style: italic !important;
          background: var(--r-surface-soft) !important;
          padding: 0.75rem 1rem !important;
          border-radius: 0 8px 8px 0 !important;
        }

        .wysiwyg-editor .ProseMirror blockquote p {
          margin: 0 !important;
        }

        /* Increased specificity to override Vite HMR styles in dev mode */
        /* NOTE: bg must differ from --r-accent-soft (used for row hover) so a
           selection inside a hovered row remains visually distinct. */
        div.wysiwyg-editor .ProseMirror.ProseMirror ::selection {
          background: rgba(67, 56, 202, 0.32) !important;
          border-radius: 2px !important;
        }

        div.wysiwyg-editor .ProseMirror.ProseMirror ::-moz-selection {
          background: rgba(67, 56, 202, 0.32) !important;
        }

        /* Code block selection: dark navy bg + white text (default white-on-light-lavender is invisible) */
        div.wysiwyg-editor .ProseMirror pre.tiptap-code-block ::selection,
        div.wysiwyg-editor .ProseMirror pre.tiptap-code-block::selection,
        div.wysiwyg-editor .ProseMirror pre.tiptap-code-block *::selection {
          background: #3b4a6b !important;
          color: #ffffff !important;
        }
        div.wysiwyg-editor .ProseMirror pre.tiptap-code-block ::-moz-selection,
        div.wysiwyg-editor .ProseMirror pre.tiptap-code-block::-moz-selection,
        div.wysiwyg-editor .ProseMirror pre.tiptap-code-block *::-moz-selection {
          background: #3b4a6b !important;
          color: #ffffff !important;
        }

        /* Table cell selection: saturated indigo bg + force dark text. Must differ
           from --r-accent-soft (row hover) so selecting text in a hovered row stays visible. */
        div.wysiwyg-editor .ProseMirror td.tiptap-table-cell ::selection,
        div.wysiwyg-editor .ProseMirror th.tiptap-table-header ::selection,
        div.wysiwyg-editor .ProseMirror td.tiptap-table-cell::selection,
        div.wysiwyg-editor .ProseMirror th.tiptap-table-header::selection,
        div.wysiwyg-editor .ProseMirror td.tiptap-table-cell *::selection,
        div.wysiwyg-editor .ProseMirror th.tiptap-table-header *::selection {
          background: rgba(67, 56, 202, 0.32) !important;
          color: var(--r-ink-strong) !important;
        }
        div.wysiwyg-editor .ProseMirror td.tiptap-table-cell ::-moz-selection,
        div.wysiwyg-editor .ProseMirror th.tiptap-table-header ::-moz-selection,
        div.wysiwyg-editor .ProseMirror td.tiptap-table-cell::-moz-selection,
        div.wysiwyg-editor .ProseMirror th.tiptap-table-header::-moz-selection,
        div.wysiwyg-editor .ProseMirror td.tiptap-table-cell *::-moz-selection,
        div.wysiwyg-editor .ProseMirror th.tiptap-table-header *::-moz-selection {
          background: rgba(67, 56, 202, 0.32) !important;
          color: var(--r-ink-strong) !important;
        }

        /* Code block styling with dark theme */
        /* Sprint 74 R3 (#84): overflow visible on the pre so the absolutely
           positioned copy-button tooltip never creates a spurious horizontal
           scrollbar; the inner code element carries the scroll instead. */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block {
          background: #1f2937 !important;
          color: #f9fafb !important;
          border-radius: 8px !important;
          padding: 1rem !important;
          margin: 1em 0 !important;
          overflow: visible !important;
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
          display: block !important;
          overflow-x: auto !important;
          min-width: 0 !important;
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

        /* Sprint 163 PR 1: Copy, the same pill as a slide's code block (slide.css .cb-copy): its icon and "Copy", then
           "Copied", at the block's top right, always shown, the words flowing around it, as on a slide. The tooltip
           is ui/tooltip.tsx's. The code runs inline for that (a block of its own would stand beside the pill), and a
           long word wraps rather than scroll. */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.cb::after {
          content: '' !important;
          display: block !important;
          clear: both !important;
        }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.cb > code {
          display: inline !important;
          overflow: visible !important;
          overflow-wrap: anywhere !important;
        }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .cb-tools {
          float: right !important;
          position: relative !important;
          z-index: 1 !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 4px !important;
          margin: -6px -8px 4px 12px !important;
          user-select: none !important;
        }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .cb-copy {
          height: 28px !important;
          padding: 0 12px !important;
          gap: 6px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: rgba(255, 255, 255, 0.12) !important;
          color: #fff !important;
          font: 600 13px/1 'Sofia Sans', var(--ritemark-ui-font-family), sans-serif !important;
        }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .cb-copy svg {
          width: 14px !important;
          height: 14px !important;
          color: currentColor !important;
          fill: currentColor !important;
        }
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .cb-copy:hover {
          background: rgba(255, 255, 255, 0.22) !important;
          color: #fff !important;
        }

        /* A Mermaid diagram's toolbar buttons (icon-only, ghost button per Ritemark design) */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn {
          position: absolute !important;
          top: 8px !important;
          right: 8px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 28px !important;
          height: 28px !important;
          padding: 0 !important;
          background: rgba(255, 255, 255, 0.08) !important;
          border: 1px solid rgba(255, 255, 255, 0.16) !important;
          border-radius: 4px !important;
          color: var(--r-ink-faint) !important;
          cursor: pointer !important;
          opacity: 0 !important;
          transition: opacity 0.15s, background 0.15s, color 0.15s, border-color 0.15s !important;
          z-index: 10 !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block:hover .code-copy-btn {
          opacity: 1 !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn:hover {
          background: rgba(255, 255, 255, 0.16) !important;
          color: var(--r-ink-strong) !important;
          border-color: rgba(255, 255, 255, 0.28) !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn:active {
          background: rgba(255, 255, 255, 0.24) !important;
        }

        :where(:root:not([data-input-mode="pointer"])) .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn:focus-visible {
          opacity: 1 !important; /* shown while the keyboard is on it, not only on hover: an unseen button can't show its ring */
          outline: 2px solid var(--r-focus-ring) !important;
          outline-offset: 2px !important;
          box-shadow: none !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn:disabled {
          opacity: 0.5 !important;
          cursor: not-allowed !important;
        }

        /* Copied state: the icon swaps to a check, which is the sign, and the button stays shown while it says
           so (a diagram's toolbar still hides with the pointer). The check is drawn in the Icon's own muted tone,
           as the copy icon was: a colour here named green never showed, because an Icon's tone was its fill
           before #614. Green is only the ready dot (Sprint 145, #578) */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn.copied {
          opacity: 1 !important;
        }

        /* A tooltip below the button on hover and keyboard focus, in the one tooltip look (Sprint 146, #576;
           ui/tooltip.tsx's TOOLTIP_SURFACE): the theme's surface and strong ink, a hairline, the menus' shadow */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn::after,
        .block-plus-btn::after {
          content: attr(data-tooltip) !important;
          position: absolute !important;
          top: calc(100% + 6px) !important;
          left: 50% !important;
          transform: translateX(-50%) translateY(-2px) !important;
          background: var(--r-surface) !important;
          color: var(--r-ink-strong) !important;
          border: 1px solid var(--r-hairline) !important;
          padding: 2px 8px !important;
          border-radius: 5px !important;
          font-family: var(--ritemark-ui-font-family) !important;
          font-size: 12px !important;
          font-weight: 400 !important;
          line-height: 1.35 !important;
          white-space: nowrap !important;
          pointer-events: none !important;
          opacity: 0 !important;
          transition: opacity 0.15s ease, transform 0.15s ease !important;
          transition-delay: 0.4s !important;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) !important;
          z-index: 100 !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn:hover::after,
        :where(:root:not([data-input-mode="pointer"])) .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn:focus-visible::after,
        .block-plus-btn:hover::after,
        :where(:root:not([data-input-mode="pointer"])) .block-plus-btn:focus-visible::after {
          opacity: 1 !important;
          transform: translateX(-50%) translateY(0) !important;
        }

        /* Hide tooltip when no data-tooltip attribute (safety) */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .code-copy-btn:not([data-tooltip])::after,
        .block-plus-btn:not([data-tooltip])::after {
          content: none !important;
        }

        /* The block's + sits at the editor's left edge: its tooltip runs right from the button, never past the edge */
        .block-plus-btn::after {
          left: 0 !important;
          transform: translateY(-2px) !important;
        }
        .block-plus-btn:hover::after,
        :where(:root:not([data-input-mode="pointer"])) .block-plus-btn:focus-visible::after {
          transform: translateY(0) !important;
        }

        /* Mermaid diagram styles */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block {
          padding-top: 28px !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block.mermaid-block--diagram {
          background: var(--r-surface-muted) !important;
          border: 1px solid var(--r-hairline) !important;
          color: var(--r-ink-strong) !important;
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
          position: relative !important;
          top: auto !important;
          right: auto !important;
          opacity: 1 !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block .mermaid-toggle-btn {
          opacity: 1 !important;
        }

        /* Mermaid diagram (light surface) — ghost button per Ritemark design */
        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block.mermaid-block--diagram .mermaid-toolbar .code-copy-btn {
          background: var(--r-surface) !important;
          border: 1px solid var(--r-hairline) !important;
          color: var(--r-ink-muted) !important;
          box-shadow: 0 1px 2px rgba(30, 27, 75, 0.04) !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block.mermaid-block--diagram .mermaid-toolbar .code-copy-btn:hover {
          background: var(--r-surface) !important;
          color: var(--r-ink-strong) !important;
          border-color: var(--r-hairline-strong) !important;
        }

        .wysiwyg-editor .ProseMirror pre.tiptap-code-block.mermaid-block.mermaid-block--diagram .mermaid-toolbar .code-copy-btn:active {
          background: var(--r-accent-soft) !important;
          border-color: var(--r-accent-fainter) !important;
        }

        .wysiwyg-editor .ProseMirror .mermaid-rendered-diagram {
          display: block !important;
          padding: 8px !important;
          max-height: 1024px !important;
          overflow: auto !important;
          background: var(--r-surface-muted) !important;
          border-radius: 8px !important;
          text-align: center !important;
        }

        .wysiwyg-editor .ProseMirror .mermaid-rendered-diagram svg {
          display: inline-block !important;
          max-width: none !important;
          width: auto !important;
          max-height: calc(1024px - 16px) !important;
          height: auto !important;
        }

        .wysiwyg-editor .ProseMirror .mermaid-error {
          padding: 12px 16px !important;
          color: var(--r-error) !important;
          font-size: 13px !important;
          font-family: var(--vscode-editor-font-family, monospace) !important;
          border: 1px solid var(--r-error-soft) !important;
          border-radius: 4px !important;
          margin: 8px 16px !important;
          background: var(--r-error-soft) !important;
        }

        /* Mermaid expanded view overlay (Sprint 56) */
        .mermaid-expand-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 1000 !important;
          background: rgba(15, 23, 42, 0.72) !important;
          display: flex !important;
          flex-direction: column !important;
          padding: 16px !important;
          gap: 8px !important;
        }

        /* Expand toolbar — single white container holding all controls (matches native
           FormattingBubbleMenu pattern: bg-white + hairline border + shadow + p-2) */
        .mermaid-expand-overlay .mermaid-expand-toolbar {
          display: inline-flex !important;
          align-items: center !important;
          align-self: center !important;
          gap: 4px !important;
          flex: 0 0 auto !important;
          background: var(--r-surface) !important;
          border: 1px solid var(--r-hairline-strong) !important;
          border-radius: 10px !important;
          /* Sprint 142 (#503; framework §4): the kit's floating sheet (kit: .menu, .bubble): ink in Light, black at 40% in
             Dark, none in high contrast, from the theme's ritemark.sheetShadow */
          box-shadow: 0 10px 24px -6px var(--vscode-ritemark-sheetShadow, rgba(30, 27, 75, 0.16)), 0 4px 8px -4px var(--vscode-ritemark-sheetShadow, rgba(30, 27, 75, 0.08)) !important;
          padding: 6px !important;
          color: var(--r-ink-strong) !important;
        }

        .mermaid-expand-overlay .mermaid-expand-toolbar__group {
          display: inline-flex !important;
          align-items: center !important;
          gap: 2px !important;
        }

        .mermaid-expand-overlay .mermaid-expand-toolbar__divider {
          width: 1px !important;
          height: 24px !important;
          background: var(--r-hairline-strong) !important;
          margin: 0 4px !important;
        }

        .mermaid-expand-overlay .mermaid-expand-zoom {
          color: var(--r-ink-strong) !important;
          font-size: 12px !important;
          font-family: var(--vscode-editor-font-family, ui-monospace, monospace) !important;
          padding: 0 10px !important;
          background: var(--r-surface-soft) !important;
          border-radius: 6px !important;
          min-width: 56px !important;
          height: 32px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-variant-numeric: tabular-nums !important;
          font-weight: 500 !important;
        }

        /* Toolbar buttons — ghost style inside the white toolbar container.
           Matches FormattingBubbleMenu native pattern: no per-button bg/border, hover
           surface-soft. Buttons are 32×32 square with 16px Phosphor icons. */
        .mermaid-expand-overlay .mermaid-expand-btn {
          background: transparent !important;
          border: none !important;
          color: var(--r-ink-strong) !important;
          opacity: 1 !important;
          position: relative !important;
          width: 36px !important;
          height: 36px !important;
          padding: 0 !important;
          border-radius: 6px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: none !important;
          cursor: pointer !important;
          transition: background var(--ritemark-dur-fast, 0.12s) ease,
                      color var(--ritemark-dur-fast, 0.12s) ease !important;
        }

        .mermaid-expand-overlay .mermaid-expand-btn:hover {
          background: var(--r-surface-soft) !important;
          color: var(--r-accent-deep, var(--r-accent)) !important;
        }

        .mermaid-expand-overlay .mermaid-expand-btn:active {
          background: var(--r-accent-soft) !important;
          color: var(--r-accent-deep, var(--r-accent)) !important;
        }

        .mermaid-expand-overlay .mermaid-expand-btn:disabled {
          background: transparent !important;
          color: var(--r-ink-faint) !important;
          cursor: not-allowed !important;
        }

        /* Force SVG icon to inherit button color — Icon component sets explicit color
           via Phosphor prop; !important wins so icons follow button hover/active states. */
        .mermaid-expand-overlay .mermaid-expand-btn svg {
          color: inherit !important;
        }

        .mermaid-expand-overlay .mermaid-expand-canvas {
          flex: 1 1 auto !important;
          overflow: auto !important;
          background: var(--r-surface-muted) !important;
          border-radius: 8px !important;
          position: relative !important;
        }

        .mermaid-expand-overlay .mermaid-expand-stage {
          display: inline-block !important;
          padding: 24px !important;
          will-change: transform !important;
        }

        .mermaid-expand-overlay .mermaid-expand-stage svg {
          display: block !important;
          max-width: none !important;
          width: auto !important;
          height: auto !important;
        }

        .mermaid-expand-overlay .mermaid-expand-code-view {
          display: block !important;
          margin: 0 !important;
          padding: 24px !important;
          background: transparent !important;
          color: var(--r-ink-strong) !important;
          font-family: var(--vscode-editor-font-family, ui-monospace, SFMono-Regular, monospace) !important;
          font-size: 13px !important;
          line-height: 1.6 !important;
          white-space: pre !important;
          tab-size: 2 !important;
        }

        .mermaid-expand-overlay .mermaid-expand-code-view code {
          background: transparent !important;
          padding: 0 !important;
          color: inherit !important;
          font-family: inherit !important;
          font-size: inherit !important;
        }

        .mermaid-expand-overlay .mermaid-expand-hint {
          color: rgba(255, 255, 255, 0.7) !important;
          font-size: 11px !important;
          text-align: center !important;
          flex: 0 0 auto !important;
          font-family: var(--vscode-editor-font-family, monospace) !important;
        }

        /* Enhanced mobile selection */
        @media (max-width: 768px) {
          div.wysiwyg-editor .ProseMirror.ProseMirror ::selection {
            background: rgba(67, 56, 202, 0.32) !important;
          }
        }

        .wysiwyg-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: var(--r-ink-faint) !important;
          content: attr(data-placeholder) !important;
          float: left !important;
          height: 0 !important;
          pointer-events: none !important;
        }

        /* Table styling - Based on Sprint 11 research with user-requested colors */
        /* Table container */
        /* Tables you can change (experience 48): the table's element holds its handles beside it. It reaches 24 px
           into the page's margin, so the row grips sit there and the block drag handle sits left of them. */
        .wysiwyg-editor .ProseMirror .rm-table {
          margin-left: -24px;
          padding-left: 24px;
        }

        /* A column is never narrower than its longest word, and words never break inside (experience 48): the
           columns take their width from their words, the table the page's width at least. */
        .wysiwyg-editor .ProseMirror table.tiptap-table-node {
          border-collapse: collapse !important;
          table-layout: auto !important;
          width: 100% !important;
          margin: 1em 0 !important;
          overflow: hidden !important;
          border: 1px solid var(--r-hairline) !important; /* User requested: 1px solid light grey */
        }

        /* Table cells */
        .wysiwyg-editor .ProseMirror td.tiptap-table-cell,
        .wysiwyg-editor .ProseMirror th.tiptap-table-header {
          min-width: 1em !important;
          border: 1px solid var(--r-hairline) !important; /* User requested: 1px solid light grey */
          padding: 0.5rem 0.75rem !important;
          vertical-align: top !important;
          box-sizing: border-box !important;
          position: relative !important;
          overflow-wrap: normal !important;
          word-break: normal !important;
          hyphens: manual !important;
        }

        /* A link or code in a cell (an address, a path, a hash) may break anywhere, so a long one never pushes the table
           past the page; words stay whole (review of #772). */
        .wysiwyg-editor .ProseMirror :is(td.tiptap-table-cell, th.tiptap-table-header) :is(a, code) {
          overflow-wrap: anywhere !important;
        }

        /* A column's alignment as the file writes it (\`:---:\`, \`---:\`), shown as it reads. */
        .wysiwyg-editor .ProseMirror td.tiptap-table-cell[data-md-align="center"],
        .wysiwyg-editor .ProseMirror th.tiptap-table-header[data-md-align="center"] {
          text-align: center !important;
        }
        .wysiwyg-editor .ProseMirror td.tiptap-table-cell[data-md-align="right"],
        .wysiwyg-editor .ProseMirror th.tiptap-table-header[data-md-align="right"] {
          text-align: right !important;
        }

        /* Header cells */
        .wysiwyg-editor .ProseMirror th.tiptap-table-header {
          font-weight: 600 !important;
          text-align: left !important;
          background-color: var(--r-surface-muted) !important;
          color: var(--r-ink-strong) !important;
        }

        /* Row hover effect */
        .wysiwyg-editor .ProseMirror tr.tiptap-table-row:hover td,
        .wysiwyg-editor .ProseMirror tr.tiptap-table-row:hover th {
          background-color: var(--r-accent-soft) !important;
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
          background: rgba(67, 56, 202, 0.18) !important;
          pointer-events: none !important;
        }

        /* Column resize handle */
        .wysiwyg-editor .ProseMirror table.tiptap-table-node .column-resize-handle {
          position: absolute !important;
          right: -2px !important;
          top: 0 !important;
          bottom: 0 !important;
          width: 4px !important;
          background-color: var(--r-accent) !important;
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
          color: var(--r-ink-faint);
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

  // No selection - return full document HTML. An equation opened by a click
  // is the cursor's place, not a selection (Sprint 138).
  if (empty || isEquationNodeSelection(editor.state.selection)) {
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

/**
 * Experience 49: Comment on a chosen picture: a margin note just before the picture's block, through the editor's one
 * door for comments (`startComment`), so it reads and saves as every other comment does.
 */
function commentOnPicture(editor: TipTapEditor, pos: number): void {
  // A note is placed at a caret, never over a selection: the picture's selection collapses beside it first.
  const { tr, top } = caretBeforePicture(editor.state, pos)
  editor.view.dispatch(tr)
  startComment(editor, (tr, id) => {
    const type = tr.doc.type.schema.nodes.commentNode
    if (type) tr.insert(tr.mapping.map(top), type.create({ id, note: '', agentAlias: null }))
  })
}

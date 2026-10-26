/**
 * Sprint 138 (#481, R3–R6): how an equation looks and is edited in the
 * editor, as experience 38 draws it (ritemark-dev
 * product/design/experience/experiences/math/, README "For the build").
 *
 *  - Rest: typeset with KaTeX, inline in the line or centred as a block.
 *  - Hover: the pointer and a surface-soft fill. Selected with the keyboard:
 *    the 2 px focus ring. A click, or Enter while selected, opens it.
 *  - Inline, open: the LaTeX in place in the code style between faint
 *    delimiters, and the result in a bubble just under it.
 *  - A block, open: a field the text's width ("Equation · LaTeX", "Esc to
 *    finish"), the LaTeX, and under a hairline the result as you type.
 *  - A typo: the source in the code style with a small amber mark whose
 *    tooltip says what is wrong, in one sentence.
 *  - Leaving writes the change as one undo step; leaving it empty removes it.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { Icon } from '../../components/ui/Icon'
import { Tooltip } from '../../components/ui/tooltip'
import { mathErrorSentence, sentenceText, type SentencePart } from './mathErrors'
import type { MathEditingStorage } from './mathNodes'
import {
  mathAssetsStatus,
  onMathAssetsChange,
  prepareMath,
  typesetToString,
  type MathAssetsStatus,
} from './mathRender'
import { CLOSING_DELIMITER, isDisplayDelimiter, normalizeInlineLatex, type MathDelimiter } from './mathSyntax'
import './math.css'

/** The transaction meta that asks the equation at a position to open (Enter on a selected equation). */
export const OPEN_MATH_META = 'ritemarkMathOpen'

function useMathAssets(): MathAssetsStatus {
  const [status, setStatus] = useState<MathAssetsStatus>(mathAssetsStatus())
  useEffect(() => {
    const off = onMathAssetsChange(() => setStatus(mathAssetsStatus()))
    void prepareMath().then(() => setStatus(mathAssetsStatus()))
    return off
  }, [])
  return status
}

type Typeset = { html: string; error: null } | { html: null; error: SentencePart[] }

/** KaTeX's markup for `latex`, or the sentence that says why it cannot be typeset. */
function useTypeset(latex: string, displayMode: boolean, status: MathAssetsStatus): Typeset | null {
  return useMemo(() => {
    if (status !== 'ready') return null
    try {
      return { html: typesetToString(latex, { displayMode }), error: null }
    } catch (error) {
      return { html: null, error: mathErrorSentence(latex, error) }
    }
  }, [latex, displayMode, status])
}

function Sentence({ parts }: { parts: SentencePart[] }) {
  return (
    <>
      {parts.map((part, index) => ('code' in part
        ? <code key={index} className="rm-math-sentence-code">{part.code}</code>
        : <React.Fragment key={index}>{part.text}</React.Fragment>))}
    </>
  )
}

/** The amber mark on an equation Ritemark can't typeset, with its sentence in a tooltip. */
function ErrorMark({ parts, size }: { parts: SentencePart[]; size: 'inline' | 'block' }) {
  return (
    <Tooltip label={<Sentence parts={parts} />} side="top" className={`rm-math-mark rm-math-mark-${size}`}>
      <span role="img" aria-label={sentenceText(parts)} className="rm-math-mark-glyph">
        <Icon name="warning" size={size === 'block' ? 14 : 12} tone="inherit" />
      </span>
    </Tooltip>
  )
}

/** Run `open` when Enter asks this equation to open, or when it was just made to be edited. */
function useOpenRequests(props: NodeViewProps, storageKey: 'mathInline' | 'mathBlock', open: () => void) {
  const { editor, getPos } = props
  const openRef = useRef(open)
  openRef.current = open
  useEffect(() => {
    const storage = editor.storage[storageKey] as MathEditingStorage | undefined
    if (storage && storage.openAt !== null && storage.openAt === getPos()) {
      storage.openAt = null
      openRef.current()
    }
    const onTransaction = ({ transaction }: { transaction: { getMeta(key: string): unknown } }) => {
      const at = transaction.getMeta(OPEN_MATH_META)
      if (typeof at === 'number' && at === getPos()) openRef.current()
    }
    editor.on('transaction', onTransaction)
    return () => {
      editor.off('transaction', onTransaction)
    }
  }, [editor, getPos, storageKey])
}

type Leave = 'after' | 'before' | 'select' | 'stay'

// ---------------------------------------------------------------------------
// Inline
// ---------------------------------------------------------------------------

export function MathInlineView(props: NodeViewProps) {
  const { node, editor, getPos, selected } = props
  const latex = String(node.attrs.latex ?? '')
  const delimiter = (node.attrs.delimiter ?? '$') as MathDelimiter
  const display = isDisplayDelimiter(delimiter)
  const status = useMathAssets()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(latex)
  const inputRef = useRef<HTMLInputElement>(null)
  const committing = useRef(false)

  const rest = useTypeset(latex, display, status)
  const preview = useTypeset(draft, display, editing ? status : 'idle')

  const open = useCallback(() => {
    if (!editor.isEditable) return
    setDraft(latex)
    setEditing(true)
  }, [editor, latex])

  useOpenRequests(props, 'mathInline', open)

  useLayoutEffect(() => {
    if (!editing || !inputRef.current) return
    inputRef.current.focus()
    const end = inputRef.current.value.length
    inputRef.current.setSelectionRange(end, end)
  }, [editing])

  const commit = useCallback((leave: Leave) => {
    if (committing.current) return
    committing.current = true
    const pos = getPos()
    const next = normalizeInlineLatex(draft, delimiter)
    const { state, view } = editor
    const current = typeof pos === 'number' ? state.doc.nodeAt(pos) : null
    if (current && current.type === node.type) {
      let tr = state.tr
      if (!next.trim()) {
        tr = tr.delete(pos, pos + current.nodeSize)
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))))
      } else {
        if (next !== current.attrs.latex) tr = tr.setNodeMarkup(pos, undefined, { ...current.attrs, latex: next })
        if (leave === 'after') tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos + current.nodeSize)))
        if (leave === 'before') tr = tr.setSelection(TextSelection.near(tr.doc.resolve(pos), -1))
      }
      if (tr.docChanged || tr.selectionSet) view.dispatch(tr)
    }
    setEditing(false)
    committing.current = false
    if (leave !== 'stay') view.focus()
  }, [draft, delimiter, editor, getPos, node.type])

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0
    if (event.key === 'Escape' || event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) {
      event.preventDefault()
      commit('after')
    } else if (event.key === 'Tab' && event.shiftKey) {
      event.preventDefault()
      commit('before')
    } else if (event.key === 'ArrowRight' && atEnd) {
      event.preventDefault()
      commit('after')
    } else if (event.key === 'ArrowLeft' && atStart) {
      event.preventDefault()
      commit('before')
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      // Save while open: the edit goes into the document first, the save follows.
      commit('stay')
    }
  }

  const close = CLOSING_DELIMITER[delimiter]
  const classes = ['rm-math-inline']
  if (display) classes.push('rm-math-inline-display')
  if (selected && !editing) classes.push('is-selected')

  let body: React.ReactNode
  if (editing) {
    classes.push('is-open')
    body = (
      <>
        <span className="rm-math-open-box">
          <span className="rm-math-delimiter" aria-hidden="true">{delimiter}</span>
          <input
            ref={inputRef}
            className="rm-math-input"
            value={draft}
            spellCheck={false}
            autoComplete="off"
            aria-label="Equation, LaTeX"
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => commit('stay')}
          />
          <span className="rm-math-delimiter" aria-hidden="true">{close}</span>
        </span>
        <span className="rm-math-bubble" contentEditable={false} aria-live="polite">
          {preview?.html
            ? <span className="rm-math-typeset" dangerouslySetInnerHTML={{ __html: preview.html }} />
            : preview?.error
              ? <span className="rm-math-bubble-error"><Sentence parts={preview.error} /></span>
              : <span className="rm-math-bubble-error">{draft.trim() ? '' : 'The equation shows here as you type.'}</span>}
        </span>
      </>
    )
  } else if (status === 'unavailable' || status === 'idle' || status === 'loading') {
    // Never unstyled glyphs: the source until KaTeX's stylesheet is here (or for good, without it).
    classes.push(status === 'unavailable' ? 'is-source' : 'is-loading')
    body = <code className="rm-math-source">{`${delimiter}${latex}${close}`}</code>
  } else if (rest?.error) {
    classes.push('is-error')
    body = (
      <>
        <code className="rm-math-source">{latex}</code>
        <ErrorMark parts={rest.error} size="inline" />
      </>
    )
  } else {
    body = <span className="rm-math-typeset" dangerouslySetInnerHTML={{ __html: rest?.html ?? '' }} />
  }

  return (
    <NodeViewWrapper as="span" className={classes.join(' ')} onClick={editing ? undefined : open} data-math-view="inline">
      {body}
    </NodeViewWrapper>
  )
}

// ---------------------------------------------------------------------------
// Block
// ---------------------------------------------------------------------------

/** A block's source as the field shows it: without the line breaks that put it on lines of its own. */
function splitBlockLatex(latex: string, isNew: boolean): { lead: string; shown: string; trail: string } {
  if (isNew) return { lead: '\n', shown: '', trail: '\n' }
  const lead = latex.startsWith('\n') ? '\n' : ''
  const withoutLead = latex.slice(lead.length)
  const trail = withoutLead.endsWith('\n') ? '\n' : ''
  return { lead, shown: withoutLead.slice(0, withoutLead.length - trail.length), trail }
}

export function MathBlockView(props: NodeViewProps) {
  const { node, editor, getPos, selected } = props
  const latex = String(node.attrs.latex ?? '')
  const isNew = latex === ''
  const status = useMathAssets()
  const [editing, setEditing] = useState(false)
  const parts = useMemo(() => splitBlockLatex(latex, isNew), [latex, isNew])
  const [draft, setDraft] = useState(parts.shown)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const committing = useRef(false)
  /** The last result that typeset, shown at 40% while the source is broken. */
  const lastGood = useRef<string | null>(null)

  const rest = useTypeset(latex, true, status)
  const preview = useTypeset(draft, true, editing ? status : 'idle')
  if (preview?.html) lastGood.current = preview.html

  const open = useCallback(() => {
    if (!editor.isEditable) return
    setDraft(parts.shown)
    lastGood.current = null
    setEditing(true)
  }, [editor, parts.shown])

  useOpenRequests(props, 'mathBlock', open)

  useLayoutEffect(() => {
    if (!editing || !fieldRef.current) return
    fieldRef.current.focus()
    const end = fieldRef.current.value.length
    fieldRef.current.setSelectionRange(end, end)
  }, [editing])

  const commit = useCallback((leave: Leave) => {
    if (committing.current) return
    committing.current = true
    const pos = getPos()
    const { state, view } = editor
    const current = typeof pos === 'number' ? state.doc.nodeAt(pos) : null
    if (current && current.type === node.type) {
      let tr = state.tr
      if (!draft.trim()) {
        // Leaving it empty removes it.
        tr = tr.delete(pos, pos + current.nodeSize)
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size))))
      } else {
        const next = draft === parts.shown ? current.attrs.latex : `${parts.lead}${draft}${parts.trail}`
        if (next !== current.attrs.latex) tr = tr.setNodeMarkup(pos, undefined, { ...current.attrs, latex: next })
        if (leave === 'select') tr = tr.setSelection(NodeSelection.create(tr.doc, pos))
      }
      if (tr.docChanged || tr.selectionSet) view.dispatch(tr)
    }
    setEditing(false)
    committing.current = false
    if (leave !== 'stay') view.focus()
  }, [draft, editor, getPos, node.type, parts])

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      commit('select')
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      commit('stay')
    }
  }

  const classes = ['rm-math-block']
  if (selected && !editing) classes.push('is-selected')

  let body: React.ReactNode
  if (editing) {
    classes.push('is-open')
    const broken = !!preview?.error && !!draft.trim()
    body = (
      <div className="rm-math-field">
        <div className="rm-math-field-source">
          <div className="rm-math-field-label" aria-hidden="true">
            <span>Equation · LaTeX</span>
            <span>Esc to finish</span>
          </div>
          <textarea
            ref={fieldRef}
            className="rm-math-textarea"
            value={draft}
            rows={1}
            spellCheck={false}
            autoComplete="off"
            placeholder="For example \frac{a}{b}"
            aria-label="Equation, LaTeX"
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => commit('stay')}
          />
        </div>
        <div className="rm-math-field-result" aria-live="polite">
          {!draft.trim()
            ? <span className="rm-math-field-wait">The equation shows here as you type.</span>
            : broken
              ? (
                <>
                  {lastGood.current
                    ? <div className="rm-math-typeset rm-math-stale" dangerouslySetInnerHTML={{ __html: lastGood.current }} />
                    : null}
                  <div className="rm-math-field-error"><Sentence parts={preview!.error!} /></div>
                </>
              )
              : <div className="rm-math-typeset" dangerouslySetInnerHTML={{ __html: preview?.html ?? '' }} />}
        </div>
      </div>
    )
  } else if (status === 'unavailable' || status === 'idle' || status === 'loading') {
    classes.push(status === 'unavailable' ? 'is-source' : 'is-loading')
    body = <pre className="rm-math-block-source">{`${node.attrs.open ?? '$$'}${latex}${node.attrs.close ?? '$$'}`}</pre>
  } else if (rest?.error) {
    classes.push('is-error')
    body = (
      <div className="rm-math-block-error">
        <span className="rm-math-block-error-source">{latex.trim()}</span>
        <ErrorMark parts={rest.error} size="block" />
      </div>
    )
  } else {
    body = <div className="rm-math-typeset" dangerouslySetInnerHTML={{ __html: rest?.html ?? '' }} />
  }

  return (
    <NodeViewWrapper as="div" className={classes.join(' ')} onClick={editing ? undefined : open} data-math-view="block">
      {body}
    </NodeViewWrapper>
  )
}

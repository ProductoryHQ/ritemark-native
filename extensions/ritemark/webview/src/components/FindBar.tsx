import { useState, useEffect, useCallback, useRef } from 'react'
import { matchCountLabel } from '../utils/textSearch'
import { FindBarShell } from './FindBarShell'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { searchPluginKey } from '../extensions/SearchExtension'
import { landingMove, type FindRequest } from '../utils/findRequest'

interface FindBarProps {
  editor: TipTapEditor
  onClose: () => void
  /** Sprint 148 (R9): opened from a search result, with its words and the match to land on. */
  request?: FindRequest | null
}

export function FindBar({ editor, onClose, request = null }: FindBarProps) {
  const [query, setQuery] = useState(request?.text ?? '')
  // The match a search result asked for, until the editor has matches to land on (its text may still be loading).
  const landing = useRef<FindRequest | null>(request)
  const [autoFocus] = useState(request === null)
  // The last request landed: the scroll below runs again for each one.
  const [landedId, setLandedId] = useState<number | null>(null)

  const [matchCount, setMatchCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(-1)
  // FindBarShell focuses its own input when it opens (not when a search result opened it).

  // A result opened (or opened again) this document: its words, and its match. Searching the words again lands
  // even when they are already the query.
  useEffect(() => {
    if (!request) return
    landing.current = request
    setQuery(request.text)
    editor.commands.setSearchTerm(request.text)
  }, [request, editor])

  // Push query changes into the editor plugin
  useEffect(() => {
    editor.commands.setSearchTerm(query)
  }, [query, editor])

  // Pull plugin state (match count + active index) back into UI state on every transaction
  useEffect(() => {
    const sync = () => {
      const state = searchPluginKey.getState(editor.state)
      if (state) {
        setMatchCount(state.results.length)
        setActiveIndex(state.activeIndex)
        const wanted = landing.current
        const step = landingMove(wanted, state.searchTerm, state.results.length, state.activeIndex)
        if (wanted && step) {
          landing.current = null
          // Scrolls to it even when it is current already (a repeat result after the person scrolled away).
          setLandedId(wanted.id)
          // After this transaction: a find-bar move, no document change.
          if (step.move) queueMicrotask(() => {
            if (!editor.isDestroyed) editor.commands.goToSearchResult(step.index)
          })
        }
      }
    }
    sync()
    editor.on('transaction', sync)
    return () => {
      editor.off('transaction', sync)
    }
  }, [editor])

  // Scroll the active match into view
  useEffect(() => {
    if (activeIndex < 0 || matchCount === 0) return
    const state = searchPluginKey.getState(editor.state)
    const match = state?.results[activeIndex]
    if (!match) return

    try {
      const coords = editor.view.coordsAtPos(match.from)
      const scrollContainer = editor.view.dom.closest('.overflow-y-auto') as HTMLElement | null
      if (scrollContainer) {
        const containerRect = scrollContainer.getBoundingClientRect()
        const targetTop = coords.top - containerRect.top + scrollContainer.scrollTop - 100
        scrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' })
      }
    } catch {
      // position no longer in viewport-resolvable state; ignore
    }
  }, [activeIndex, matchCount, editor, landedId])

  // Clear search state when the find bar unmounts
  useEffect(() => {
    return () => {
      editor.commands.clearSearch()
    }
  }, [editor])

  const goToNext = useCallback(() => {
    editor.commands.nextSearchResult()
  }, [editor])

  const goToPrev = useCallback(() => {
    editor.commands.previousSearchResult()
  }, [editor])

  return (
    <FindBarShell
      query={query}
      onQueryChange={(next) => {
        landing.current = null
        setQuery(next)
      }}
      countLabel={matchCountLabel(activeIndex, matchCount, query)}
      hasMatches={matchCount > 0}
      onNext={goToNext}
      onPrevious={goToPrev}
      onClose={onClose}
      autoFocus={autoFocus}
    />
  )
}

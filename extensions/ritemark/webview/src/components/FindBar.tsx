import { useState, useEffect, useCallback } from 'react'
import { matchCountLabel } from '../utils/textSearch'
import { FindBarShell } from './FindBarShell'
import type { Editor as TipTapEditor } from '@tiptap/react'
import { searchPluginKey } from '../extensions/SearchExtension'

interface FindBarProps {
  editor: TipTapEditor
  onClose: () => void
}

export function FindBar({ editor, onClose }: FindBarProps) {
  const [query, setQuery] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [activeIndex, setActiveIndex] = useState(-1)
  // FindBarShell focuses its own input when it opens.

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
  }, [activeIndex, matchCount, editor])

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
      onQueryChange={setQuery}
      countLabel={matchCountLabel(activeIndex, matchCount, query)}
      hasMatches={matchCount > 0}
      onNext={goToNext}
      onPrevious={goToPrev}
      onClose={onClose}
    />
  )
}

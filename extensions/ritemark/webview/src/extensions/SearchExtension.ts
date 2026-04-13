/**
 * SearchExtension
 *
 * Adds in-document find to TipTap using ProseMirror decorations.
 * Provides commands: setSearchTerm, nextSearchResult, previousSearchResult, clearSearch.
 * Plugin state tracks results + active index and emits decorations that highlight
 * matches without touching the DOM directly. Decorations are rebuilt automatically
 * when the document changes while a search is active.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface SearchResult {
  from: number
  to: number
}

interface SearchPluginState {
  searchTerm: string
  results: SearchResult[]
  activeIndex: number
  decorations: DecorationSet
}

type SearchMeta =
  | { type: 'setSearchTerm'; searchTerm: string }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'clear' }

export const searchPluginKey = new PluginKey<SearchPluginState>('ritemarkSearch')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ritemarkSearch: {
      setSearchTerm: (term: string) => ReturnType
      nextSearchResult: () => ReturnType
      previousSearchResult: () => ReturnType
      clearSearch: () => ReturnType
    }
  }
}

function computeResults(doc: ProseMirrorNode, term: string): SearchResult[] {
  if (!term) return []

  const results: SearchResult[] = []
  const lowerTerm = term.toLowerCase()
  const termLength = lowerTerm.length

  // Search across node boundaries by flattening text per block node.
  // Each block (paragraph, heading, etc.) produces a contiguous text run
  // where formatting boundaries (bold, italic, etc.) don't break matches.
  doc.descendants((node, pos) => {
    if (!node.isBlock || node.childCount === 0) return

    // Only process leaf-level blocks (paragraphs, headings, etc.)
    let hasBlockChild = false
    node.forEach(child => {
      if (child.isBlock) hasBlockChild = true
    })
    if (hasBlockChild) return

    // Build flattened text + position map for this block
    let flatText = ''
    const posMap: number[] = [] // flatText index → doc position

    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        const docPos = pos + 1 + offset // +1 for block node open tag
        for (let i = 0; i < child.text.length; i++) {
          posMap.push(docPos + i)
        }
        flatText += child.text
      }
    })

    const lowerFlat = flatText.toLowerCase()
    let index = 0
    while ((index = lowerFlat.indexOf(lowerTerm, index)) !== -1) {
      results.push({ from: posMap[index], to: posMap[index + termLength - 1] + 1 })
      index += termLength
    }
  })

  return results
}

function buildDecorationSet(
  doc: ProseMirrorNode,
  results: SearchResult[],
  activeIndex: number
): DecorationSet {
  if (results.length === 0) return DecorationSet.empty

  const decorations = results.map((match, i) =>
    Decoration.inline(match.from, match.to, {
      class: i === activeIndex ? 'find-highlight-active' : 'find-highlight',
    })
  )
  return DecorationSet.create(doc, decorations)
}

function ensureGlobalStyles() {
  if (typeof document === 'undefined') return
  if (document.getElementById('ritemark-search-styles')) return
  const style = document.createElement('style')
  style.id = 'ritemark-search-styles'
  style.textContent = `
    .find-highlight {
      background: rgba(255, 200, 0, 0.25);
      border-radius: 2px;
    }
    .find-highlight-active {
      background: rgba(255, 180, 0, 0.55);
      border-radius: 2px;
    }
  `
  document.head.appendChild(style)
}

export const SearchExtension = Extension.create({
  name: 'ritemarkSearch',

  onCreate() {
    ensureGlobalStyles()
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchPluginState>({
        key: searchPluginKey,
        state: {
          init: () => ({
            searchTerm: '',
            results: [],
            activeIndex: -1,
            decorations: DecorationSet.empty,
          }),
          apply: (tr, prev, _oldState, newState) => {
            const meta = tr.getMeta(searchPluginKey) as SearchMeta | undefined

            if (meta) {
              if (meta.type === 'setSearchTerm') {
                const term = meta.searchTerm
                const results = computeResults(newState.doc, term)
                const activeIndex = results.length > 0 ? 0 : -1
                return {
                  searchTerm: term,
                  results,
                  activeIndex,
                  decorations: buildDecorationSet(newState.doc, results, activeIndex),
                }
              }

              if (meta.type === 'next') {
                if (prev.results.length === 0) return prev
                const activeIndex = (prev.activeIndex + 1) % prev.results.length
                return {
                  ...prev,
                  activeIndex,
                  decorations: buildDecorationSet(newState.doc, prev.results, activeIndex),
                }
              }

              if (meta.type === 'prev') {
                if (prev.results.length === 0) return prev
                const activeIndex =
                  (prev.activeIndex - 1 + prev.results.length) % prev.results.length
                return {
                  ...prev,
                  activeIndex,
                  decorations: buildDecorationSet(newState.doc, prev.results, activeIndex),
                }
              }

              if (meta.type === 'clear') {
                return {
                  searchTerm: '',
                  results: [],
                  activeIndex: -1,
                  decorations: DecorationSet.empty,
                }
              }
            }

            // Rebuild on document change while search is active
            if (tr.docChanged && prev.searchTerm) {
              const results = computeResults(newState.doc, prev.searchTerm)
              const activeIndex =
                results.length > 0
                  ? Math.min(Math.max(prev.activeIndex, 0), results.length - 1)
                  : -1
              return {
                searchTerm: prev.searchTerm,
                results,
                activeIndex,
                decorations: buildDecorationSet(newState.doc, results, activeIndex),
              }
            }

            return prev
          },
        },
        props: {
          decorations(state) {
            return searchPluginKey.getState(state)?.decorations ?? DecorationSet.empty
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(searchPluginKey, { type: 'setSearchTerm', searchTerm: term }))
          }
          return true
        },
      nextSearchResult:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchPluginKey, { type: 'next' }))
          return true
        },
      previousSearchResult:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchPluginKey, { type: 'prev' }))
          return true
        },
      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchPluginKey, { type: 'clear' }))
          return true
        },
    }
  },
})

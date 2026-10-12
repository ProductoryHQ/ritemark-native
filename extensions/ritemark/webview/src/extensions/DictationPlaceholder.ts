/**
 * DictationPlaceholder (Sprint 129 R12)
 *
 * Shows dictation's note at the cursor ("🎤 Listening...", "⏳ Processing your
 * recording...") as a ProseMirror widget decoration, never as document text.
 * Ritemark autosaves a second after each edit, so a text placeholder was written
 * into the file, and in "speak, then text" it stayed there for the whole
 * recording (a crash or reload would have left it for good).
 *
 * The position follows edits. Text inserted exactly at it pushes it along, so
 * dictated words land in front of the note while dictation goes on.
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

interface PlaceholderState {
  pos: number | null
  text: string | null
}

export const dictationPlaceholderKey = new PluginKey<PlaceholderState>('ritemarkDictationPlaceholder')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dictationPlaceholder: {
      /** Show `text` where the note already is, or at the cursor. */
      showDictationPlaceholder: (text: string) => ReturnType
      clearDictationPlaceholder: () => ReturnType
    }
  }
}

/** Where the note is, or null when none is shown. */
export function dictationPlaceholderPos(state: EditorState): number | null {
  return dictationPlaceholderKey.getState(state)?.pos ?? null
}

export function dictationPlaceholderPlugin(): Plugin<PlaceholderState> {
  return new Plugin<PlaceholderState>({
    key: dictationPlaceholderKey,
    state: {
      init: () => ({ pos: null, text: null }),
      apply(tr, value) {
        const meta = tr.getMeta(dictationPlaceholderKey) as PlaceholderState | undefined
        if (meta) return meta
        if (value.pos === null || !tr.docChanged) return value
        // assoc 1: an insertion at the note's position goes in front of it
        return { ...value, pos: tr.mapping.map(value.pos, 1) }
      },
    },
    props: {
      decorations(state) {
        const { pos, text } = dictationPlaceholderKey.getState(state) ?? { pos: null, text: null }
        if (pos === null || !text) return null
        const widget = Decoration.widget(pos, () => {
          const span = document.createElement('span')
          span.className = 'dictation-placeholder'
          span.contentEditable = 'false'
          span.style.color = 'var(--vscode-descriptionForeground, #888)'
          span.style.fontStyle = 'italic'
          span.style.userSelect = 'none'
          span.textContent = text
          return span
        }, { side: 1, key: text })
        return DecorationSet.create(state.doc, [widget])
      },
    },
  })
}

export const DictationPlaceholder = Extension.create({
  name: 'dictationPlaceholder',

  addCommands() {
    return {
      showDictationPlaceholder: (text: string) => ({ state, tr, dispatch }) => {
        if (dispatch) {
          const pos = dictationPlaceholderPos(state) ?? state.selection.from
          tr.setMeta(dictationPlaceholderKey, { pos, text }).setMeta('addToHistory', false)
        }
        return true
      },
      clearDictationPlaceholder: () => ({ tr, dispatch }) => {
        if (dispatch) {
          tr.setMeta(dictationPlaceholderKey, { pos: null, text: null }).setMeta('addToHistory', false)
        }
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [dictationPlaceholderPlugin()]
  },
})

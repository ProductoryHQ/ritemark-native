import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'
import { FileLinkSuggestionList, type FileLinkSuggestionItem } from './FileLinkSuggestionList'
import { requestWorkspaceFileSearch } from '../lib/workspaceFileSearch'

const fileLinkSuggestionPluginKey = new PluginKey('fileLinkSuggestions')
let latestSearchVersion = 0

export const FileLinkSuggestions = Extension.create({
  name: 'fileLinkSuggestions',

  addOptions() {
    return {
      suggestion: {
        char: '@',
        pluginKey: fileLinkSuggestionPluginKey,
        allow: ({ state, range }: any) => {
          const previousChar = state.doc.textBetween(
            Math.max(0, range.from - 1),
            range.from,
            '\0',
            '\0'
          )
          return previousChar === '' || /[\s([{<]/.test(previousChar)
        },
        command: ({ editor, range, props }: any) => {
          if (props.disabled || !props.relativePath || !props.label) return
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: 'text',
              text: props.label,
              marks: [
                {
                  type: 'link',
                  attrs: { href: props.relativePath },
                },
              ],
            })
            .run()
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: async ({ query }: any): Promise<FileLinkSuggestionItem[]> => {
          const searchVersion = ++latestSearchVersion
          const response = await requestWorkspaceFileSearch(query, 20)
          if (searchVersion !== latestSearchVersion) return []
          if (response.unavailableReason) {
            return [{ disabled: true, message: response.unavailableReason }]
          }
          return response.results
        },
        render: () => {
          let component: ReactRenderer | undefined
          let popup: any[] = []

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(FileLinkSuggestionList, {
                props,
                editor: props.editor,
              })

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                theme: 'none',
                arrow: false,
                offset: [0, 8],
              })
            },
            onUpdate(props: any) {
              component?.updateProps(props)

              if (popup[0]) {
                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                })
              }
            },
            onKeyDown(props: any) {
              if (props.event.key === 'Escape') {
                if (popup[0]) {
                  popup[0].hide()
                }
                return true
              }

              return component?.ref?.onKeyDown?.(props) || false
            },
            onExit() {
              if (popup[0]) {
                popup[0].destroy()
              }
              component?.destroy()
            },
          }
        },
      }),
    ]
  },
})

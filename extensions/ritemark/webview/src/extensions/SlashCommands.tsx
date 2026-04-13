import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'
import { CommandsList } from './CommandsList'
import { blockItems, executeSlashCommand, type BlockItemDef } from './blockItems'

export type { BlockItemDef as Command }

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          executeSlashCommand(editor, range, props)
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: any) => {
          return blockItems.filter((item) =>
            item.title.toLowerCase().startsWith(query.toLowerCase())
          )
        },
        render: () => {
          let component: any
          let popup: any[] = []

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(CommandsList, {
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

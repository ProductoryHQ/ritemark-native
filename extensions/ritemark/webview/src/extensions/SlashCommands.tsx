import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'
import type { ComponentType } from 'react'
import { CommandsList } from './CommandsList'
import { Heading1, Heading2, Heading3, List, ListOrdered, Code, Table, Image } from 'lucide-react'

export interface Command {
  title: string
  description: string
  icon: ComponentType<{ size?: number }>
  command: ({ editor, range }: any) => void
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range })
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
          const commands: Command[] = [
            {
              title: 'Heading 1',
              description: 'Large heading',
              icon: Heading1,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .setNode('heading', { level: 1 })
                  .run()
              },
            },
            {
              title: 'Heading 2',
              description: 'Medium heading',
              icon: Heading2,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .setNode('heading', { level: 2 })
                  .run()
              },
            },
            {
              title: 'Heading 3',
              description: 'Small heading',
              icon: Heading3,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .setNode('heading', { level: 3 })
                  .run()
              },
            },
            {
              title: 'Bullet List',
              description: 'Create a bulleted list',
              icon: List,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleBulletList()
                  .run()
              },
            },
            {
              title: 'Numbered List',
              description: 'Create a numbered list',
              icon: ListOrdered,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleOrderedList()
                  .run()
              },
            },
            {
              title: 'Code Block',
              description: 'Insert a code block',
              icon: Code,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .setCodeBlock()
                  .run()
              },
            },
            {
              title: 'Table',
              description: 'Insert a 3x3 table',
              icon: Table,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                  .run()
              },
            },
            {
              title: 'Image',
              description: 'Insert an image (coming soon)',
              icon: Image,
              command: ({ editor, range }: any) => {
                editor.chain().focus().deleteRange(range).run()
                // TODO: Implement local image handling for VS Code (future sprint)
                console.log('Image insertion not yet supported in VS Code extension')
                // Future: Send to VS Code extension for local file selection
              },
            },
          ]

          return commands.filter((command) =>
            command.title.toLowerCase().startsWith(query.toLowerCase())
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

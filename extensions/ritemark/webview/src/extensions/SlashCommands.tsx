import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'
import type { ComponentType } from 'react'
import { CommandsList } from './CommandsList'
import { Heading1, Heading2, Heading3, List, ListOrdered, Code, Table, Image, CheckSquare, Quote } from 'lucide-react'
import { sendToExtension, emitInternalEvent } from '../bridge'

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
              title: 'Task List',
              description: 'Create a checklist',
              icon: CheckSquare,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleTaskList()
                  .run()
              },
            },
            {
              title: 'Quote',
              description: 'Insert a blockquote',
              icon: Quote,
              command: ({ editor, range }: any) => {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .toggleBlockquote()
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
              description: 'Insert an image from file',
              icon: Image,
              command: ({ editor, range }: any) => {
                // Save cursor position BEFORE async file picker opens
                const insertPos = range.from
                editor.chain().focus().deleteRange(range).run()
                // Tell Editor.tsx where to insert the image when it arrives
                emitInternalEvent('image:pending-position', insertPos)
                // Request file selection from VS Code extension
                sendToExtension('selectImageFile')
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

import { Extension, type Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import type { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import tippy from 'tippy.js'
import { CommandsList } from './CommandsList'
import { executeSlashCommand, filterSlashItems, slashItemsFor, type BlockItemDef } from './blockItems'
import { canHoldTabs } from './tabs/tabsCommands'

export type { BlockItemDef as Command }

export interface SlashCommandsOptions {
  suggestion: Record<string, unknown>
  /**
   * Sprint 161 (PR 3): the items for this editor, in their order; the Text editor's (`slashItemsFor`) when not given.
   * The slide on the stage passes its own list (frame 22).
   */
  itemsFor: ((editor: Editor) => BlockItemDef[]) | null
  /** Sprint 161 (PR 3): what choosing an item does; `executeSlashCommand` when not given. */
  run: ((editor: Editor, range: { from: number; to: number }, item: BlockItemDef) => void) | null
  /** Sprint 161 (PR 3): the suggestion's own key, so its editor can tell when the menu is open. */
  pluginKey: PluginKey | null
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
      },
      itemsFor: null,
      run: null,
      pluginKey: null,
    }
  },

  addProseMirrorPlugins() {
    const { itemsFor, run, pluginKey } = this.options
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        ...(pluginKey ? { pluginKey } : {}),
        command: ({ editor, range, props }: any) => {
          if (run) run(editor, range, props)
          else executeSlashCommand(editor, range, props)
        },
        items: ({ query, editor }: any) => {
          // A deck's handout has the slide node in its schema (Sprint 157): its Divider starts a new slide.
          // Sprint 163: never Tabs inside another Tabs block or a table cell (the slide's own list says so itself).
          const items = itemsFor ? itemsFor(editor) : slashItemsFor(!!editor?.schema?.nodes?.deckSlide).filter(item => item.nodeType !== 'tabs' || !editor || canHoldTabs(editor.state))
          // Experience 22: by the name's words and the item's hidden ones, name matches first.
          return filterSlashItems(items, query ?? '')
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

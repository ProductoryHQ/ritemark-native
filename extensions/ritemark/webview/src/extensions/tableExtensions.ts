import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * Table extensions bundle for TipTap editor
 * Provides table functionality with GFM markdown support
 *
 * Note: Table.configure() accepts HTMLAttributes directly (not nested)
 * The class 'tiptap-table-node' will be applied to <table> elements
 */

// Extended Table that ensures first row is always header
const TableWithHeader = Table.extend({
  addProseMirrorPlugins() {
    const plugins = this.parent?.() || []

    // Add plugin to auto-convert first row to headers

    const ensureHeaderRowPlugin = new Plugin({
      key: new PluginKey('ensureHeaderRow'),
      appendTransaction: (transactions, _oldState, newState) => {
        const docChanged = transactions.some(tr => tr.docChanged)
        if (!docChanged) return null

        const tr = newState.tr
        let modified = false

        // Find all tables in document
        newState.doc.descendants((node, pos) => {
          if (node.type.name === 'table') {
            const firstRow = node.firstChild

            if (firstRow && firstRow.type.name === 'tableRow') {
              // Check if first row has any regular cells (not headers)
              let hasNonHeaderCell = false
              firstRow.forEach(cell => {
                if (cell.type.name === 'tableCell') {
                  hasNonHeaderCell = true
                }
              })

              // Convert all cells in first row to headers
              if (hasNonHeaderCell) {
                firstRow.forEach((cell, offset) => {
                  if (cell.type.name === 'tableCell') {
                    const cellPos = pos + 1 + offset + 1 // table + row + cell offset
                    const headerType = newState.schema.nodes.tableHeader

                    if (headerType) {
                      tr.setNodeMarkup(cellPos, headerType, cell.attrs, cell.marks)
                      modified = true
                    }
                  }
                })
              }
            }
          }
        })

        return modified ? tr : null
      }
    })

    return [...plugins, ensureHeaderRowPlugin]
  }
})

export const tableExtensions = [
  TableWithHeader.configure({
    resizable: false, // CRITICAL: resizable: true breaks HTMLAttributes (TipTap bug #1766, #6176)
    HTMLAttributes: {
      class: 'tiptap-table-node',
    },
  }),
  TableRow.configure({
    HTMLAttributes: {
      class: 'tiptap-table-row',
    },
  }),
  TableCell.configure({
    HTMLAttributes: {
      class: 'tiptap-table-cell',
    },
  }),
  TableHeader.configure({
    HTMLAttributes: {
      class: 'tiptap-table-header',
    },
  }),
]

/**
 * Shared block item definitions for slash commands and block menu.
 * Single source of truth for all insertable block types.
 */

import type { PhosphorIconName } from '../components/ui/Icon'
import type { Transaction } from '@tiptap/pm/state'
import { sendToExtension, emitInternalEvent } from '../bridge'
import { insertTabsBlock } from './tabs/tabsCommands'

export interface BlockItemDef {
  title: string
  description: string
  icon: PhosphorIconName
  nodeType: string
  attrs?: Record<string, unknown>
  /** Sprint 161 (PR 3): the menu's group heading this item stands under (the slide's / menu, frame 22). */
  group?: string
  /** Sprint 161 (PR 3): the Markdown shortcut shown at the item's right (`#`, `1.`, `***`). */
  shortcut?: string
  /**
   * Hidden search words (experience 22, Jarmo 18 November): typing one after / finds the item, as in Gamma. Never shown.
   * English and Estonian, since people write both; a word may be a phrase ("two columns").
   */
  keywords?: string[]
}

/** Hidden words of the items both menus have, kept once so the two menus find the same (experience 22). */
export const PICTURE_KEYWORDS = ['image', 'img', 'photo', 'pic', 'screenshot', 'pilt', 'foto']
export const BULLET_LIST_KEYWORDS = ['list', 'bullets', 'ul', 'loend', 'täpploend']
export const NUMBERED_LIST_KEYWORDS = ['list', 'numbers', 'ol', 'loend', 'nummerdatud']
export const TABLE_KEYWORDS = ['grid', 'tabel']
/** Sprint 163: the Tabs block's (decks README "Tabs in the editor"). */
export const TABS_KEYWORDS = ['tab', 'tabs', 'tabset', 'sakid', 'sakk', 'vahelehed']
/** Sprint 163 PR 1: Code Block's words, shared with the slide's Code block (both / menus find it by them). */
export const CODE_BLOCK_KEYWORDS = ['code', 'snippet', 'kood']

export const blockItems: BlockItemDef[] = [
  { title: 'Text', description: 'Plain text paragraph', icon: 'paragraph', nodeType: 'paragraph', keywords: ['paragraph', 'tekst'] },
  { title: 'Heading 1', description: 'Large heading', icon: 'text-h-one', nodeType: 'heading', attrs: { level: 1 }, keywords: ['h1', 'title', 'pealkiri'] },
  { title: 'Heading 2', description: 'Medium heading', icon: 'text-h-two', nodeType: 'heading', attrs: { level: 2 }, keywords: ['h2', 'title', 'pealkiri'] },
  { title: 'Heading 3', description: 'Small heading', icon: 'text-h-three', nodeType: 'heading', attrs: { level: 3 }, keywords: ['h3', 'title', 'pealkiri'] },
  { title: 'Bullet List', description: 'Create a bulleted list', icon: 'list', nodeType: 'bulletList', keywords: BULLET_LIST_KEYWORDS },
  { title: 'Numbered List', description: 'Create a numbered list', icon: 'list-numbers', nodeType: 'orderedList', keywords: NUMBERED_LIST_KEYWORDS },
  { title: 'Task List', description: 'Create a checklist', icon: 'check-square', nodeType: 'taskList', keywords: ['todo', 'checklist', 'checkbox', 'ülesanded'] },
  { title: 'Quote', description: 'Insert a blockquote', icon: 'quotes', nodeType: 'blockquote', keywords: ['blockquote', 'citation', 'tsitaat'] },
  { title: 'Code Block', description: 'Insert a code block', icon: 'code', nodeType: 'codeBlock', keywords: CODE_BLOCK_KEYWORDS },
  // Sprint 138 (#481): an equation block, open for writing (experience 38, frame 5).
  { title: 'Equation', description: 'Insert an equation', icon: 'function', nodeType: 'mathBlock', keywords: ['math', 'formula', 'latex', 'valem'] },
  { title: 'Table', description: 'Insert a 3×3 table', icon: 'table', nodeType: 'table', keywords: TABLE_KEYWORDS },
  // Sprint 163: tabs, each pane ordinary blocks; the same block as on a slide (decks README "Tabs, one block everywhere").
  { title: 'Tabs', description: 'Insert tabs, each with its own text', icon: 'tabs', nodeType: 'tabs', keywords: TABS_KEYWORDS },
  { title: 'Mermaid Diagram', description: 'Insert a mermaid diagram', icon: 'git-branch', nodeType: 'mermaid', keywords: ['mermaid', 'flowchart'] },
  { title: 'Diagram', description: 'Insert a draw.io diagram', icon: 'graph', nodeType: 'drawio', keywords: ['drawio', 'draw.io', 'chart', 'skeem'] },
  // Experience 22 (18 November): one name for a picture, as experience 49 made it one picture editor; "image" finds it.
  { title: 'Picture', description: 'Insert a picture from a file', icon: 'image', nodeType: 'image', keywords: PICTURE_KEYWORDS },
  { title: 'Divider', description: 'Horizontal rule', icon: 'minus', nodeType: 'horizontalRule', keywords: ['line', 'hr', 'rule', 'separator', 'eraldaja'] },
]

/** Divider's name in a deck's / menu, where the line starts a new slide (experience 46, 16 November). */
export const DECK_DIVIDER_TITLE = 'Divider · a new slide'

/**
 * The / menu's items: the Text editor's own, the same in a deck (Jarmo, 16 November: the traditional slash menu), where
 * only Divider's name says what the line does there. Nothing is added or taken away.
 */
export function slashItemsFor(inDeck: boolean): BlockItemDef[] {
  return inDeck ? deckSlashItems : blockItems
}

/** Built once: in a deck, Divider is also found by "slide" (experience 22). */
const deckSlashItems: BlockItemDef[] = blockItems.map(item => (item.nodeType === 'horizontalRule'
  ? { ...item, title: DECK_DIVIDER_TITLE, keywords: [...(item.keywords ?? []), 'slide', 'new slide'] }
  : item))

/** Lower case, without accents: "Täpploend" and "tapploend" are the same word here. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Letters and digits only: "heading1" finds "Heading 1", "drawio" finds "draw.io". */
const compact = (text: string) => text.replace(/[^\p{L}\p{N}]/gu, '')

/**
 * Does `query` (folded) start the phrase at one of its words, the whole phrase included? Words are what spaces part,
 * so "draw.io" is one word and "/io" doesn't find it. Without spaces or marks, "slidebelow" still finds "slide below".
 */
function startsAWord(phrase: string, query: string): boolean {
  const words = fold(phrase).split(/\s+/).filter(Boolean)
  const wanted = compact(query)
  return words.some((_, at) => {
    const rest = words.slice(at).join(' ')
    return rest.startsWith(query) || (wanted !== '' && compact(rest).startsWith(wanted))
  })
}

/**
 * The / menu's filter (experience 22, Jarmo 18 November): what's typed after / finds an item when it starts any word of
 * its name or of its hidden words, in any case and without accents. Items whose name starts with it come first, then the
 * other matches, each in the menu's own order. An empty query keeps the whole menu.
 */
export function filterSlashItems(items: BlockItemDef[], query: string): BlockItemDef[] {
  const wanted = fold(query.trim())
  if (!wanted) return items
  // Only marks typed: the item's own shortcut finds it ("/#" Title and Heading, "/***" Split slide here, "/-" Bullet list).
  if (!compact(wanted)) return items.filter(item => fold(item.title).startsWith(wanted) || item.shortcut?.startsWith(wanted))
  const first: BlockItemDef[] = []
  const rest: BlockItemDef[] = []
  for (const item of items) {
    const title = fold(item.title)
    if (title.startsWith(wanted) || compact(title).startsWith(compact(wanted))) first.push(item)
    else if ([item.title, ...(item.keywords ?? [])].some(phrase => startsAWord(phrase, wanted))) rest.push(item)
  }
  return [...first, ...rest]
}

/**
 * Execute a block item via slash command (deletes the /query range first).
 */
export function executeSlashCommand(editor: any, range: any, item: BlockItemDef) {
  if (item.nodeType === 'image') {
    const insertPos = range.from
    editor.chain().focus().deleteRange(range).run()
    emitInternalEvent('image:pending-position', insertPos)
    sendToExtension('selectImageFile')
    return
  }

  // Sprint 82 R5: create a .drawio.svg and insert its reference via the
  // same pending-position + imageSaved flow as file images.
  if (item.nodeType === 'drawio') {
    const insertPos = range.from
    editor.chain().focus().deleteRange(range).run()
    emitInternalEvent('image:pending-position', insertPos)
    sendToExtension('insertDiagram')
    return
  }

  // Sprint 163: "Tab 1" and "Tab 2", the first name chosen so typing names it.
  if (item.nodeType === 'tabs') {
    editor.chain().focus().deleteRange(range).command(({ tr }: { tr: Transaction }) => { insertTabsBlock(tr, range.from, editor.view); return true }).run()
    return
  }

  const chain = editor.chain().focus().deleteRange(range)

  switch (item.nodeType) {
    case 'paragraph':
      chain.setNode('paragraph').run()
      break
    case 'heading':
      chain.setNode('heading', item.attrs).run()
      break
    case 'bulletList':
      chain.toggleBulletList().run()
      break
    case 'orderedList':
      chain.toggleOrderedList().run()
      break
    case 'taskList':
      chain.toggleTaskList().run()
      break
    case 'blockquote':
      chain.toggleBlockquote().run()
      break
    case 'codeBlock':
      chain.setCodeBlock().run()
      break
    case 'mermaid':
      chain.setCodeBlock({ language: 'mermaid' }).run()
      break
    case 'mathBlock':
      chain.insertMathBlock().run()
      break
    case 'table':
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
      break
    case 'horizontalRule':
      chain.setHorizontalRule().run()
      break
  }
}

/**
 * Execute a block item via block menu (inserts at a specific position).
 */
export function executeBlockInsert(editor: any, pos: number, item: BlockItemDef) {
  if (item.nodeType === 'image') {
    emitInternalEvent('image:pending-position', pos)
    sendToExtension('selectImageFile')
    return
  }

  // Sprint 82 R5: same flow as the slash command variant above.
  if (item.nodeType === 'drawio') {
    emitInternalEvent('image:pending-position', pos)
    sendToExtension('insertDiagram')
    return
  }

  if (item.nodeType === 'table') {
    editor.chain().focus().setTextSelection(pos).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    return
  }

  // Sprint 163: a new Tabs block at the position, its first name chosen.
  if (item.nodeType === 'tabs') {
    editor.chain().focus().command(({ tr }: { tr: Transaction }) => { insertTabsBlock(tr, pos, editor.view); return true }).run()
    return
  }

  // Sprint 138 (#481): a new empty paragraph at the position becomes the equation block, open.
  if (item.nodeType === 'mathBlock') {
    editor.chain().focus().insertContentAt(pos, { type: 'paragraph' }).setTextSelection(pos + 1).insertMathBlock().run()
    return
  }

  let content: Record<string, unknown>

  switch (item.nodeType) {
    case 'paragraph':
      content = { type: 'paragraph' }
      break
    case 'heading':
      content = { type: 'heading', attrs: item.attrs }
      break
    case 'bulletList':
      content = { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }
      break
    case 'orderedList':
      content = { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] }
      break
    case 'taskList':
      content = { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }] }
      break
    case 'blockquote':
      content = { type: 'blockquote', content: [{ type: 'paragraph' }] }
      break
    case 'codeBlock':
      content = { type: 'codeBlock' }
      break
    case 'mermaid':
      content = { type: 'codeBlock', attrs: { language: 'mermaid' } }
      break
    case 'horizontalRule':
      content = { type: 'horizontalRule' }
      break
    default:
      content = { type: 'paragraph' }
  }

  editor.chain().focus().insertContentAt(pos, content).setTextSelection(pos + 1).run()
}

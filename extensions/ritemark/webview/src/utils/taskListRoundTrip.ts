import type TurndownService from 'turndown'

/**
 * Convert GFM task-list HTML emitted by `marked` to the attributes expected by
 * TipTap's TaskList and TaskItem extensions.
 *
 * GFM permits both tight and loose lists. `marked` emits the checkbox directly
 * under `<li>` for a tight list, but puts it inside the leading `<p>` for a
 * loose list. Ritemark's own Markdown can become loose while users edit nearby
 * blocks, so both shapes are part of the persisted format.
 *
 * TipTap cannot represent task and ordinary items in the same `<ul>` because a
 * taskList accepts taskItem children only. Mixed GFM lists are therefore split
 * into consecutive task-list and bullet-list runs without reordering items.
 */
export function transformTaskListElements(root: Element): void {
  // Deepest lists first so a nested list is already valid before its parent is
  // classified or moved during a mixed-list split.
  const unorderedLists = Array.from(root.getElementsByTagName('ul')).reverse()

  for (const list of unorderedLists) {
    if (!list.parentNode) {
      continue
    }

    const items = directElementChildren(list, 'li')
    const itemKinds = items.map(item => ({ item, checkbox: leadingTaskMarker(item) }))
    const taskCount = itemKinds.filter(({ checkbox }) => checkbox !== null).length
    if (taskCount === 0) {
      continue
    }

    for (const { item, checkbox } of itemKinds) {
      if (!checkbox) continue
      item.setAttribute('data-type', 'taskItem')
      item.setAttribute('data-checked', checkbox.checked ? 'true' : 'false')
      const container = checkbox.node.parentNode
      container?.removeChild(checkbox.node)
      // `marked` separates the checkbox from the item text with whitespace,
      // and with a newline in a loose list (`<input …> \nA`). Once the checkbox
      // is gone that whitespace is a leading text node the editor preserves
      // verbatim, and `white-space: break-spaces` renders the newline, which
      // pushes the item text one line below its checkbox.
      if (container) trimLeadingWhitespace(container)
    }

    if (taskCount === items.length) {
      list.setAttribute('data-type', 'taskList')
      continue
    }

    const parent = list.parentNode
    let currentRun: Element | null = null
    let currentRunIsTask: boolean | null = null

    for (const { item, checkbox } of itemKinds) {
      const isTask = checkbox !== null
      if (!currentRun || currentRunIsTask !== isTask) {
        currentRun = list.cloneNode(false) as Element
        currentRun.removeAttribute('data-type')
        if (isTask) currentRun.setAttribute('data-type', 'taskList')
        parent.insertBefore(currentRun, list)
        currentRunIsTask = isTask
      }
      currentRun.appendChild(item)
    }

    parent.removeChild(list)
  }
}

export function preprocessTaskListHTML(html: string): string {
  const root = document.createElement('div')
  root.innerHTML = html
  transformTaskListElements(root)
  return root.innerHTML
}

/** Add TipTap task node → GFM Markdown rules to a Turndown service. */
export function addTipTapTaskListTurndownRules(service: TurndownService): void {
  service.addRule('tiptapTaskItem', {
    filter(node) {
      return node.nodeName === 'LI' && node.getAttribute('data-type') === 'taskItem'
    },
    replacement(content, node) {
      const element = node as HTMLElement
      const checkbox = element.getAttribute('data-checked') === 'true' ? '[x]' : '[ ]'
      const lines = content.split('\n').filter(line => line.trim())
      const hasNestedTasks = lines.some((line, index) => index > 0 && /^- \[[ x]\]/.test(line))

      if (hasNestedTasks && lines.length > 1) {
        const firstLine = lines[0].trim()
        const nestedLines = lines.slice(1).map(line => `  ${line}`).join('\n')
        return `- ${checkbox} ${firstLine}\n${nestedLines}\n`
      }

      const cleanContent = content.trim().replace(/\n+/g, ' ')
      // A trailing space after the marker does not survive normalisation, and
      // `- [ ]` alone is not a GFM task item, so persist the empty item as the
      // bare marker and let `leadingTaskMarker` read it back.
      return cleanContent ? `- ${checkbox} ${cleanContent}\n` : `- ${checkbox}\n`
    },
  })

  service.addRule('tiptapTaskList', {
    filter(node) {
      return node.nodeName === 'UL' && node.getAttribute('data-type') === 'taskList'
    },
    replacement(content, node) {
      const parent = (node as HTMLElement).parentElement
      const isNested = parent?.getAttribute('data-type') === 'taskItem'
      return isNested ? content : `\n${content}\n`
    },
  })
}

function firstElementChild(node: Node): Element | null {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 1) {
      return child as Element
    }
  }
  return null
}

function directElementChildren(node: Node, name: string): Element[] {
  return Array.from(node.childNodes).filter(
    (child): child is Element => child.nodeType === 1 && child.nodeName.toLowerCase() === name,
  )
}

interface LeadingTaskMarker {
  /** The node that carries the marker: `marked`'s checkbox, or the bare `[ ]` text. */
  node: Node
  checked: boolean
}

/** GFM task marker with nothing after it: the whole text is `[ ]` or `[x]`. */
const BARE_TASK_MARKER = /^\s*\[([ xX])\]\s*$/

function leadingTaskMarker(listItem: Element): LeadingTaskMarker | null {
  const first = firstElementChild(listItem)
  const container = first && first.nodeName.toLowerCase() === 'p' && hasOnlyWhitespaceBefore(listItem, first)
    ? first
    : listItem

  const candidate = firstElementChild(container)
  if (
    candidate?.nodeName.toLowerCase() === 'input' &&
    candidate.getAttribute('type')?.toLowerCase() === 'checkbox' &&
    hasOnlyWhitespaceBefore(container, candidate)
  ) {
    return { node: candidate, checked: candidate.hasAttribute('checked') }
  }

  // An empty task item is persisted as a bare `- [ ]` (see the Turndown rule
  // below). GFM parsers only recognise a marker that is followed by text, so
  // `marked` leaves the bare form as the literal item text `[ ]`. Accept that
  // literal, and only that literal, as an empty task item; `[ ] text` stays
  // what the author wrote.
  const text = leadingTextNode(container)
  const match = text?.nodeValue?.match(BARE_TASK_MARKER)
  if (text && match && !hasContentAfter(container, text)) {
    return { node: text, checked: match[1] !== ' ' }
  }
  return null
}

function leadingTextNode(parent: Node): Node | null {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 8) continue
    if (child.nodeType === 3) {
      if (!child.nodeValue?.trim()) continue
      return child
    }
    return null
  }
  return null
}

function hasContentAfter(parent: Node, target: Node): boolean {
  let seen = false
  for (const child of Array.from(parent.childNodes)) {
    if (child === target) {
      seen = true
      continue
    }
    if (!seen || child.nodeType === 8) continue
    if (child.nodeType === 3 && !child.nodeValue?.trim()) continue
    return true
  }
  return false
}

function trimLeadingWhitespace(parent: Node): void {
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 8) continue
    if (child.nodeType !== 3) return
    const value = child.nodeValue ?? ''
    if (!value.trim()) {
      parent.removeChild(child)
      continue
    }
    child.nodeValue = value.replace(/^\s+/, '')
    return
  }
}

function hasOnlyWhitespaceBefore(parent: Node, target: Node): boolean {
  for (const child of Array.from(parent.childNodes)) {
    if (child === target) return true
    if (child.nodeType === 3 && !child.textContent?.trim()) continue
    if (child.nodeType === 8) continue
    return false
  }
  return false
}

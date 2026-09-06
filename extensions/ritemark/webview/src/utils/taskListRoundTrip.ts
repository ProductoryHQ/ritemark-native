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
    const itemKinds = items.map(item => ({ item, checkbox: leadingTaskCheckbox(item) }))
    const taskCount = itemKinds.filter(({ checkbox }) => checkbox !== null).length
    if (taskCount === 0) {
      continue
    }

    for (const { item, checkbox } of itemKinds) {
      if (!checkbox) continue
      item.setAttribute('data-type', 'taskItem')
      item.setAttribute(
        'data-checked',
        checkbox.hasAttribute('checked') ? 'true' : 'false',
      )
      checkbox.parentNode?.removeChild(checkbox)
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
      return `- ${checkbox} ${cleanContent}\n`
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

function leadingTaskCheckbox(listItem: Element): Element | null {
  const first = firstElementChild(listItem)
  if (!first || !hasOnlyWhitespaceBefore(listItem, first)) return null

  const container = first.nodeName.toLowerCase() === 'p' ? first : listItem
  const candidate = firstElementChild(container)

  return candidate?.nodeName.toLowerCase() === 'input' &&
    candidate.getAttribute('type')?.toLowerCase() === 'checkbox' &&
    hasOnlyWhitespaceBefore(container, candidate)
    ? candidate
    : null
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

/**
 * Home's words (Sprint 134, R4): what waits, when, and the other projects.
 * Pure functions, so the page's sentences are tested without React.
 */

import type { HomeWaitingItem, HomeRecentItem, HomeState } from '../../../../src/projects/protocol'

const DAY = 24 * 60 * 60 * 1000

/** "40 minutes ago", "yesterday", "2 days ago", "last week"; "today" for a file changed today. */
export function whenWords(iso: string, now: number, precision: 'minutes' | 'days'): string {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const today = startOfToday.getTime()
  if (then >= today) {
    if (precision === 'days') return 'today'
    const minutes = Math.max(0, Math.round((now - then) / 60000))
    if (minutes < 1) return 'just now'
    if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
    const hours = Math.round(minutes / 60)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  if (then >= today - DAY) return 'yesterday'
  const days = Math.ceil((today - then) / DAY)
  if (days < 7) return `${days} days ago`
  if (days < 14) return 'last week'
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** The row's sentence, and the muted tag after it. */
export function waitingWords(item: HomeWaitingItem): { text: string; tag: string | null } {
  const ai = item.ai ?? 'The AI'
  if (item.source === 'chat') {
    switch (item.kind) {
      case 'question':
        return item.detail ? { text: `${ai} asks: ${item.detail}`, tag: item.title } : { text: `${ai} asks you something in ${item.title}`, tag: null }
      case 'approval':
        return { text: `${ai} waits for your OK in ${item.title}`, tag: null }
      case 'plan-review':
        return { text: `${ai}’s plan waits for you in ${item.title}`, tag: null }
      default:
        return { text: `${ai} replied in ${item.title}`, tag: null }
    }
  }
  switch (item.kind) {
    case 'needs-you':
      return { text: item.title, tag: 'Waits for you' }
    case 'decision':
      return { text: item.title, tag: 'Your decision' }
    case 'review':
      return { text: item.title, tag: 'Ready to review' }
    default:
      return { text: item.title, tag: 'Didn’t finish' }
  }
}

/** The icon for a waiting row (the Icon component's names). */
export function waitingIcon(item: HomeWaitingItem): 'question' | 'shield-check' | 'list-checks' | 'chat-circle' | 'hand-pointing' | 'eye' | 'warning-circle' {
  switch (item.kind) {
    case 'question':
    case 'decision':
      return 'question'
    case 'approval':
      return 'shield-check'
    case 'plan-review':
      return 'list-checks'
    case 'reply':
      return 'chat-circle'
    case 'needs-you':
      return 'hand-pointing'
    case 'review':
      return 'eye'
    default:
      return 'warning-circle'
  }
}

const SMALL = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

/**
 * The line about the other projects (experience 3 frame 1; experience 29 frame 1):
 * "In your other projects: 1 in Sales proposal Q4, 1 in Research: hybrid work."
 * or, when nothing waits here, "Three things, in your other projects."
 */
export function othersWords(others: HomeState['others'], hereCount: number): string | null {
  if (!others || others.length === 0) return null
  if (hereCount > 0) return `In your other projects: ${others.map((other) => `${other.count} in ${other.name}`).join(', ')}.`
  const total = others.reduce((sum, other) => sum + other.count, 0)
  const number = total < SMALL.length ? SMALL[total] : String(total)
  return `${number} ${total === 1 ? 'thing' : 'things'}, in your other projects.`
}

/** The icon for a file row. */
export function recentIcon(item: HomeRecentItem): 'book-open-text' | 'file-text' | 'file-pdf' | 'file-doc' | 'table' | 'presentation' | 'graph' | 'flow-arrow' | 'file' {
  if (item.about) return 'book-open-text'
  switch (item.kind) {
    case 'markdown': return 'file-text'
    case 'pdf': return 'file-pdf'
    case 'word': return 'file-doc'
    case 'sheet': return 'table'
    case 'slides': return 'presentation'
    case 'drawing': return 'graph'
    case 'flow': return 'flow-arrow'
    default: return 'file'
  }
}

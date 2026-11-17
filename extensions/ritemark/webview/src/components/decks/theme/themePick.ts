/**
 * Sprint 162: picking the deck's theme from the Theme menu is one step of the deck's own Undo.
 *
 * A deck's theme is a line of its front matter (`theme: Slide library/Themes/<Name>.theme.md`), which the view holds as
 * the document's properties, outside the editor's document. So that the pick is undone the way every other change to
 * the deck is (Cmd+Z on the slide, the strip, the handout or the bar, and the bar notice's Undo), the pick is a step in
 * the editor's history that leaves the document as it is and carries the property's value before and after
 * (`DeckPropertyStep`). Undo applies its inverse; the deck view writes whatever value such a step carries
 * (`propertyChangesOf`) to the front matter, so the pick, its Undo and its Redo all reach the file the same way.
 *
 * The transaction is marked `preventUpdate` (its Markdown is unchanged, so there is nothing to publish) and so the
 * deck's own plugins never read it as the person's first edit (no conversion, no drawn headings written).
 */
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { Step, StepMap, StepResult, type Mappable } from '@tiptap/pm/transform'

const STEP_ID = 'ritemarkDeckProperty'
/** The pick's own transaction, so the view can say "This deck uses … now" for it and not for its Undo. */
export const THEME_PICKED = 'ritemarkThemePicked'

/** A front-matter value: whether the key is there, and its value (any JSON value the properties held). */
export interface PropertyValue {
  present: boolean
  value?: unknown
}

/** A property's value as the view holds the properties. */
export function propertyValue(properties: Record<string, unknown>, key: string): PropertyValue {
  return Object.prototype.hasOwnProperty.call(properties, key) ? { present: true, value: properties[key] } : { present: false }
}

/** A step that changes one front-matter property and nothing in the document. */
export class DeckPropertyStep extends Step {
  constructor(readonly key: string, readonly before: PropertyValue, readonly after: PropertyValue) {
    super()
  }

  apply(doc: PMNode): StepResult {
    return StepResult.ok(doc)
  }

  getMap(): StepMap {
    return StepMap.empty
  }

  invert(): Step {
    return new DeckPropertyStep(this.key, this.after, this.before)
  }

  map(_mapping: Mappable): Step {
    return this
  }

  toJSON() {
    return { stepType: STEP_ID, key: this.key, before: this.before, after: this.after }
  }

  static fromJSON(_schema: Schema, json: { key?: unknown; before?: PropertyValue; after?: PropertyValue }): DeckPropertyStep {
    if (typeof json.key !== 'string' || !json.before || !json.after) throw new RangeError('Invalid input for DeckPropertyStep.fromJSON')
    return new DeckPropertyStep(json.key, json.before, json.after)
  }
}

try {
  Step.jsonID(STEP_ID, DeckPropertyStep)
} catch {
  // Registered already (the module loaded twice in one page): the first registration stands.
}

/** The pick: one history step of its own (never joined to typing before or after it) setting `key` from `before` to `after`. */
export function propertyTransaction(state: EditorState, key: string, before: PropertyValue, after: PropertyValue): Transaction {
  const tr = state.tr.step(new DeckPropertyStep(key, before, after))
  return closeHistory(tr).setMeta(THEME_PICKED, true).setMeta('preventUpdate', true)
}

/** The property values a transaction sets, in order (a pick, or its Undo or Redo). */
export function propertyChangesOf(tr: Transaction): Array<{ key: string; to: PropertyValue }> {
  return tr.steps.filter((step): step is DeckPropertyStep => step instanceof DeckPropertyStep).map(step => ({ key: step.key, to: step.after }))
}

/** The properties with those changes made: a value that isn't there takes its key out. */
export function withPropertyChanges<T extends Record<string, unknown>>(properties: T, changes: ReadonlyArray<{ key: string; to: PropertyValue }>): T {
  const next: Record<string, unknown> = { ...properties }
  for (const change of changes) {
    if (change.to.present) next[change.key] = change.to.value
    else delete next[change.key]
  }
  return next as T
}

/**
 * Sprint 120 (#280) — a number is only a list marker up to 99.
 *
 * TipTap's ordered list converts any integer: typing `2026. ` at the start of
 * a paragraph turns a year into a list that starts at 2026, and the prose is
 * gone from the saved file too (it serializes back as a list). The editor
 * cannot see what follows the number, so the only honest signal is the number
 * itself.
 *
 * The bound is LibreOffice Writer's, not one we invented: its autoformat stops
 * at two digits — `SwAutoFormat::GetDigitLevel`, "more than 2 numbers are not
 * an enum anymore". So `1.` … `99.` start a list and `100.`, `2026.` stay
 * prose. A longer list still numbers past 99 once it exists, and any list can
 * be started from the toolbar or the slash menu whatever its first number.
 *
 * Everything else is TipTap's own rule: the `start` attribute, the join
 * predicate, and the keepMarks/keepAttributes variant.
 */

import OrderedList from '@tiptap/extension-ordered-list'
import { wrappingInputRule } from '@tiptap/core'

/** `1. ` … `99. ` at the start of a paragraph. No leading zero, no 3+ digits. */
export const boundedOrderedListInputRegex = /^([1-9]\d?)\.\s$/

const TEXT_STYLE_NAME = 'textStyle'

/** The number the typed marker starts the list at. */
export const listStartFrom = (match: RegExpMatchArray): number => +match[1]

/**
 * TipTap's own join rule, kept as it was: a typed marker merges into the list
 * above only when the numbering actually continues into it.
 */
export const continuesList = (
  match: RegExpMatchArray,
  node: { childCount: number; attrs: Record<string, unknown> },
): boolean => node.childCount + (node.attrs.start as number) === listStartFrom(match)

export const BoundedOrderedList = OrderedList.extend({
  addInputRules() {
    const joinPredicate = continuesList

    if (this.options.keepMarks || this.options.keepAttributes) {
      return [
        wrappingInputRule({
          find: boundedOrderedListInputRegex,
          type: this.type,
          keepMarks: this.options.keepMarks,
          keepAttributes: this.options.keepAttributes,
          getAttributes: (match) => ({ start: listStartFrom(match), ...this.editor.getAttributes(TEXT_STYLE_NAME) }),
          joinPredicate,
          editor: this.editor,
        }),
      ]
    }

    return [
      wrappingInputRule({
        find: boundedOrderedListInputRegex,
        type: this.type,
        getAttributes: (match) => ({ start: listStartFrom(match) }),
        joinPredicate,
      }),
    ]
  },
})

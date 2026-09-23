/**
 * Sprint 122 (#282) — the composer bounds Sprint 117 built, now shared by the
 * comment box and the agent chat composer.
 *
 * What a person loses if this is wrong: the comment box changes size under
 * them (a regression in a surface this sprint did not mean to touch), or the
 * chat composer's ceiling drifts from "8 lines or 40% of the window".
 *
 * Run with `npx tsx webview/src/components/comment/composerBounds.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { composerBounds, rememberComposerHeight, rememberedComposerHeight } from './ResizableComposer'

{
  // --- the comment box keeps the exact bounds it shipped with in Sprint 117
  assert.deepEqual(composerBounds(), {
    min: 'calc(2.90em + 16px)',
    max: 'min(calc(11.60em + 16px), 40vh)',
  })
}

{
  // --- the chat composer: two lines of `leading-relaxed` text plus its
  // 20 px of padding, up to eight lines or 40% of the window
  assert.deepEqual(composerBounds({ minRows: 2, lineHeightEm: 1.625, chromePx: 20 }), {
    min: 'calc(3.25em + 20px)',
    max: 'min(calc(13.00em + 20px), 40vh)',
  })
}

{
  // --- a dragged height is remembered per surface, for this session only
  assert.equal(rememberedComposerHeight('agent-chat'), null, 'nothing remembered before a drag')
  rememberComposerHeight('agent-chat', 180)
  assert.equal(rememberedComposerHeight('agent-chat'), 180)
  assert.equal(rememberedComposerHeight('comment'), null, 'dragging the chat composer does not resize the comment box')
  assert.equal(rememberedComposerHeight(), null, 'and the comment box is still the default surface')
}

console.log('composerBounds.test.ts: all tests passed')

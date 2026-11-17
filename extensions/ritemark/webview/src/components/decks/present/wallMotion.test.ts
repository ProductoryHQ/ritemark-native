/**
 * README items 17 and 19: how one slide becomes the next on the wall.
 *   - The deck's transition from its front matter, and what a choice writes (Fade nothing).
 *   - Reduced motion means None, whatever the deck says, matches or not.
 *   - Which elements match between two slides drawn by the one block renderer: the same title text, the same picture
 *     file (in the flow or beside it), a block of the same type with the same item headings; nothing else.
 *   - A press during a transition or a move jumps it to its end at once and goes on: the step ends once, there and then,
 *     every animation put at its end, and the next step starts from the whole slide.
 * Run with `npx tsx webview/src/components/decks/present/wallMotion.test.ts`.
 */
import { strict as assert } from 'node:assert'
import { createDocument } from '@mixmark-io/domino'
import { blockCanvasMarkup } from '../../../../../src/decks/blocks/slideRenderer'
import { deckTransitionOf } from '../../../../../src/decks/present/presentSession'
import type { SlideData } from '../../../../../src/decks/deckFormat'
import {
  DECK_TRANSITIONS, MOTION_MS, MotionRun, directionOf, matchMotion, motionKeysOf, stepOf, transitionOf, transitionValue,
  type MotionClock, type MotionElement,
} from './wallMotion'
import { playStep } from './playMotion'

// ---- The deck's transition, and the menu's four
{
  assert.deepEqual(DECK_TRANSITIONS.map(entry => entry.label), ['Fade', 'Push', 'Zoom', 'None'])
  for (const value of ['push', 'zoom', 'none', 'fade'] as const) assert.equal(transitionOf(value), value)
  for (const value of [undefined, null, 'Push', 'spin', 3, ''] as unknown[]) assert.equal(transitionOf(value), 'fade', `${String(value)} is Fade`)
  assert.deepEqual(transitionValue('fade'), { present: false }, 'Fade writes nothing')
  assert.deepEqual(transitionValue('push'), { present: true, value: 'push' })
  assert.deepEqual(transitionValue('none'), { present: true, value: 'none' })
  // The host reads the line the same way.
  for (const value of ['push', 'zoom', 'none', 'fade', 'Push', 'spin']) {
    assert.equal(deckTransitionOf(`---\ntransition: ${value}\n---\n\nx\n`), transitionOf(value), `host and wall agree on ${value}`)
  }
  assert.deepEqual(MOTION_MS, { fade: 300, push: 400, zoom: 350, none: 0, move: 400 })
}

// ---- Reduced motion means None, whatever the deck says; a match makes it the smooth move
{
  for (const transition of ['fade', 'push', 'zoom', 'none'] as const) {
    assert.equal(stepOf(transition, true, false), 'none', `${transition} with reduced motion`)
    assert.equal(stepOf(transition, true, true), 'none', `${transition} with reduced motion and a match`)
    assert.equal(stepOf(transition, false, false), transition)
    assert.equal(stepOf(transition, false, true), 'move', 'where elements match, the move takes the place of the transition')
  }
  assert.equal(directionOf(3, 4), 'next')
  assert.equal(directionOf(4, 3), 'back')
  assert.equal(directionOf(2, 9), 'next', 'a go-to forward')
  assert.equal(directionOf(9, 1), 'back', 'Home')
}

// ---- Which elements match
const URL = (path: string) => `https://file+.vscode-resource.vscode-cdn.net/deck/${path}`
function drawn(data: SlideData): MotionElement {
  const html = blockCanvasMarkup(data, { pictureUrl: path => (path.includes('gone') ? null : URL(path)) })
  return createDocument(`<body>${html}</body>`).body as unknown as MotionElement
}
const keys = (data: SlideData) => motionKeysOf(drawn(data)).map(entry => entry.key)
const matches = (a: SlideData, b: SlideData) => matchMotion(motionKeysOf(drawn(a)), motionKeysOf(drawn(b))).map(pair => pair.key)
const BOXES = '::: boxes\n::: box\n### Plan\nWrite it\n:::\n::: box\n### Build\nMake it\n:::\n:::\n'
{
  // A title, by its words.
  assert.deepEqual(keys({ markdown: '# Our agenda\n\nWords.\n' }), ['title:Our agenda#1'])
  assert.deepEqual(matches({ markdown: '# Our agenda\n\nOne.\n' }, { markdown: '## Our   agenda\n\nTwo.\n' }), ['title:Our agenda#1'], 'the same words, at another size')
  assert.deepEqual(matches({ markdown: '# Our agenda\n' }, { markdown: '# Our plan\n' }), [], 'other words: no match')
  assert.deepEqual(matches({ markdown: '# Agenda\n' }, { markdown: '# agenda\n' }), [], 'the same text, as written')
  assert.deepEqual(keys({ markdown: 'Words first.\n\n### Small heading\n' }), [], 'only a heading at the top of the flow is the title')

  // A picture, by its file: in the flow, beside the slide or behind it.
  assert.deepEqual(matches({ markdown: '# A\n\n![Cat](images/cat.png)\n' }, { markdown: '# B\n\n![Another word](images/cat.png)\n' }), [`picture:${URL('images/cat.png')}#1`])
  assert.deepEqual(matches({ markdown: '# A\n\n![Cat](images/cat.png)\n' }, { markdown: '# B\n', image: 'images/cat.png', picture: 'right' }), [`picture:${URL('images/cat.png')}#1`], 'from the flow to beside the slide')
  assert.deepEqual(matches({ markdown: '# A\n', image: 'images/cat.png', picture: 'behind' }, { markdown: '# B\n', image: 'images/dog.png', picture: 'behind' }), [], 'another file')
  assert.deepEqual(keys({ markdown: '# A\n\n![Gone](images/gone.png)\n' }), ['title:A#1'], 'a picture not drawn never matches')
  assert.deepEqual(matches({ markdown: '![Cat](images/cat.png){width=40%}\n' }, { markdown: '![Cat](images/cat.png){width=80% crop=1}\n' }), [`picture:${URL('images/cat.png')}#1`], 'a framed picture is read once, as its frame')

  // A block, by its type and its items' headings.
  assert.deepEqual(matches({ markdown: `# One\n\n${BOXES}` }, { markdown: `# Two\n\n${BOXES.replace('Write it', 'Other words')}` }), ['block:boxes:["Plan","Build"]#1'], 'the same headings, other words under them')
  assert.deepEqual(matches({ markdown: BOXES }, { markdown: BOXES.replace('### Build', '### Ship') }), [], 'another heading')
  assert.deepEqual(matches({ markdown: BOXES }, { markdown: ':::: {.boxes look="steps"}\n::: box\n### Plan\n:::\n::: box\n### Build\n:::\n::::\n' }), ['block:boxes:["Plan","Build"]#1'], 'a look of the same block')
  const COLUMNS = '::: columns\n::: column\n### Plan\nx\n:::\n::: column\n### Build\ny\n:::\n:::\n'
  assert.deepEqual(matches({ markdown: BOXES }, { markdown: COLUMNS }), [], 'another type with the same headings')
  assert.deepEqual(keys({ markdown: COLUMNS }), ['block:columns:["Plan","Build"]#1'])
  assert.deepEqual(keys({ markdown: '::: steps\n1. **Ask** a thing\n2. **Read** it\n:::\n' }), ['block:steps:["Ask","Read"]#1'], 'steps by their bold words, their list read once')
  assert.deepEqual(keys({ markdown: '- **Morning** coffee\n- **Noon** lunch\n' }), ['block:list:["Morning","Noon"]#1'])
  assert.deepEqual(matches({ markdown: '1. Welcome\n2. Tools\n' }, { markdown: '# Agenda\n\n1. Welcome\n2. Tools\n' }), ['block:list:["Welcome","Tools"]#1'], 'a repeated agenda')
  assert.deepEqual(keys({ markdown: '| Day | Room |\n|---|---|\n| Mon | 4 |\n' }), ['block:table:["Day","Room"]#1'])

  // A picture inside a matching box moves with the box, not on its own.
  const withPicture = '::: boxes\n::: box\n### Plan\n![Cat](images/cat.png)\n:::\n:::\n'
  assert.deepEqual(matches({ markdown: withPicture }, { markdown: withPicture.replace('Plan', 'Plan') }), ['block:boxes:["Plan"]#1'])
  // The same picture twice: the first with the first, the second with the second.
  assert.deepEqual(keys({ markdown: '![A](images/cat.png)\n\n![B](images/cat.png)\n' }), [`picture:${URL('images/cat.png')}#1`, `picture:${URL('images/cat.png')}#2`])
  // Everything at once: a title and a picture shared, a block not.
  assert.deepEqual(
    matches({ markdown: `# Harbour\n\n${BOXES}\n![Boat](images/boat.png)\n` }, { markdown: '# Harbour\n\nThe boat came in.\n', image: 'images/boat.png', picture: 'left' }),
    ['title:Harbour#1', `picture:${URL('images/boat.png')}#1`],
  )
}

// ---- A press during a step jumps it to its end at once, and goes on
class FakeClock implements MotionClock {
  now = 0
  private timers = new Map<number, { at: number; run: () => void }>()
  private next = 1
  setTimeout = (run: () => void, ms: number) => { const id = this.next++; this.timers.set(id, { at: this.now + ms, run }); return id }
  clearTimeout = (id: number) => { this.timers.delete(id) }
  advance(ms: number) {
    this.now += ms
    for (const [id, timer] of [...this.timers]) if (timer.at <= this.now) { this.timers.delete(id); timer.run() }
  }
  get pending() { return this.timers.size }
}
{
  const clock = new FakeClock()
  const run = new MotionRun(clock)
  const log: string[] = []
  run.begin(MOTION_MS.push, { finish: () => log.push(`finish push at ${clock.now}`) }, () => log.push(`end push at ${clock.now}`))
  assert.equal(run.running, true)
  clock.advance(150)
  // The press, 150 ms into a 400 ms Push: the push is at its end at once, then the next step begins.
  assert.equal(run.finish(), true, 'a step was running')
  assert.deepEqual(log, ['finish push at 150', 'end push at 150'], 'at its end there and then, not at 400')
  assert.equal(run.running, false)
  assert.equal(clock.pending, 0, 'its timer is gone')
  clock.advance(1000)
  assert.deepEqual(log, ['finish push at 150', 'end push at 150'], 'and it never ends twice')
  assert.equal(run.finish(), false, 'nothing to jump now')

  // A new step while one runs (a press from the presenter view): the running one ends first, at its end.
  log.length = 0
  run.begin(MOTION_MS.move, { finish: () => log.push('finish move') }, () => log.push('end move'))
  clock.advance(100)
  run.begin(MOTION_MS.fade, { finish: () => log.push('finish fade') }, () => log.push('end fade'))
  assert.deepEqual(log, ['finish move', 'end move'])
  clock.advance(MOTION_MS.fade)
  assert.deepEqual(log, ['finish move', 'end move', 'finish fade', 'end fade'], 'a step left alone ends at its time, drawn at its end')

  // None, and reduced motion: a cut, ended at once.
  log.length = 0
  run.begin(MOTION_MS[stepOf('push', true, true)], { finish: () => log.push('finish none') }, () => log.push('end none'))
  assert.deepEqual(log, ['finish none', 'end none'])
  assert.equal(run.running, false)
}

// ---- The drawing: every animation of a step is put at its end by one jump; None hides the slide before at once
{
  const made: Array<{ keyframes: Keyframe[]; options: KeyframeAnimationOptions; finished: number }> = []
  const element = () => ({
    style: {} as Record<string, string>,
    animate(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = { keyframes, options, finished: 0, finish() { this.finished += 1 } }
      made.push(animation)
      return animation as unknown as Animation
    },
  }) as unknown as HTMLElement
  for (const [step, ms] of [['fade', 300], ['push', 400], ['zoom', 350]] as const) {
    made.length = 0
    const drawing = playStep(step, 'next', { leaving: element(), entering: element(), distance: 1440 })
    assert.equal(made.length, 2, `${step}: the slide coming and the slide going`)
    assert.ok(made.every(animation => animation.options.duration === ms), `${step} takes ${ms} ms`)
    drawing.finish()
    drawing.finish()
    assert.ok(made.every(animation => animation.finished === 1), `${step}: one jump puts each at its end, once`)
  }
  made.length = 0
  playStep('push', 'next', { leaving: element(), entering: element(), distance: 1440 })
  assert.deepEqual(made.map(animation => animation.keyframes.map(frame => frame.transform)), [['translateX(1440px)', 'translateX(0)'], ['translateX(0)', 'translateX(-1440px)']], 'on: in from the right, the old one off to the left')
  made.length = 0
  playStep('push', 'back', { leaving: element(), entering: element(), distance: 1440 })
  assert.deepEqual(made.map(animation => animation.keyframes.map(frame => frame.transform)), [['translateX(-1440px)', 'translateX(0)'], ['translateX(0)', 'translateX(1440px)']], 'back: the other way')
  made.length = 0
  playStep('zoom', 'next', { leaving: element(), entering: element(), distance: 1440 })
  assert.deepEqual(made[0].keyframes, [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'scale(1)' }], 'Zoom grows from 96 % as it fades in')
  made.length = 0
  const leaving = element()
  playStep('none', 'next', { leaving, entering: element(), distance: 1440 })
  assert.equal(made.length, 0, 'None draws nothing')
  assert.equal(leaving.style.visibility, 'hidden', 'and the slide before is gone at once')
}

console.log('wallMotion: all tests passed')

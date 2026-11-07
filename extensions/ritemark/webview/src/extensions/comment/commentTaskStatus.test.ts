/**
 * Sprint 155 review, finding 7: the Send surface's caption follows the host.
 * While a Send surface is open, the destination preview is asked again when a
 * projection arrives and when the host says a turn ended, so the caption names
 * the chat the send will pick. With no surface open, nothing is asked.
 *
 * Run: npx tsx webview/src/extensions/comment/commentTaskStatus.test.ts
 */
import assert from 'node:assert/strict'

const posted: Array<{ type?: string }> = []
const target = new EventTarget() as EventTarget & { __vscodeApi?: unknown }
target.__vscodeApi = {
  postMessage: (message: { type?: string }) => { posted.push(message) },
  getState: () => undefined,
  setState: () => undefined,
}
;(globalThis as unknown as { window: unknown }).window = target

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const previews = () => posted.filter((message) => message.type === 'comment-task/destination-preview').length
const host = (data: Record<string, unknown>) => target.dispatchEvent(new MessageEvent('message', { data }))

async function main(): Promise<void> {
  const status = await import('./commentTaskStatus')
  const surface = (status as unknown as { setCommentTaskDestinationSurface?: (active: boolean) => void })
    .setCommentTaskDestinationSurface
  assert.equal(typeof surface, 'function', 'the module tracks whether a Send surface is open')
  surface!(true)
  await tick()
  assert.equal(previews(), 1, 'opening a Send surface asks once')

  host({ type: 'comment-task/projection', documentUri: 'file:///p/a.md', tasks: [] })
  await tick()
  assert.equal(previews(), 2, 'a projection asks again while the surface is open')

  host({ type: 'comment-task/destination-stale' })
  await tick()
  assert.equal(previews(), 3, 'a turn that ended asks again while the surface is open')

  surface!(false)
  host({ type: 'comment-task/projection', documentUri: 'file:///p/a.md', tasks: [] })
  host({ type: 'comment-task/destination-stale' })
  await tick()
  assert.equal(previews(), 3, 'no surface open: nothing is asked')

  console.log('commentTaskStatus: all assertions passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

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
  const { destinationCaption } = await import('../../components/comment/commentTaskCopy')
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

  // Review 2, finding 3: two previews overlap and answer in reverse order.
  // The older answer must not overwrite the newer caption.
  const sent = () => posted.filter((message) => message.type === 'comment-task/destination-preview') as Array<{ requestId?: string }>
  const answer = (requestId: string | undefined, title: string) => host({
    type: 'comment-task/result',
    requestId,
    ok: true,
    operation: 'comment-task/destination-preview',
    data: { runtimeId: 'claude-code', conversationId: `conv-${title}`, title },
  })
  surface!(true)
  host({ type: 'comment-task/destination-stale' })
  await tick()
  const [older, newer] = sent().slice(-2)
  answer(newer.requestId, 'Second')
  answer(older.requestId, 'First')
  await tick()
  assert.equal(status.getCommentTaskDestination()?.title, 'Second', 'the newest request’s caption wins')
  // Live check 8 Nov: the chat's runtime must survive into the store, or the
  // caption can never say that another AI takes over (it was dropped since Sprint 117).
  assert.equal(status.getCommentTaskDestination()?.runtimeId, 'claude-code', 'the preview keeps the chat’s runtime')
  assert.equal(
    destinationCaption(status.getCommentTaskDestination()!.title, { alias: 'codex', conversationRuntimeId: status.getCommentTaskDestination()!.runtimeId }),
    '→ Second · ChatGPT takes over',
    'a comment for another AI says that AI takes over the document’s chat',
  )
  surface!(false)

  console.log('commentTaskStatus: all assertions passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

/**
 * Pictures with ChatGPT (the Experience lead on #800): when a ChatGPT item in an editor opens the AI's sheet on
 * ChatGPT's sign-in card, that card takes one soft accent ring for 1.5 s, so it is found at once. With reduced motion
 * there is no ring (`.rm-signin-attention` in index.css). The card is whichever the sheet shows for ChatGPT: the
 * "Almost there!" sign-in card, ChatGPT's setup view, or the chat's availability notice.
 */
import { useEffect, useState } from 'react'
import { SIGN_IN_ATTENTION_MS, signInAttentionShows, type SheetSignInAi } from '../../../../src/views/agentSidebarProtocol'
import { useAISidebarStore } from './store'

/** The ring's class while this AI's card is to be found, else ''. */
export function useSignInAttention(ai: SheetSignInAi): string {
  const attention = useAISidebarStore((s) => s.signInAttention)
  const since = attention && attention.ai === ai ? attention.since : null
  const [, redraw] = useState(0)
  useEffect(() => {
    if (since === null) return
    const left = SIGN_IN_ATTENTION_MS - (Date.now() - since)
    if (left <= 0) return
    const timer = window.setTimeout(() => redraw((count) => count + 1), left)
    return () => window.clearTimeout(timer)
  }, [since])
  return signInAttentionShows(since, Date.now()) ? 'rm-signin-attention' : ''
}

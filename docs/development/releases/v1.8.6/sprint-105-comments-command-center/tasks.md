# Sprint 105 Tasks — all on branch sprint-105-comments-command-center

- [x] W1 `commentIndex.ts` (shared dedup index + summary + per-agent task prompt) + `commentIndex.test.ts`
- [x] W3 payload/host: `comment:send-to-ai` carries commentIds; host attaches documentPath; `comment:submit` passthrough; queue items carry both
- [x] W2 `CommentsMenuButton` (badge + overview + confirm + bulk dispatch) wired into DocumentHeader via commentsSlot (gated by comment-callouts feature)
- [x] W4 store `commentTasks` registry (queued/running/done/failed + cleared) + `comment:task-status` sidebar→host→editor broadcast + rail status dots/labels + CSS
- [x] Tests: commentIndex, commentRoundTrip regression, promptQueueStore green; test chain updated
- [x] Live validation on demo content: badge 4, overview counts, confirm, 2-agent dispatch, running→done marker dot; screenshots in docs/releases/v1.8.6/screenshots/
- [ ] Jarmo release walk (Gate) — including failed-task dot and busy-runtime comment queueing by hand

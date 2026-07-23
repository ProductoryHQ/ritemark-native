# Parallel Agent Chats — Complete UX Design

**Status:** Design APPROVED by Jarmo 2026-07-21 (all decisions below are final unless marked open).
**Prototype:** [`prototypes/parallel-threads.html`](prototypes/parallel-threads.html) — interactive, pixel-accurate, light + dark.
**Audience:** Sprint 99 implementers (Phase 2 spec/technical-plan derive from this) AND `product-marketer` (source material for help texts, release notes, and user docs when v1.8.5 ships).
**Related:** [`sprint-plan.md`](sprint-plan.md) (scope, phasing, architecture), issues #95, #97, #140 (touched, not resolved).

---

## 1. The feature in one paragraph

Ritemark's AI sidebar currently holds exactly one conversation at a time — starting a new chat destroys the live one, and a second prompt while the agent is busy just queues up. With parallel chats, you can run **several agent conversations at once** — for example Claude reviewing your document while Codex translates a memo and OpenCode drafts an outline — and switch between them instantly. Threads live on a slim **thread rail** on the right edge of the sidebar, exactly like VS Code's terminal panel lists multiple terminals. Each thread keeps its own agent session, its own streaming output, its own approval flow, and its own composer state. Nothing you switch away from stops working.

## 2. Vocabulary (use these words in help texts)

| Term | Meaning | Notes for copy |
|---|---|---|
| **Thread** | One live agent conversation, visible on the rail | User-facing term. Avoid "session" (internal) and "chat tab" (it's not a tab bar). |
| **Thread rail** (or just "the rail") | The vertical icon strip on the right edge of the AI sidebar | One icon per open thread, top-down. |
| **Open thread** | A thread currently on the rail — running, waiting, or idle | The rail is your *working set*. |
| **History** | The permanent archive of ALL conversations, open and closed | Closing a thread never deletes anything. |
| **Close a thread** | Remove it from the rail; conversation stays in History | Not deletion. Frees the live agent session. |
| **Runtime** | The agent engine behind a thread: Claude, Codex, or OpenCode | Each thread is bound to one runtime. |

## 3. Thread rail — anatomy

A 38px-wide vertical strip on the **right edge** of the AI sidebar. From top to bottom:

1. **"+" (New thread)** — pinned at the top.
2. **Thread icons** — one per open thread, in creation order, scrollable on overflow.
3. **Flexible space.**
4. **History** — pinned at the bottom, just above the composer boundary.

Layout rules (locked):
- The rail spans the **messages area only** — it never extends over the composer. The composer runs full width below both the messages and the rail.
- **No dividers, no left emphasis bars, no extra chrome** on the rail (decluttered by decision 2026-07-21).
- The sidebar **title bar carries no thread controls** — the rail is the single home for thread management.
- There is **no named-list / wide variant** — the icon rail is the only switcher at every sidebar width (named list explicitly rejected).

## 4. Thread icons — one icon, color-coded

Every thread uses the **same icon** — the app's Phosphor `robot` (regular weight, via `ui/Icon.tsx`) — tinted by runtime:

| Runtime | Color | Hex |
|---|---|---|
| Claude | clay | `#D97757` |
| Codex | green | `#10A37F` |
| OpenCode | sky | `#0EA5E9` |

The same color coding appears in the conversation's meta row (the "CLAUDE / CODEX / OPENCODE" label above each agent reply). No invented per-runtime glyph shapes — recognition comes from color, consistency from the shared robot.

**Active thread** = indigo-soft pill background on its icon. Nothing else.

**Hover tooltip** on every icon: thread title + status (e.g. "Translate memo — needs approval"). Thread title is auto-derived from the first prompt (exact truncation rules: `ux-expert` follow-up).

## 5. Status language — "who is waiting for whom"

Each icon has **one status slot** (inside the button, bottom-right). A thread shows **at most one signal**:

| Signal | Meaning | Rule |
|---|---|---|
| **Spinner** (indigo) | Agent is working; nothing needs you | A turn is in flight (streaming, running tools) and nothing is blocked on the user. |
| **Amber dot** (pulsing) | Thread is **blocked on YOU** | The thread has an unresolved approval request, or a pending agent question / plan review. |
| *(no badge)* | Idle | No turn in flight, nothing pending. Hover shows close (×) instead. |

**Priority: amber overrides spinner.** A turn that is technically mid-flight but waiting for your approval shows amber only — the urgent information is the blockage, not the progress. When you resolve the pending item(s), the badge returns to spinner (turn resumes) or disappears (turn ended).

State machine per thread:

```
idle ──prompt──▶ running ──approval/question──▶ attention
  ▲                 │  ▲                            │
  └──turn ends──────┘  └──────all resolved──────────┘
```

Details:
- Amber sources per runtime: unified approval gate requests (file edits, commands, web fetches) attributed to the thread; Claude `AskUserQuestion` / plan review; Codex `request_user_input`; OpenCode `session/request_permission`.
- Multiple simultaneous pending requests = still a single amber dot. No counts on the rail; the detail lives inside the conversation.
- Badges show on **all** threads including the active one — the rail reads at a glance no matter which chat is open.

## 6. Thread lifecycle

**Model: the rail is your open working set; History is the permanent archive.** Every thread autosaves continuously — closing never loses content.

### Creating (promotion to the rail)
- **"+" at the rail top** creates a new empty thread, immediately active and visible on the rail.
- Only **one empty thread at a time**: pressing "+" again refocuses the existing empty thread instead of stacking blanks. An empty thread you switch away from is quietly auto-discarded.
- **Reopening from History** promotes that conversation back onto the rail as an open thread. If it's already open, Ritemark just switches to it.
- The old semantic "new chat wipes the current one" is **gone entirely** — new threads never touch existing ones.

### Closing (removal from the rail)
- **Hover × on an idle thread's icon** closes it: the live agent session is torn down, the conversation stays in History.
- Running or approval-waiting threads have **no ×** — stop the turn or resolve the approval first. This prevents accidentally killing in-flight work.
- **No timer-based auto-close.** The rail only changes when you change it.
- **Soft cap: 5 open threads.** Pressing "+" at the cap prompts you to close an idle thread first. The rail scrolls if icons overflow the visible space.

### Restart / relaunch
- The set of open threads **persists per workspace**. After relaunch, transcripts restore instantly; the underlying agent session re-attaches lazily on your next prompt in that thread.
- A turn that was mid-flight during shutdown is marked **interrupted** in the transcript (it does not silently resume).

### History (rail-bottom button)
- Lists ALL conversations; open ones carry an "open" badge.
- Click a closed conversation → it reopens onto the rail. Click an open one → switches to it.
- History stops being a "load one, destroy current" picker — it is a true archive + reopen surface.

## 7. Composer behavior

- The composer always belongs to the **active thread**. Its footer shows that thread's runtime + model (e.g. "Claude · Sonnet 5").
- Active thread running → **Stop** button (stops only THIS thread); idle → indigo **Send**.
- While a thread runs, its composer stays unlocked: Enter **queues** a follow-up prompt for that thread (the existing composer-queue notch, now scoped per thread). Queues do not cross threads.
- Switching threads is instant and non-destructive — streaming continues in background threads.

## 8. Approvals across threads

- Approval cards render **inside the thread that asked**. The rail's amber dot tells you *which* background thread needs you; switching to it shows the card.
- Approving/denying in one thread never affects another thread's pending approvals (requests are keyed per-request and attributed per-conversation).
- Model recommendation for help texts: "If a robot icon shows an amber dot, that agent is waiting for your answer — click the icon to see what it needs."

## 9. Dark mode

Same structure on Deep Space (`#1E1B4B`): Indigo-400 accent, indigo-fainter body ink, identical rail anatomy, identical status language. Runtime colors (clay/green/sky) and the amber attention dot are unchanged. See prototype panel B.

## 10. Explicitly out of scope for v1 (do not promise in help texts)

- **Named-list thread switcher** — rejected; icon rail only.
- **Cross-thread context sharing** (one thread seeing another's conversation) — issue #97, separate.
- **Composer queue management actions** (edit/promote/remove queued prompts) — issue #95, separate.
- **A global "all background activity" overview** — the rail's badges partially advance #140; a full activity center is not part of this sprint.
- **Parallel turns inside ONE thread** — a single thread still runs one turn at a time; parallelism is across threads.
- **Flows** are unaffected — flow runs do not appear on the thread rail.

## 11. Marketing-friendly framing (raw material for product-marketer)

- Headline idea: "Run several AI agents at once" / ET: "Mitu agenti korraga tööl".
- The three-runtime story is the differentiator: different engines (Claude, Codex, OpenCode) working side by side in one editor, each on its own task.
- The status language is the trust story: *you always know who's working and who's waiting for you* — spinner vs amber dot, one glance.
- Safety story stays intact: every file edit / command still pauses for your approval, per thread, nothing approves silently — parallelism does not loosen the approval gate.

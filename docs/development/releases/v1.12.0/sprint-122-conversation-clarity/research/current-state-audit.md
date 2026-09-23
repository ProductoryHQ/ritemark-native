# Sprint 122 Phase 0 — what the sidebar does today

Read on `sprint-122-conversation-clarity`, branched from `origin/main` `04231de2`
(2026-09-23). Every claim below is a line of code, not a recollection.

## 1. The active conversation has no name on screen

`ThreadRail.tsx` shows one bubble per conversation, with the title only in a
hover tooltip (`ConversationTooltip`). `UnifiedConversationView.tsx` renders the
transcript and notices; its only `title` is a continuation notice's. Nothing in
the sidebar names the conversation you are currently in, so with two or three
threads open, "which one is this?" is answered by hovering.

History (`ConversationsPanel.tsx`) already owns the vocabulary the header should
reuse:

| Action | Today, in History |
| --- | --- |
| Pin / Unpin | icon button, `push-pin` / `push-pin-slash`, label "Pin/Unpin <title>"; with **five** conversations pinned, pinning another is disabled with "Unpin a conversation before pinning another." |
| Rename | `renameHostConversation`, a dialog with the title pre-filled |
| Delete | `deleteHostConversation`, a confirm dialog whose button reads **Delete**, or **Stop and delete** while the conversation is running |

There is no archive anywhere in the codebase — "delete or archive" in the issue
is satisfied by History's existing delete-with-confirm unless a new concept is
wanted.

## 2. The prompt composer is capped at 120 px

`ChatInput.tsx:863–868`:

```ts
// Auto-resize textarea
el.style.height = Math.min(el.scrollHeight, 120) + 'px';
```

A long prompt is written through a ~5-line letterbox and cannot be made taller.

Sprint 117 already built the primitive for this and said so in its own docblock
(`components/comment/ResizableComposer.tsx`):

> It is deliberately generic: v1.12.0 Sprint 122 applies the same primitive to
> the agent composer rather than writing a second one.

It gives a native vertical resize between a 2-row floor and `min(8 rows, 40vh)`,
keeps the footer controls outside the scrolling area, and remembers the dragged
height for the session only.

## 3. Links: three classes exist, four are needed, and two cases are silent

`chatLinks.ts` classifies an anchor into `external` (http/https), `file`
(scheme-less or `file://`), or `none` (everything else). `RenderedMarkdown.tsx`
routes `external` → `openExternal`, `file` → `chat:open-file`, and **`none` →
nothing at all**: the click is `preventDefault`ed and no message is sent, so a
`mailto:`, `vscode:` or unknown-scheme link is inert with no explanation.

The host's `_openWorkspaceFile` (`UnifiedViewProvider.ts:2481`) then decides:

| Case | Today |
| --- | --- |
| File inside the folder | opens in Ritemark's editor |
| No folder open | warning: "Open a folder to follow file links from chat." |
| Path does not resolve | warning: "File not found in this workspace: …" |
| File outside the folder | warning: "Chat links only open files inside the current folder: …" — a dead end, no way to reach it |
| Target is a **directory** | `if (!fs.statSync(realTarget).isFile()) return;` — **silent**, nothing happens |

So the sprint's four classes map onto this as: project file (works), other local
file or folder (refused, needs Locate in Finder / Open externally), web URL
(works), unsupported (silent today).

The workspace confinement itself is deliberate and must stay: chat content is
model-authored, so it never opens an arbitrary disk path without the user
choosing the action. Any new action for an out-of-project target is a *reveal*
or an explicit *open externally*, never a silent editor open.

## What this means for the sprint

- Workstream A (header) is new UI over existing store actions — `pinConversation`,
  `renameHostConversation`, `deleteHostConversation` already exist and are tested.
- Workstream B (composer) is applying an existing primitive, not writing one.
- Workstream C (links) is the only one with real decisions: a fourth class, a
  context menu, and two silent cases to make explicit.

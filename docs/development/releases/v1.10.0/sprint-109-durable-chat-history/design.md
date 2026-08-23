# Sprint 109 Design — Conversations

**Status:** Approved by Jarmo — implementation baseline (2026-08-22)<br>
**System:** Ritemark Indigo-Editorial<br>
**Scope:** Compact Agent Chat navigation, attention, migration, delete/Undo, and honest restored-context states

**Interactive HTML prototype:** [prototype.html](./prototype.html) — switch between
Sprint 109 transitional, Conversations, recovery/error, delete/Undo,
restored-context, and v1.10 final scenes; includes light/dark themes.

**Archived design exploration:** [identity-mark-sheet.html](./identity-mark-sheet.html) —
the S01–S36 color-and-shape study is retained as research only. Jarmo rejected
custom decorative marks for production on 2026-08-22. Conversation shortcuts
instead use the standard Phosphor `chat-circle` in a stable per-conversation
color, with the duotone fill intentionally softer than its border.

## User Model

- **Conversation** is durable project content.
- **All conversations** is the canonical durable list for current, background, and past conversations in the project.
- The permanent right **conversation rail** is an automatic working set, not a list the user must curate: New at the top; Pinned shortcuts; every Working/Needs you conversation; the three idle conversations with the latest real activity; the current conversation appended only when otherwise absent; then All conversations immediately after the final chat button. Selecting a conversation never changes Recents order.
- The rail is a deduplicated union. A Pinned conversation that is also current or active appears once, in Pinned. Pinned membership is explicit workspace UI state, not durable-record ownership or an open/closed lifecycle. **Pin** keeps a conversation on the rail after it falls out of the automatic working set; **Unpin** removes only that guarantee; **Delete** remains separate and confirmed.

## Sprint 109 Transitional Layout

```text
┌──────────────────────────────────────┬──┐
│ [AI][Terminal]              [⚙]│[↗][×]│  native VS Code title bar
├──────────────────────────────────────┼──┤
│                                      │ +│  New conversation
│ Current transcript                   │ ◯│  Pinned conversation
│                                      │ ─│
│ Restored-context notice when needed  │ ◯│  Current / active conversations
│                                      │ ◯│  Three recent idle conversations
│ Message composer                     │ ↶│  All conversations
└──────────────────────────────────────┴──┘
```

The rail is 56px wide with 40×40px safe click targets, approximately 8px horizontal breathing room on each side, and 12px vertical spacing between conversation buttons. New is a strong indigo primary button with a distinct 20px gap below it before the conversation stack. Every conversation shortcut uses the same 20px Phosphor duotone `chat-circle`; its persisted project-scoped color slot supplies a stronger border with a translucent fill, while the active shortcut uses the established indigo surface treatment. Pinned shortcuts add a small non-interactive pin mark and are separated from automatic shortcuts by a hairline. All conversations uses the distinct `clock-counter-clockwise` history icon and follows the final chat button in the same top-aligned stack. Every conversation target does one thing only: select that conversation. There is no hover-close or nested destructive target; rail Pin/Unpin is a separate sibling control, while Delete remains only in All conversations. If the deduplicated stack exceeds the available height, the shortcut stack scrolls without shrinking targets.

Hover and keyboard focus use one Ritemark-owned Radix tooltip, portalled to avoid rail clipping. It opens to the left after 250ms, wraps at approximately 260px, and shows the full untruncated **Pinned — Title — Status** for Pinned shortcuts or **Title — Current/Working/Needs you/Recent** for automatic shortcuts. The same string is the button's accessible name. Do not also set native `title`; combining both creates duplicate tooltips.

Hovering or focusing a shortcut reveals a separate 20×20 **Pin** or **Unpin** ghost button at its upper-right corner. The control is a sibling of the 40×40 selection button rather than nested inside it, has its own **Pin {title}** or **Unpin {title}** accessible name, and never triggers selection. A Pinned shortcut shows a small passive pin mark at rest; the hover/focus action replaces it visually with `push-pin-slash`. Pin moves the same entry into the Pinned segment. Unpin removes the guarantee and moves a still-current/active/recent entry into the automatic segment without hiding or selecting it. Destructive actions remain in All conversations.

### Conversation icon

Conversation identity is carried by title, position, tooltip, canonical ID, and
a restrained stable color — not by decorative avatars. Rail shortcuts use the
standard 20px Phosphor duotone `chat-circle`; list rows use the same icon at
16px. The translucent fill remains lighter than the border. Current uses indigo
through the normal active surface state. Working and Needs you remain separate
text/dot layers, so the icon never encodes runtime, status, content, or provider.

### Deferred follow-up: stable color allocation

The Sprint 109 implementation hashes the conversation ID into a small palette.
That keeps one conversation stable, but it can assign the same color to two
different visible conversations. A later sprint must replace the hash with a
project-scoped, persisted `identityColorSlot` allocator so color can support
human visual memory (for example, “the red Credit24 conversation”). This is a
data-model and webview/host-contract change, not a webview-only styling tweak.

Allocation contract:

- A conversation receives one color slot when it is created. Rename, selection,
  Pin/Unpin, activity, status, rail membership, restart, and runtime changes do
  not change it. The same canonical conversation uses the same slot in the rail,
  All conversations, tooltips, and any future conversation picker.
- Use every base hue once before using a variant: **red, orange, amber, green,
  teal, blue, violet, magenta**. These are calm identity-specific tones, not the
  semantic error/warning/success tokens. Indigo remains reserved for Ritemark's
  selected/focus treatment rather than being the default first identity color.
- After the eight base hues, allocate complete variant rounds in the same order:
  first a deeper round, then a softer round. A variant must remain recognizably
  in its base family, and its translucent bubble fill stays lighter than its
  border. Do not start a second red before every base hue has been used once.
- Do not reuse an exact slot anywhere in the project until every defined slot is
  occupied. If the full 24-slot palette is exhausted, reuse the slot whose
  owners were least recently active. This keeps the normal working set distinct
  without claiming that an unlimited archive can have unlimited perceptually
  distinct colors. Title remains canonical identity and color is a recognition aid.
- Color never communicates Current, Working, Needs you, Pinned, runtime,
  provider, or content category. Those meanings keep their existing independent
  surface, dot, spinner, label, and pin treatments.
- Delete + Undo restores the original slot. Migration assigns missing slots in a
  deterministic `createdAt`, then `conversationId`, order so the one-time upgrade
  is reproducible and subsequent loads never reshuffle colors.

## Final v1.10 Layout after Sprint 110

```text
┌──────────────────────────────────────┬──┐
│ [AI][Terminal]              [⚙]│[↗][×]│  native VS Code title bar
├──────────────────────────────────────┼──┤
│                                      │ +│
│ Current transcript                   │ ◯│
│                                      │ ◯│  permanent conversation rail
│ Continuation boundary when needed    │ ◯│
│ Message composer                     │ ↶│
└──────────────────────────────────────┴──┘
```

## Conversations Panel

```text
│ [AI][Terminal]              [⚙]│[↗][×]│  native VS Code title bar persists
├────────────────────────────────────────┤
│ All conversations · Project name     [×]│  webview overlay begins here
│                                        │
│ PINNED               always on the rail│
│ [chat] Review release notes  Needs you │
│                                        │
│ ACTIVE & RECENT    shown automatically │
│ [chat] Translate memo          Current │
│ [chat] Onboarding review       Working │
│ [chat] Migration comparison     Recent │
│   Earlier conversation  Project unknown│
│                              [•••]      │
└────────────────────────────────────────┘
```

The panel is an absolute overlay over the transcript/composer column only: `inset: 0 56px 0 0` inside the `AISidebar` webview root. The 56px conversation rail remains visible, keeps its place, and remains usable while All conversations is open. The native secondary-sidebar title bar also remains visible; the panel header does not add a competing navigation bar.

### Automatic working set + Pinned mental model

Use one consistent sentence when coaching is needed:

> Active and recent conversations appear automatically. Pin keeps one on the rail. Every saved conversation remains under All conversations.

- All conversations mirrors permanent shortcuts under **Pinned** and automatic shortcuts under **Active & recent**, with the same `chat-circle` icon and explicit Current/Working/Needs you status when present.
- **Pin** makes a conversation permanent on the rail; **Unpin** removes only that guarantee. If it still qualifies as current, Working, Needs you, or one of the three recent idle conversations, it remains visible automatically. Neither action changes the transcript, current selection, runtime, or durable record. **Delete** is a separate confirmed action.
- Up to five conversations may be Pinned. Pinning is deliberate and stable: Ritemark never automatically unpins an item. When five are Pinned, another Pin action explains **Unpin a conversation before pinning another.** Reading, selecting, and running conversations remain independent of this navigation limit.
- Automatic membership is derived, not persisted: every Working/Needs you conversation plus the three idle conversations with greatest real `lastActivityAt`, using `conversationId` as a stable tie-break. The current conversation is appended only when otherwise absent. Selection never updates `lastActivityAt` and never reorders the recent segment. A canonical ID can occur only once; Pinned wins, followed by active work, recent idle, then an otherwise-absent current conversation.
- Tooltips use **Pinned — Title — Status** for Pinned shortcuts and **Title — Status** for automatic shortcuts.
- The **Pinned** and **Active & recent** groups are the persistent explanation of why rail buttons appear. A one-time coachmark may add the sentence above on first upgrade.
- Status dots are `pointer-events: none`; they never reduce or split the safe click target.
- Every All conversations row exposes **Rename**, **Pin** or **Unpin**, plus **Delete** on hover and `focus-within`; labels and accessible names contain the full conversation title.
- **Rename** uses `pencil-simple` and opens a compact modal with the current title selected for editing, Cancel, and a primary Save action. The field is limited to 80 characters. Saving changes only the canonical host title.

- Header and rows use Sofia Sans at chrome scale; no display typography.
- Current row uses `--r-accent-soft` and the established indigo active-row treatment.
- Rows use `--r-surface`, `--r-ink-strong/body/muted`, `--r-hairline`, 4px row radius, and 13px primary text.
- Native secondary-sidebar actions retain VS Code product icons for AI, Terminal, Settings, maximize, and close. Webview-owned actions use Phosphor icons only through `Icon`: `plus` for New, duotone `chat-circle` for conversations, `clock-counter-clockwise` for All conversations, `push-pin`/`push-pin-slash` for Pin/Unpin, plus `trash`, `warning`, `x`. There is no custom-SVG icon exception.
- Idle rows have no status pill. `Working` has spinner plus text; `Needs you` has amber dot plus text. Status is never color-only.
- `Needs you` sorts into an attention group; otherwise ordering stays `lastActivityAt` descending with stable tie-break.

## Trigger and Attention

- The existing VS Code secondary-sidebar title bar remains the single header. It owns the Ritemark AI and Terminal composite tabs on the left, AI Settings, and native maximize/close actions on the far right. Do not add a second webview-owned “AI Assistant” header.
- All conversation navigation remains in one top-aligned rail stack: primary New, Pinned shortcuts, automatic active/recent shortcuts, then All conversations. Use a 56px rail, 40×40 targets, and 12px vertical spacing so targets have clear horizontal and vertical separation.
- Hidden background state aggregates as `Needs you` > `Working` > idle.
- Accessible label includes counts: **Conversations, 2 need you** or **Conversations, 1 working**.
- Idle state has no dot/pulse. Reduced motion removes spinner/pulse but keeps text/count.
- The conversation rail uses the same priority and labels; no separate vocabulary and no destructive rail action.

## Empty, Error, and Migration States

- Empty: **No conversations in this project yet** with New conversation action.
- List failure: panel-level error with Retry; visually distinct from one corrupt row.
- Corrupt row: **Couldn’t open this conversation** with non-destructive details/recovery action; no ghost replacement.
- Earlier conversations section: **These were saved by an earlier Ritemark version and aren’t linked to a project.** Actions are **Move to this project** and **Delete**.
- Long titles truncate visually; full title remains in accessible name/tooltip and timestamp remains visible.

## Restored Context

Sprint 109 inline notice:

When no matching live runtime session remains:

> This conversation was restored. Previous messages are visible, but the agent starts with a new working context.

When the matching live session still exists, omit this notice because the existing working context remains live.

When all five live sessions are working or waiting, block only the attempted Send and say:

> Five conversations are already working or waiting for you. Finish, answer, or stop one before starting another.

Never expose the internal terms `attachment`, `session cap`, or `make room` in this user-facing flow.

Opening/selecting only reads the transcript. No runtime, sign-in, native resume, network request, or fallback work begins until Send. Sprint 110 replaces this interim message with measured continuation results.

## Delete and Undo

- Every standard All conversations row reveals 30×30 ghost **Pin/Unpin** and `trash` icon buttons immediately on row hover and `focus-within`. Their accessible names are **Pin {conversation title}**, **Unpin {conversation title}**, and **Delete {conversation title}**. Delete opens the confirmation flow and never deletes immediately.
- The history rail trigger itself is a borderless ghost icon button. While All conversations is open it uses the soft indigo active treatment, not an outline.
- Idle delete uses shadcn `Dialog` with secondary Cancel and red destructive confirmation.
- Running delete is **Stop and delete…** and states that work stops immediately.
- Both show an in-webview toast with Undo, announced through a polite live region.
- Undo after running deletion restores transcript/ID/scope with an inline Interrupted boundary; it never claims stopped work resumed.
- Dialog traps focus and restores it. Toast does not steal focus.

## Focus and Accessibility

- Opening Conversations focuses the title/first actionable control; arrows/tab navigate, Enter selects, Escape closes and returns focus to trigger.
- Selecting a row closes the panel and places focus at the transcript/composer boundary.
- Row accessible name contains title, last-updated time, and status when present.
- Validate light, dark, VS Code high-contrast, 200% zoom, keyboard-only, screen reader labels/live region, and reduced motion.
- Use the shared 4px indigo focus ring; no custom hardcoded colors or VS Code defaults on owned surfaces.

## Phase 0 Decisions for Jarmo

Use `prototype.html` for the visual decision; the ASCII layouts below remain the
compact implementation contract.

- [x] Approve permanent conversation rail: primary New; up to five Pinned shortcuts; all Working/Needs you conversations; three activity-ordered recent idle conversations; otherwise-absent current appended; then All conversations immediately below. The union is deduplicated and selection-neutral, and uses 56px rail, 40×40 targets, 12px spacing, reliable full-title tooltips, Pin/Unpin terminology, and no rail Close (Jarmo, revised 2026-08-22).
- [x] Retire custom color-and-shape identity marks; use one Phosphor duotone `chat-circle` with a stable calm per-conversation color and a softer fill than border (Jarmo, revised 2026-08-22).
- [x] Use the distinct `clock-counter-clockwise` history icon for All conversations (Jarmo, 2026-08-23).
- [x] Keep recent ordering activity-based and independent of selection; append an otherwise-absent current conversation without disturbing Recents (Jarmo, revised 2026-08-22).
- [x] Approve the final prototype baseline: 20px separation below New, passive Pin at rest, and separate 20×20 Pin/Unpin sibling action on rail hover/focus (Jarmo, 2026-08-22).
- [x] Approve native secondary-sidebar order: AI, Terminal | Settings | maximize, close; conversation navigation stays in the rail (Jarmo, 2026-08-22).
- [x] Approve `Needs you` > `Working` attention priority and count labels (implemented and included in approved final design, 2026-08-23).
- [x] Approve Earlier conversations / Project unknown move and delete actions (implemented after design approval, 2026-08-23).
- [x] Approve confirmed Delete + Undo for idle and running records, with running Undo restored as Interrupted (2026-08-23).
- [x] Approve interim restored-context wording (live-verified and accepted, 2026-08-23).

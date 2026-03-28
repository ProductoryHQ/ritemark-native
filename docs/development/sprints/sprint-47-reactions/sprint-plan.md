# Sprint 47: Ritemark Reactions

## Goal
Add a lightweight analytics layer and in-editor reaction widget that lets Ritemark understand how users engage with the product, while keeping all data anonymous and giving users a clear opt-out.

## Feature Flag Check
- [ ] Does this sprint need a feature flag?
  - The analytics layer as a whole warrants a kill-switch flag (`analytics`) in case PostHog has issues or a user wants a hard disable beyond the settings toggle.
  - The reaction widget itself is lightweight and stable — no separate flag needed.
  - If YES: Define flag in deliverables.

**Decision: YES — add `analytics` feature flag (kill-switch, stable, all platforms)**

Rationale: analytics touches network calls and user data. A kill-switch gives us an emergency off without a release.

## Success Criteria
- [ ] Anonymous UUID is generated on first launch and persisted in `globalState`; no PII is collected
- [ ] First-launch info message appears once, offering "Learn More" and "Opt Out" options
- [ ] `ritemark.analytics.enabled` setting defaults to `true`; setting it to `false` suppresses all PostHog calls
- [ ] Reaction button (smiley icon) appears in `editor/title` when Ritemark editor is active
- [ ] Clicking the button opens a QuickPick with 4 choices (Love it / It's good / It's okay / Needs work)
- [ ] After selecting a reaction, an optional follow-up input box asks "Want to tell us more?"
- [ ] Reaction + optional message is sent as a `reaction_submitted` PostHog event
- [ ] `app_session_start` event fires on every activation
- [ ] Analytics module flushes on extension deactivate (no lost events)
- [ ] All new code compiles with zero TypeScript errors

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `src/analytics/posthog.ts` | PostHog client init, UUID management, event sending, opt-out check, flush on deactivate |
| `src/analytics/events.ts` | Typed event definitions (`AnalyticsEvent`, `EventName`, payload shapes) |
| `src/analytics/reactions.ts` | `registerReactionCommand()` — QuickPick UI, optional message input, fires `reaction_submitted` event |
| `extension.ts` (modified) | Import and call `initAnalytics(context)` in `activate()`; call `shutdownAnalytics()` in `deactivate()` |
| `package.json` (modified) | `posthog-node` in dependencies; `ritemark.reactions` command + icon; `editor/title` menu entry; `ritemark.analytics.enabled` configuration setting; `analytics` feature flag setting |
| `src/features/flags.ts` (modified) | Add `analytics` to `FlagId` union and `FLAGS` registry |

## Implementation Checklist

### Phase 1: Package setup
- [ ] Add `posthog-node` to `dependencies` in `extensions/ritemark/package.json`
- [ ] Add `ritemark.reactions` command entry in `contributes.commands` (icon: `$(smiley)`)
- [ ] Add `ritemark.reactions` to `contributes.menus["editor/title"]` with `when: activeCustomEditorId == ritemark.editor`
- [ ] Add `Ritemark Analytics` configuration section with `ritemark.analytics.enabled` (boolean, default `true`)
- [ ] Add `analytics` feature flag setting to `Ritemark Features` configuration section (boolean, default `true`)

### Phase 2: Feature flag
- [ ] Add `'analytics'` to `FlagId` union in `flags.ts`
- [ ] Add `analytics` entry to `FLAGS` registry (status: `'stable'`, all platforms)

### Phase 3: Analytics core (`src/analytics/`)
- [ ] Create `events.ts` — define `EventName` union and typed payload map
- [ ] Create `posthog.ts`:
  - [ ] `initAnalytics(context)` — reads or generates anonymous UUID, stores in `globalState`, inits PostHog client, shows first-launch notice if `hasSeenNotice` is false, fires `app_session_start`
  - [ ] `trackEvent(name, properties?)` — checks `ritemark.analytics.enabled` setting before sending
  - [ ] `shutdownAnalytics()` — flushes PostHog client
- [ ] Create `reactions.ts`:
  - [ ] `registerReactionCommand(context)` — registers `ritemark.reactions` command
  - [ ] QuickPick with 4 labeled choices
  - [ ] Follow-up `showInputBox` for optional message (placeholder "Optional — tell us more")
  - [ ] Calls `trackEvent('reaction_submitted', { reaction, message? })`

### Phase 4: Wire into extension.ts
- [ ] Import `initAnalytics`, `shutdownAnalytics` from `./analytics/posthog`
- [ ] Import `registerReactionCommand` from `./analytics/reactions`
- [ ] Call `initAnalytics(context)` early in `activate()` (after `initAPIKeyManager`)
- [ ] Call `registerReactionCommand(context)` in `activate()`
- [ ] Export or call `shutdownAnalytics()` in `deactivate()`

### Phase 5: Validate
- [ ] `npx tsc --noEmit` passes with zero errors from `extensions/ritemark/`
- [ ] Reaction button is visible in editor/title when a `.md` file is open
- [ ] Reaction button is absent when non-Ritemark editors are active
- [ ] QuickPick opens on click, all 4 choices appear
- [ ] Optional message box appears after choice selection
- [ ] Dismissing the message box (Escape) does not block the event from being sent
- [ ] Disabling `ritemark.analytics.enabled` suppresses events (verify via PostHog dashboard or debug log)
- [ ] First-launch notice appears only once

## Risks & Notes

| Risk | Mitigation |
|------|------------|
| `posthog-node` bundle size | Check final `out/extension.js` size after compile; posthog-node is ~100KB, acceptable |
| PostHog API key in source | This is standard practice for client-side analytics keys; it is public by design |
| Network calls on every reaction | PostHog SDK batches and queues internally; low risk |
| Users on opt-out expecting silence | Check setting before every `trackEvent` call; not just on init |

## Status
**Current Phase:** 2 (PLAN)
**Approval Required:** Yes — waiting for Jarmo

## Approval
- [ ] Jarmo approved this sprint plan

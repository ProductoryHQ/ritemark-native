# Sprint 47: Ritemark Reactions - Research Findings

## Codebase State

### Extension entry point
- `extensions/ritemark/src/extension.ts` — `activate()` initializes all services
- Pattern: init service, push subscriptions to `context.subscriptions`

### editor/title area (current state)
- One button: `ritemark.showAIPanel` with `$(sparkle)` icon
- `when` clause: `activeCustomEditorId == ritemark.editor`
- Defined in `package.json` under `contributes.menus["editor/title"]`
- New reaction button will sit alongside this button in the same group

### Feature flags
- Registry in `extensions/ritemark/src/features/flags.ts`
- `FlagId` union type must be extended for new flags
- No analytics flag exists yet

### Settings pattern
- Settings declared in `package.json` under `contributes.configuration`
- Existing sections: Ritemark Updates, Ritemark Features, Codex, Ritemark AI
- New section needed: Ritemark Analytics

### globalState usage
- Used for version tracking (`ritemark.themeAppliedVersion`)
- Appropriate storage for anonymous UUID and first-launch flag

### Dependencies
- `package.json` at `extensions/ritemark/package.json` — `dependencies` section needs `posthog-node`
- Extension is compiled TypeScript (`out/`), so Node.js packages work fine

### No existing analytics infrastructure
- No PostHog, no telemetry, no event tracking of any kind
- Clean slate

## Key Integration Points

### Where to init analytics
- `extension.ts` `activate()` — after `initAPIKeyManager(context)`, before heavier service init
- Pass `context` to analytics init so it can access `globalState` and `secrets`

### Command registration pattern (from existing code)
```typescript
context.subscriptions.push(
  vscode.commands.registerCommand('ritemark.someCommand', () => { ... })
);
```

### QuickPick pattern (VS Code API)
- `vscode.window.createQuickPick()` or `vscode.window.showQuickPick()` for reaction choices
- `vscode.window.showInputBox()` for optional follow-up message

## PostHog Considerations
- `posthog-node` is the server-side Node SDK — correct for extension context
- Requires API key (PostHog project API key, safe to bundle in source)
- `distinct_id` should be anonymous UUID from `globalState`
- Must flush on deactivate to avoid lost events

## First-Launch Notification
- VS Code API: `vscode.window.showInformationMessage()` with "Learn More" / "Opt Out" buttons
- Store `ritemark.analytics.hasSeenNotice` in `globalState` to show once only

## Opt-Out Setting
- `ritemark.analytics.enabled` boolean, default `true`
- Must be checked before every event send

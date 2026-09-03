# Runtime availability and authentication isolation

**Decision date:** 2026-09-03
**Scope:** v1.10.0 RC bug fix; no separate sprint

## Problem

Agent Chat currently treats the selected provider's setup state as a gate for
the whole sidebar. If Claude is selected and the user signs out of Claude,
the Claude setup screen replaces the transcript and Composer even when Codex
is authenticated and usable. The reverse path has the same architectural
risk.

The root cause is not one missing conditional. Three concepts are conflated:

1. a provider status probe completed (`runtimeHydration.phase === "ready"`);
2. that provider is actually usable for a new turn;
3. that provider is the current conversation's explicit pending selection.

`runtimeHydration` describes probe lifecycle only. It must never be used as a
proxy for authenticated, configured runtime availability.

## Authorities

| Concern | Authority | Lifetime |
| --- | --- | --- |
| Runtime/account availability | Provider adapter status normalized by Agent Chat | App-global, independently refreshed per runtime |
| Preferred runtime | `ritemark.ai.selectedAgent` | App-global default for a new blank conversation |
| Pending runtime/model | `ConversationState.pendingRuntime` and runtime-specific model fields | Per conversation; explicit user intent |
| Accepted turn provenance | Durable turn/runtime record | Immutable history |

An account transition may change only the first row. It must not rewrite a
conversation's history or silently move a non-empty conversation to another
provider.

## Canonical availability contract

Every enabled runtime resolves to exactly one normalized state:

- `checking` — the latest probe has not completed;
- `ready` — a turn can be accepted now;
- `needs-auth` — credentials or account sign-in are missing;
- `auth-in-progress` — browser/account flow is active;
- `needs-configuration` — enabled runtime lacks required provider setup;
- `not-installed` — required executable is absent;
- `broken` — executable exists but cannot be used;
- `disabled` — feature/runtime is disabled;
- `error` — the status probe itself failed.

Only `ready` has `usable: true`. Provider-specific statuses remain transport
details; one pure normalizer supplies the sidebar gate, notice, Composer send
guard, placeholders, and tests.

## Rendering rules

| Situation | Required result |
| --- | --- |
| Selected runtime ready | Normal transcript and Composer |
| Selected runtime unavailable, another ready | Preserve transcript and Composer; show provider-scoped recovery plus an explicit **Use ...** action |
| Selected runtime unavailable, existing conversation, no alternative ready | Preserve transcript and Composer; show recovery action; do not erase context with a setup takeover |
| Empty conversation, no runtime ready | Show onboarding or the selected runtime's setup view |
| Runtime has no completed probe yet | Preserve the shell and disable Send until the canonical state becomes ready |
| Explicit switch to an already-ready runtime | Consume the last-known-good availability snapshot immediately; selection must not start or expose a new blocking probe |
| Failed turn already contains recovery | Do not duplicate a second recovery card |

Action bars follow the application convention: right-aligned, secondary
actions left of the rightmost primary action.

## Switching and recovery

- Ritemark never silently changes provider for a non-empty conversation.
- Choosing **Use Codex**, **Use Claude**, or a model row is explicit intent.
- The existing durable first-send runtime boundary records the handoff; merely
  changing the pending selection does not add a fake turn.
- A provider logout/auth loss interrupts and checkpoints only that provider's
  active attachments, then disposes only that provider's sessions.
- Authentication recovery refreshes only the affected runtime and leaves
  other runtime availability intact.
- Runtime selection consumes availability; it does not produce availability.
  Provider probes are owned by bootstrap, explicit recheck, and account/runtime
  invalidation paths, so a stalled refresh cannot turn a ready fallback into a
  disabled `Checking ...` Composer.

## Deterministic acceptance matrix

1. Claude `needs-auth` + Codex `ready` => chat shell, Claude recovery, **Use Codex**, Claude Send disabled.
2. Codex `needs-auth` + Claude `ready` => chat shell, Codex recovery, **Use Claude**, Codex Send disabled.
3. Both unavailable + empty thread => onboarding/setup.
4. Both unavailable + non-empty thread => transcript preserved with recovery.
5. A provider without a completed usable snapshot whose probe is `checking` or
   `error` => never reported usable.
6. OpenCode enabled without a configured provider => `needs-configuration`.
7. Selecting a ready alternative updates runtime and model as one conversation
   action without starting a second readiness probe or disabling Send.
8. Explicit Claude logout interrupts and disposes Claude sessions without touching Codex/OpenCode sessions.

## Release gate

The pure matrix, store/runtime tests, and fresh-profile RUNDEV evidence pass on
2026-09-03. RUNDEV showed the exact reported case: deterministic Claude
`needs-auth` plus real connected bundled Codex `0.153.0`, with the transcript,
Composer, and model selector preserved; **Sign in** remained secondary to the
rightmost **Use Codex** action; the explicit switch removed the card. Visual
testing then exposed and closed a second-order regression: runtime selection
used to launch a fresh status probe and could strand that known-ready fallback
at `Checking Codex...`. Selection now consumes the ready snapshot without
probing. A real GPT-5.6-Sol turn sent after the corrected switch answered
`Final fallback works.`; the workspace file SHA-256 remained
`0f141fcc134d810ae09da4dfbd7e2006140e317a9942498f820a30f76068fe89`
before and after both no-write canaries.

Branch review and the official repository QA gate pass. The correction is not
release-ready until merge, native x64/Windows runtime CI, and the same
provider-isolation/authenticated-turn checks in the exact signed arm64
candidate pass.

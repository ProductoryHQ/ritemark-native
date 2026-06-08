# Arch Audit 1 — esbuild bundleability + cron deps

**Date:** 2026-06-07
**Sprint:** 79 — Runtime Unification (Phase 0 audit)

---

## Audit 1: `@agentclientprotocol/sdk` esbuild bundleability

### Build toolchain correction

The ritemark extension host (`extensions/ritemark/src/`) is **not built with esbuild**. The
build script is plain `tsc -p ./` (see `extensions/ritemark/package.json` `scripts.compile`),
outputting CommonJS to `out/`. The `vscode/extensions/esbuild-extension-common.mts` and
`vscode/build/gulpfile.extensions.ts` are for VS Code's own built-in extensions (copilot,
markdown, etc.) — `extensions/ritemark` is not in that list. The ACP SDK "bundleability" question
therefore becomes: **does it load cleanly at runtime inside a CJS extension host?**

### SDK package analysis

| Field | Value | Notes |
|---|---|---|
| `"type"` | `"module"` | Pure ESM — no CJS fallback |
| `"main"` | `dist/acp.js` | No `exports` conditional map |
| `"types"` | `dist/acp.d.ts` | TypeScript declarations available |
| Peer dep | `zod ^3.25.0 \|\| ^4.0.0` | Not bundled; resolved at runtime |

`dist/acp.js` is 1 345 lines of static ESM. It opens with three static imports:

```js
import { z } from "zod/v4";
import * as schema from "./schema/index.js";
import * as validate from "./schema/zod.gen.js";
```

**No dynamic `require()`, no dynamic `import()`, no `__dirname`/`__filename`/`createRequire`.**
The SDK is structurally clean — no patterns that cause problems with bundlers.

### The ESM-from-CJS problem and its solution

Because the extension host is CJS and the SDK is ESM, a plain `require('@agentclientprotocol/sdk')`
or a naively-compiled TypeScript `import … from '@agentclientprotocol/sdk'` (which tsc rewrites
to `require()`) would throw at runtime.

`acpClient.ts` **already solves this correctly** via the `new Function()` trick:

```typescript
// src/acp/acpClient.ts lines 31–43
// The SDK is pure ESM ("type": "module"); the extension compiles to CommonJS.
// Mirror AgentRunner.ts: load it through a Function-wrapped dynamic import so
// TypeScript does not rewrite import() → require() (which would fail on ESM).
let sdkPromise: Promise<AcpSdk> | null = null;
function loadAcpSdk(): Promise<AcpSdk> {
  if (!sdkPromise) {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string
    ) => Promise<AcpSdk>;
    sdkPromise = dynamicImport('@agentclientprotocol/sdk');
  }
  return sdkPromise;
}
```

This is the same pattern used in `src/agent/AgentRunner.ts` for `@anthropic-ai/claude-agent-sdk`
(also pure ESM). The `new Function()` wrapper prevents tsc from touching the `import()` expression,
so Node.js receives a real dynamic import at runtime and can load the ESM graph correctly.

### Zod peer dependency

The SDK imports `from "zod/v4"`. Ritemark already has `zod: "^4.0.0"` as a direct dependency
(installed: 4.4.3). Zod 4.x ships the `/v4` subpath export. Resolution is clean — no mismatch.

### Verdict

**The SDK loads correctly today. No build changes needed for Sprint 79.**

- No esbuild is involved in the extension host build — the "esbuild bundleability" concern does not apply.
- The ESM-from-CJS gap is pre-solved by the `new Function()` dynamic import in `acpClient.ts`.
- If Sprint 79 adds new files that import from `@agentclientprotocol/sdk`, they must follow the same pattern: only type-import at compile time, load the module at runtime via `loadAcpSdk()` (or import the singleton from `acpClient.ts`).

---

## Audit 2: cron-parser / node-cron availability

### Current state of dependencies

```
extensions/ritemark/package.json — cron-related deps: {}   (none)
extensions/ritemark/node_modules/ — grep for cron/schedule packages: (no results)
```

Neither `cron-parser` nor `node-cron` is installed. The sprint plan assumption (Sprint 77 added one
of them) was incorrect.

### What already exists

The Flows subsystem already has a complete "fire on schedule" implementation that does **not** depend
on any cron library:

| File | Role |
|---|---|
| `src/flows/flowSchedule.ts` | Parses structured `FlowSchedule` objects (HH:MM time, weekday list, interval-in-minutes); exports `getDueScheduledRun()` + `SCHEDULE_TICK_MS = 30_000` |
| `src/flows/FlowScheduler.ts` | Runs a `setInterval` at 30 s; on each tick calls `getDueScheduledRun()` to decide whether to fire a flow |
| `src/flows/FlowScheduleState.ts` | Persists last-run bookkeeping in `vscode.ExtensionContext.workspaceState` |

All three files have passing unit tests (`flowSchedule.test.ts`, `FlowScheduler.test.ts`,
`FlowScheduleState.test.ts`).

### Option comparison

| Option | Install | Cron syntax | Self-clocking | Extension lifecycle |
|---|---|---|---|---|
| **`cron-parser`** | `npm install cron-parser` | Yes — standard 5-field cron strings | No — you manage `setTimeout` | Compatible; you control when to stop |
| **`node-cron`** | `npm install node-cron` | Yes | Yes — runs its own interval | **Problematic** — its internal `setInterval` does not know about VS Code's `deactivate()` lifecycle |
| **Reuse `FlowScheduler`** | Nothing | No — uses `FlowSchedule` struct | Yes — existing 30 s tick | Native — already integrated with extension lifecycle |

### Recommendation: reuse existing FlowScheduler infrastructure

For the Sprint 79 daemon (R8 — fire `AgentRuntime.prompt()` on a schedule), **do not add a new
dependency**. The FlowScheduler pattern is already proven, tested, and extension-lifecycle-aware.

The Sprint 79 daemon should:
1. Accept a `FlowSchedule`-compatible schedule config (same struct already used by Flows).
2. Either reuse `FlowScheduler` directly (if the daemon fits within the Flows executor) or copy
   the `setInterval` + `getDueScheduledRun()` pattern for the new daemon class.

If Sprint 79 strictly requires standard cron-expression strings (e.g. `"0 9 * * 1-5"`) and cannot
use the existing `FlowSchedule` struct, then the correct choice is **`cron-parser`** (not `node-cron`):
- `cron-parser` is parse-only (~35 KB unpacked); it gives you `parseExpression(expr).next().toDate()`.
- Pair it with a single `setTimeout` per schedule slot — no embedded event loop to fight with VS Code.
- `node-cron` embeds its own scheduler loop and has no clean VS Code `Disposable` integration;
  it would require manual `.destroy()` in `deactivate()` and is unnecessary overhead.

**Short answer:** add nothing. Use `FlowScheduler` / `getDueScheduledRun()`. If cron strings are
truly required, add only `cron-parser`.

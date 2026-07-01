# verify-sprint89

Objective verifier for the Sprint 89 Model Gateway work — the "check you can't fake"
that closes each implementation loop iteration. Run this after every workstream/task
edit; do not report a task done until this passes green.

Best-practice basis (web-researched 2026-07-01): close every loop on a signal the
agent can't rationalise away (compile exit code + test exit code), and let an
**independent evaluator** (the `qa-validator` subagent) certify at phase gates —
never self-certify the code you just wrote.

## Run the objective checks

```bash
cd extensions/ritemark

# 1. Extension host type-check (the primary gate — pre-commit Check 7)
npm run compile; echo "compile_exit=$?"

# 2. Model-catalog unit tests (pure logic — validator + resolver waterfall)
npx tsx src/ai/modelCatalog/modelCatalog.test.ts; echo "catalog_test_exit=$?"

# 3. Webview type-check — ONLY needed once webview files are touched (pre-commit Check 7b)
( cd webview && npx tsc --noEmit ); echo "webview_tc_exit=$?"

# 4. Full extension test suite — before a phase-closing commit
npm test; echo "test_exit=$?"
```

## Loop protocol

1. **Inner loop (fix-until-green):** if any exit code is non-zero, read the error,
   fix the source, re-run. Repeat until all relevant checks are 0. Never move on red.
2. **Independent certification (phase gate):** when a phase's tasks are all green,
   spawn `qa-validator` to certify against `spec.md` / `scenarios.md`. The agent that
   wrote the code does not certify it.
3. **Commit checkpoint:** only commit a phase when (1) and (2) both pass and the
   pre-commit hook is green. Update `tasks.md` checkboxes + the sprint-plan status log.
4. **Cap:** if the inner loop does not converge after 3 attempts on the same error,
   stop and surface the blocker rather than thrashing.

Checks 3 and 4 are conditional (only when their inputs changed) to keep iterations fast.

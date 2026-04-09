# Windows Build Speed Analysis

**Date:** 2026-03-14  
**Request:** Find the fastest practical way to get at least one reliably fast Windows release build, including paid options  
**Author:** Codex  
**Status:** Recommendation complete, immediate workflow optimizations applied

---

## Executive Summary

The current Windows release workflow is slow for two separate reasons:

1. It runs on a standard fresh GitHub-hosted Windows VM.
2. It rebuilds too much cold state on every run.

For this repository, the best long-term solution is **a warm self-hosted Windows runner with a custom image**, managed through a service such as RunsOn or equivalent AWS-backed GitHub Actions runner automation.

If lower operational overhead matters more than absolute speed/cost efficiency, the best simpler paid option is **GitHub Actions larger runners with a custom Windows image**.

Staying on standard `windows-latest` and only adding caches is worth doing, but it is not the final answer. It should reduce waste, not fundamentally change the experience.

---

## Current Workflow Reality

The current workflow is in [`.github/workflows/build-windows.yml`](../../../.github/workflows/build-windows.yml).

The expensive parts are:

- fresh `windows-latest` VM every run
- fresh clone of VS Code OSS each run
- full VS Code dependency install each run
- full extension dependency install each run
- full `gulp vscode-win32-x64-min` packaging build each run

Relevant steps:

- clone VS Code: [`.github/workflows/build-windows.yml`](../../../.github/workflows/build-windows.yml#L26)
- install VS Code deps: [`.github/workflows/build-windows.yml`](../../../.github/workflows/build-windows.yml#L55)
- install extension deps: [`.github/workflows/build-windows.yml`](../../../.github/workflows/build-windows.yml#L81)
- package build: [`.github/workflows/build-windows.yml`](../../../.github/workflows/build-windows.yml#L106)

The existing build docs already set the expectation at roughly **25 minutes** for the Windows app build: [`docs/development/building.md`](../building.md#L175).

That aligns with the workflow shape. This is not one bad command. It is a cold-start pipeline.

---

## Immediate Improvements Already Applied

The workflow was updated to remove obvious waste:

- switched dependency installs from `npm install` to `npm ci`
- enabled `actions/setup-node` npm caching for both `vscode/package-lock.json` and `extensions/ritemark/package-lock.json`
- changed the VS Code clone to `--filter=blob:none`

These changes are in [`.github/workflows/build-windows.yml`](../../../.github/workflows/build-windows.yml#L26).

This is the right first step, but it should be understood correctly: **it improves cold CI efficiency, not the architecture**.

QA validation passed after the workflow edit via `./scripts/validate-qa.sh`.

---

## Research Question

The actual decision is not "which vendor is fastest?"

The real question is:

> Which approach gives Ritemark one dependable fast Windows build with the least wasted setup time and acceptable operational complexity?

That leads to three realistic paths.

---

## Option Analysis

## 1. Standard GitHub-hosted Windows Runner

### What it is

Keep using `runs-on: windows-latest` on GitHub-hosted runners and improve the workflow with dependency caches and cleaner installs.

### Strengths

- no new vendor
- simplest operational model
- no runner security or patch management burden
- easy to keep integrated with current GitHub Actions workflow

### Weaknesses

- still fully ephemeral
- dependency caches help, but image state is still cold
- no warm runner pool
- no preinstalled repo-specific Windows build image
- likely still feels slow for VS Code fork packaging builds

### Verdict

Good baseline cleanup. Not sufficient if the goal is "at least once build fast" in a meaningful way.

---

## 2. GitHub Larger Runners With Custom Image

### What it is

Stay fully inside GitHub Actions, but move the Windows release build onto a paid larger runner and use a custom image for preinstalled build prerequisites.

### Why it helps

- more CPU, memory, and disk than standard Windows runners
- custom images let you preload Windows build tooling and reduce repeated setup work
- lower operational burden than self-hosted infrastructure
- cleanest path if you want GitHub-native billing and controls

### Tradeoff

- still an ephemeral runner model
- more expensive per minute than standard hosted
- you get some speedup from hardware, but the real win comes from the custom image
- image maintenance still exists, just in GitHub’s model

### Fit for this repo

This is a strong option if you want a paid solution without taking on runner fleet management.

### Verdict

**Best low-ops paid option.**

---

## 3. Managed Self-Hosted Windows Runner With Warm Pool and Custom Image

### What it is

Use a managed self-hosted runner service for GitHub Actions on Windows, backed by your cloud account or vendor-managed infra, with:

- warm standby runner capacity
- custom Windows machine image
- externalized cache/storage

Examples include RunsOn and similar managed GitHub Actions runner providers.

### Why it helps most

- warm pool cuts runner startup delay
- custom image removes repeated tool/bootstrap cost
- persistent or externalized caches are more effective than cold GitHub-hosted runners
- instance sizes can be chosen around the actual packaging workload

### Why this matches Ritemark

This repo’s Windows build is not a high-frequency PR workflow. It is a release-oriented pipeline triggered by:

- `workflow_dispatch`
- tag pushes

That makes a managed self-hosted Windows release runner far more practical than it would be for untrusted public PR execution.

### Risks

- more moving parts than GitHub-hosted
- image lifecycle and patching become your responsibility, directly or indirectly
- self-hosted runner security needs explicit boundaries

### Verdict

**Best speed/cost option for release builds. Recommended.**

---

## 4. Dedicated Local or VM Windows Build Machine

### What it is

Maintain one Windows PC or VM dedicated to building releases.

### Strengths

- potentially very fast if kept warm and stable
- easiest place to debug Windows-specific build issues interactively
- can also build installers locally with Inno Setup

### Weaknesses

- manual unless you wrap it with runner automation
- fragile if it becomes a one-off snowflake machine
- poor auditability compared with CI-managed builds

### Verdict

Useful as a development/debug machine. Not the best primary release pipeline unless it is effectively turned into a managed runner.

---

## Recommendation

### Recommended target state

Move the Windows release workflow to **a managed self-hosted Windows runner with a warm pool and a custom image**.

### Why this is the best answer

The repo’s problem is mostly **cold environment rebuild cost**, not only raw CPU speed.

A bigger cold VM helps, but a **warm image + warm runner** helps more.

Because the workflow is release-oriented rather than PR-heavy, the security and ops tradeoff is acceptable if the runner is restricted to trusted workflows only.

### Best fallback if you want less infrastructure responsibility

Use **GitHub larger runners with a custom image**.

That is the most practical paid option if you want to stay as close as possible to the current GitHub-only model.

---

## Reasoning Behind the Recommendation

The choice is driven by four facts:

1. The current workflow is dominated by cold setup work before the actual package build starts.
2. Standard GitHub Windows runners are fine for correctness, but poor for "fast release build" expectations on a VS Code fork.
3. The build is release-oriented, not a public PR fan-out workload.
4. A custom image matters at least as much as runner size.

That last point is the key one. If the image is still cold, paying for more cores is only a partial fix.

---

## Expected Impact

These are reasoned expectations, not measured repo benchmarks yet.

### After the workflow cleanup already applied

Expected improvement:

- faster dependency install phases
- less wasted network work
- more predictable reruns

Expected limitation:

- total runtime still likely remains in the same broad class because packaging and cold runner startup still dominate

### After moving to GitHub larger runners with custom image

Expected improvement:

- noticeable reduction in total runtime
- materially less waiting on dependency/bootstrap steps
- lower variance between runs

### After moving to managed self-hosted Windows with warm pool + custom image

Expected improvement:

- biggest reduction in end-to-end release build time
- best chance of getting the "finally fast" Windows build experience
- best control over preinstalled tooling, caches, and machine sizing

---

## Suggested Implementation Plan

## Phase 1: Keep the current workflow cleanup

Already done:

- `npm ci`
- npm cache via `setup-node`
- filtered VS Code clone

Do not revert these regardless of runner choice.

## Phase 2: Separate trusted release builds from any future general CI

If self-hosted or managed runners are introduced:

- keep them only for trusted release workflows
- do not expose them to arbitrary public PR execution
- restrict secrets and runner labels tightly

## Phase 3: Build a custom Windows image

Preinstall at minimum:

- required Node version matching `vscode/.nvmrc`
- Python 3.11
- Visual Studio build tools / required native build prerequisites
- any stable repo-independent build tooling

Avoid baking frequently changing repo dependencies directly into the image unless measurement proves it is worth the maintenance cost.

## Phase 4: Measure real runtime deltas

Track at least:

- checkout + clone time
- dependency install time
- `gulp vscode-win32-x64-min` time
- total workflow wall clock time

Without this, infrastructure spend turns into guesswork.

---

## Decision Table

| Option | Speed Gain | Ops Burden | Cost Efficiency | Recommendation |
| --- | --- | --- | --- | --- |
| Standard GitHub Windows + caches | Low to moderate | Low | Good | Keep as baseline only |
| GitHub larger runner + custom image | Moderate to high | Low to moderate | Moderate | Best low-ops paid choice |
| Managed self-hosted Windows + warm pool + custom image | High | Moderate | High | Recommended |
| Dedicated local/VM Windows machine | Variable | Moderate to high | Variable | Good for debugging, not preferred as primary release path |

---

## Sources

Research was based on the repo workflow plus current platform documentation as of **2026-03-14**.

- GitHub-hosted runner reference: <https://docs.github.com/actions/reference/runners/github-hosted-runners>
- GitHub larger runners: <https://docs.github.com/en/actions/reference/runners/larger-runners>
- GitHub Actions billing: <https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions>
- GitHub custom images for larger runners: <https://docs.github.com/en/actions/how-tos/manage-runners/larger-runners/use-custom-images>
- GitHub dependency caching: <https://docs.github.com/en/actions/concepts/workflows-and-actions/dependency-caching>
- `actions/setup-node` cache behavior: <https://github.com/actions/setup-node>
- GitHub self-hosted runner security guidance: <https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/using-githubs-security-features-to-secure-your-use-of-github-actions>
- RunsOn Windows runners: <https://runs-on.com/runners/windows/>
- RunsOn caching: <https://runs-on.com/caching/s3-cache-for-github-actions/>

---

## Final Decision

If the goal is genuinely "I want at least once build fast", the best answer is:

**Use a managed self-hosted Windows release runner with a warm pool and a custom image.**

If the goal is:

**"I want the least operational complexity while still paying for a real improvement,"**

then use:

**GitHub larger runners with a custom Windows image.**

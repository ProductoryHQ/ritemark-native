# Sprint 24 CI/CD Review: Findings & Suggestions

**Source:** External best practices + local research review
**Date:** 2026-01-27

---

## Findings (Weaknesses / Gaps)

1. **Reusable workflow mismatch**
   - The plan shows `release.yml` calling `build-windows.yml` and `build-macos.yml` via `jobs.<job>.uses`. That only works if the build workflows declare `on: workflow_call`. The plan doesn’t mention adding `workflow_call`, so `release.yml` would fail immediately.

2. **Level 1 vs Level 2 scope conflicts**
   - `README.md` and `sprint-plan.md` treat PR validation as Level 1, while `research/02-cicd-architecture.md` and `03-technical-decisions.md` describe PR validation as Level 2 or optional. This creates a delivery ambiguity that will cause missed expectations or scope creep.

3. **Windows symlink failure not in checklist**
   - The pre‑mortem identifies Windows symlink breakage as a top‑10 failure, but the Phase 3 workflow checklist doesn’t include the Windows junction/symlink fix. This is likely to fail on the first Windows CI run.

4. **Version consistency gate missing**
   - The pre‑mortem proposes a tag ↔ package.json ↔ product.json version check, but it’s not in the Phase 3 workflow checklist. Without this, releases can be built and published with mismatched versions.

5. **Electron/native module ABI risk unaddressed**
   - The plan hardcodes Node 20 in CI but doesn’t include any step to rebuild native modules for Electron (if present) or pin the Node version to VS Code’s `.nvmrc`. This is a common cause of runtime crashes on Windows.

6. **Windows toolchain assumptions are not enforced**
   - The pre‑mortem highlights MSVC toolchain and Spectre-mitigated libs as common failures. The plan doesn’t include explicit MSVC setup or validation steps in the Windows workflow.

7. **Windows long‑path risk unaddressed**
   - The pre‑mortem recommends short checkout paths or enabling long paths. The plan doesn’t include either, which can cause flaky Windows builds.

8. **Artifact naming/paths are assumed, not enforced**
   - `release.yml` assumes artifact names and `dist/*.zip|*.dmg` paths but no explicit validation step ensures these names/paths remain consistent if build workflows change.

9. **Update service fixes lack a concrete test plan**
   - Update service changes are in scope and blocking for Windows, but the plan only mentions “manual future release testing.” This is a risk for the first Windows release.

---

## Suggestions (Best‑Practice Corrections / Mitigations)

1. **Make reuse explicit or inline builds**
   - **Option A:** Add `on: workflow_call` to `build-windows.yml` and `build-macos.yml` if `release.yml` will call them.
   - **Option B:** Keep `release.yml` as a standalone workflow with inline build jobs. This avoids reusable‑workflow coupling.

2. **Resolve Level 1/2 mismatch**
   - Decide whether PR validation is Level 1 or Level 2 and update all docs to match. If Level 1 includes PR validation, update `research/02-cicd-architecture.md` and `03-technical-decisions.md` accordingly.

3. **Add Windows symlink fix to Phase 3**
   - Add a Windows‑only step to recreate the `vscode/extensions/ritemark` junction or avoid symlinks entirely by copying the extension before build.

4. **Add version consistency gate**
   - Add a CI step that compares `GITHUB_REF` tag version against:
     - `extensions/ritemark/package.json`
     - `branding/product.json`
   - Fail early if mismatched.

5. **Align Node/Electron ABI**
   - If any native modules exist, add an Electron‑compatible rebuild step (or explicitly ensure builds match Electron headers). Alternatively, pin the Node version to VS Code’s `.nvmrc` in CI and log Electron/Node versions.

6. **Explicit Windows toolchain setup**
   - Add steps to ensure MSVC is configured and Python is present. If needed, explicitly install or validate Spectre‑mitigated libraries.

7. **Add Windows long‑path mitigation**
   - Use a short checkout path (e.g., `path: r`) and/or set `git config --system core.longpaths true` in the Windows workflow.

8. **Artifact validation in release job**
   - In `release.yml`, add a step that asserts expected filenames exist before creating the draft release. This prevents a “successful” release with missing artifacts.

9. **Define a concrete update‑service test**
   - Add a simple manual test checklist (or scripted check) for Windows update flow before first Windows release. Even a single end‑to‑end test (download ZIP, install, check update detection) reduces risk.

---

## References (Best‑Practice Sources)

- GitHub Actions reusable workflows: `on: workflow_call` is required for local workflow reuse.
- `actions/setup-node`: explicit Node version pinning is recommended.
- Electron native modules: native modules must match Electron’s ABI, not system Node.
- Git symlink behavior: `core.symlinks` controls symlink checkout (often false on Windows).
- Windows long paths: Git for Windows recommends short paths or enabling long paths to avoid failures.


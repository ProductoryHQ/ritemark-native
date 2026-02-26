# Sprint 39: Open Source Launch

## Goal

Implement all remaining action items to make the Ritemark repository ready to flip public, including legal files, community infrastructure, CI for pull requests, dependency audit, and contributor documentation.

---

## Context

The strategic analysis is complete (`docs/analysis/OPEN-SOURCE-STRATEGY.md`). All key decisions are locked:

- **License:** MIT, copyright Productory OÜ
- **Brand protection:** `TRADEMARK.md` and `branding/LICENSE` already in place
- **Contribution model:** DCO (Developer Certificate of Origin — no CLA paperwork)
- **Open source model:** Fully open, single maintainer (BDFL)
- **Git history:** Keep full history (no secrets ever committed)
- **GitHub org migration:** Out of scope for this sprint — separate decision

Research findings are in `docs/sprints/sprint-39-open-source/research/01-current-state.md`.

---

## Feature Flag Check

- [ ] Does this sprint need a feature flag?
  - No. This sprint adds documentation, CI workflows, and community infrastructure files. No user-facing runtime behavior changes. No flag needed.

---

## Success Criteria

- [ ] `LICENSE` file exists in repo root (MIT, copyright Productory OÜ, 2024-2026)
- [ ] `CODE_OF_CONDUCT.md` exists (Contributor Covenant v2.1)
- [ ] `SECURITY.md` exists with clear vulnerability reporting instructions
- [ ] `CONTRIBUTING.md` exists — human developer setup guide from clone to running app
- [ ] `.github/ISSUE_TEMPLATE/bug_report.md` exists
- [ ] `.github/ISSUE_TEMPLATE/feature_request.md` exists
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` exists
- [ ] `.github/workflows/pr-checks.yml` exists and runs TypeScript compile + patch dry-run on PRs
- [ ] Dependency license audit completed — no GPL/LGPL/AGPL dependencies found
- [ ] Hardcoded personal URLs in `README.md` audited and noted (org migration is separate)
- [ ] `README.md` updated with Contributing, Building from source, Community, and Acknowledgments sections
- [ ] 6+ good first issues identified from WISHLIST with descriptions suitable for GitHub issue filing
- [ ] GitHub Discussions categories documented for Jarmo to enable manually

---

## Deliverables

| Deliverable | Description |
|-------------|-------------|
| `LICENSE` | MIT license file, root of repo |
| `CODE_OF_CONDUCT.md` | Contributor Covenant v2.1, enforcement contact hello@productory.ai |
| `SECURITY.md` | Scope (extension code, patches, scripts — not VS Code core), reporting email, response time |
| `CONTRIBUTING.md` | Human developer guide: prerequisites, clone, patches, dev mode, extension dev, webview dev, what we merge and what we don't |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Bug report with OS, version, steps, expected vs actual |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Problem description, proposed solution, alternatives |
| `.github/PULL_REQUEST_TEMPLATE.md` | What changes, why, how to test, DCO sign-off reminder |
| `.github/workflows/pr-checks.yml` | Lightweight PR CI: TypeScript compile + patch dry-run (no full build) |
| Dependency audit notes | `docs/sprints/sprint-39-open-source/notes/dependency-audit.md` |
| Good first issues list | `docs/sprints/sprint-39-open-source/notes/good-first-issues.md` |
| Updated `README.md` | Add Contributing, Building, Community, Acknowledgments sections |

---

## Implementation Checklist

### Phase 1: Legal Files

- [ ] Create `LICENSE` — MIT license, `Copyright (c) 2024-2026 Productory OÜ`
- [ ] Create `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1, contact hello@productory.ai
- [ ] Create `SECURITY.md` — scope, reporting email, 48h acknowledgment SLA, out-of-scope (VS Code core)

### Phase 2: Contributor Documentation

- [ ] Create `CONTRIBUTING.md` with:
  - Prerequisites (Node 20, Git, macOS primary — Windows/Linux community)
  - Clone with submodules: `git clone --recurse-submodules`
  - Apply patches: `./scripts/apply-patches.sh`
  - Install VS Code deps: `cd vscode && npm install`
  - Install extension deps: `cd extensions/ritemark && npm install --legacy-peer-deps`
  - Run dev mode (reference the dev mode command, note it is macOS-targeted)
  - Extension development: always edit `extensions/ritemark/`, never `vscode/` directly
  - Webview development: `cd extensions/ritemark/webview && npm run build`
  - VS Code patches: `./scripts/create-patch.sh "description"`
  - Compile check: `cd extensions/ritemark && npx tsc --noEmit`
  - DCO sign-off: `git commit -s`
  - Contribution guidelines and what will not be merged (no telemetry, no cloud dependencies, no breaking local-first principle)
  - Note on AI-assisted development workflow and what `.claude/` is

### Phase 3: GitHub Templates

- [ ] Create `.github/ISSUE_TEMPLATE/bug_report.md`
- [ ] Create `.github/ISSUE_TEMPLATE/feature_request.md`
- [ ] Create `.github/PULL_REQUEST_TEMPLATE.md` (include DCO `Signed-off-by:` reminder)

### Phase 4: PR CI Workflow

- [ ] Create `.github/workflows/pr-checks.yml`:
  - Trigger: `pull_request` targeting `main`
  - Node 20 setup
  - Extension TypeScript compile: `cd extensions/ritemark && npx tsc --noEmit`
  - Patch dry-run: `./scripts/apply-patches.sh --dry-run` (verify patches still apply cleanly)
  - Runtime: target under 5 minutes (no full VS Code build)

### Phase 5: Audit and Research Notes

- [ ] Run dependency audit and document in `notes/dependency-audit.md`:
  - Check `extensions/ritemark/package.json` dependencies for GPL/LGPL/AGPL
  - Note: `npx license-checker --summary` command for Jarmo to run in `extensions/ritemark/`
  - Document known-safe licenses (MIT, Apache 2.0) from preliminary audit
- [ ] Document `good-first-issues.md` with 6+ candidates from WISHLIST, each with:
  - Issue title
  - File(s) to modify (where known)
  - Why it is a good first issue
  - Acceptance criteria

### Phase 6: README Update

- [ ] Add **Contributing** section (link to `CONTRIBUTING.md`)
- [ ] Add **Building from Source** section (quick start: clone → patches → compile → dev)
- [ ] Add **Community** section (GitHub Discussions, GitHub Issues)
- [ ] Add **Acknowledgments** section (VS Code OSS MIT, TipTap MIT, Orama Apache 2.0, OpenAI SDK Apache 2.0)
- [ ] Add note about AI-assisted development (Claude Code, `.claude/` directory)
- [ ] Note the download URL situation — keep `jarmo-productory/ritemark-public` links for now (org migration is a separate decision); add a TODO comment in the plan

### Phase 7: Manual Steps for Jarmo (documented, not automated)

- [ ] Document GitHub Discussions setup in notes: Settings > Features > Discussions, three categories (General, Ideas, Show & Tell)
- [ ] Document branch protection setup: require PRs, require CI to pass, no force push to main
- [ ] Document GitHub Sponsors setup (optional, for sustainability)
- [ ] Document how to apply `good first issue` and `help wanted` labels to GitHub issues after repo goes public

---

## Files Changed Summary

| File | Action |
|------|--------|
| `LICENSE` | New |
| `CODE_OF_CONDUCT.md` | New |
| `SECURITY.md` | New |
| `CONTRIBUTING.md` | New |
| `.github/ISSUE_TEMPLATE/bug_report.md` | New |
| `.github/ISSUE_TEMPLATE/feature_request.md` | New |
| `.github/PULL_REQUEST_TEMPLATE.md` | New |
| `.github/workflows/pr-checks.yml` | New |
| `README.md` | Updated |
| `docs/sprints/sprint-39-open-source/notes/dependency-audit.md` | New |
| `docs/sprints/sprint-39-open-source/notes/good-first-issues.md` | New |

No changes to `extensions/ritemark/src/`, `vscode/`, or `patches/`. This sprint is documentation and infrastructure only.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PR CI workflow fails due to VS Code patch system complexity | Medium | Use `--dry-run` flag, not actual patch application; test workflow syntax before merging |
| `npx license-checker` finds an unexpected GPL dependency | Low | Dependencies are well-known (MIT/Apache stack); manual review of any flagged packages |
| CONTRIBUTING.md setup guide becomes outdated | Medium | Keep instructions minimal and script-based; link to scripts rather than inline commands |
| README download links break after eventual org migration | Expected | Leave as-is with note; org migration is a separate sprint |

---

## Out of Scope (This Sprint)

- GitHub org migration (`jarmo-productory` → `ritemark` org)
- Linux build CI
- Cross-platform CI (full Windows/macOS builds on PR — too slow for PR feedback)
- Announcement blog post (product-marketer sprint)
- GitHub Sponsors setup (Jarmo does manually)
- Flipping repo to public (Jarmo does manually after this sprint is complete and verified)
- Homebrew cask (separate sprint in WISHLIST)

---

## Release Type

This sprint produces no changes to `extensions/ritemark/src/` or VS Code core. It is infrastructure/documentation only. No release is needed for this sprint's deliverables — they take effect when the repo is made public.

---

## Status

**Current Phase:** 3 (DEVELOP)
**Approval Required:** No — Jarmo approved, proceeding with implementation

---

## Approval

- [x] Jarmo approved this sprint plan
  - Approval: "okei alustame siis sprindiga" (2026-02-26)

# Ritemark Open Source Strategy

**Date:** February 25, 2026
**Author:** Jarmo + Claude
**Status:** Strategy proposal — needs Jarmo's review and approval

---

## Why Open Source

Your reasoning is spot-on. Let's be explicit about it:

1. **Trust requires transparency.** A single-developer markdown editor that handles people's writing, AI API keys, and file system access is asking for a lot of trust. Open source lets anyone verify what the code actually does. "Trust me" doesn't scale. "Read the code" does.

2. **Closed source is a dead end.** With coding agents (Claude Code, Codex, Gemini CLI) able to clone and replicate any product in hours, the only sustainable moat is community, brand, and ecosystem — not hidden code. A determined competitor can rebuild Ritemark's features in a weekend. They can't rebuild a community.

3. **Contribution accelerates everything.** You're one person. Open source gives you leverage. Even a few contributors fixing Windows bugs, adding languages, or improving the editor compounds over time.

4. **Users become invested.** When people can file issues, submit PRs, and see their contributions in releases, they develop ownership. That emotional investment is more durable than any feature moat.

5. **The architecture already supports it.** Ritemark is BYOK (users bring their own API keys), has zero telemetry, stores nothing in the cloud, and uses MIT-licensed foundations. There's no server-side revenue to protect. The code is already structured as if it were open source.

---

## Current State Assessment

### What's Already Open-Source-Ready

| Aspect | Status | Notes |
|--------|--------|-------|
| License | MIT declared everywhere | product.json, package.json, README |
| Revenue model | BYOK (no server) | No revenue to protect — users pay OpenAI/Anthropic/Google directly |
| Telemetry | Zero | No tracking, no analytics, no phone-home |
| Secrets in code | None found | API keys in OS keychain via SecretStorage |
| Architecture | Clean separation | VS Code submodule + patches + extension |
| Build system | GitHub Actions CI/CD | macOS x64 + Windows builds already automated |
| Documentation | 315+ docs | Extensive sprint history, feature guides, analysis docs |

### What's Missing

| Gap | Severity | Effort |
|-----|----------|--------|
| No LICENSE file in repo root | Critical | 5 minutes |
| No CONTRIBUTING.md | Critical | 1-2 hours |
| No CODE_OF_CONDUCT.md | Important | 30 minutes |
| No SECURITY.md | Important | 30 minutes |
| No issue/PR templates | Important | 1 hour |
| No developer setup guide | Important | 2-3 hours |
| "jarmo-productory" hardcoded in URLs | Moderate | 1 hour |
| No architecture overview for contributors | Moderate | 2 hours |
| ~~Branding assets unclear license~~ | ~~Moderate~~ | **DONE** — `TRADEMARK.md` + `branding/LICENSE` |
| Code signing certs are personal | Expected | Not an issue — maintainer signs releases |
| No CLA or DCO decision | Moderate | Decision needed |

---

## The Big Decision: What Kind of Open Source?

This is the most important strategic choice. There are three models that make sense for Ritemark:

### Option A: Fully Open, Single Maintainer (Recommended)

**Model:** Everything on GitHub, MIT license, you remain the benevolent dictator (BDFL). Community contributes, you merge.

**Examples:** Sublime Merge, Helix editor, Zed (early days), many VS Code extensions

**How it works:**
- All code on `jarmo-productory/ritemark-native` (public)
- MIT license — anyone can fork, modify, distribute
- You review and merge all PRs
- You make all product decisions
- You sign and distribute official releases
- Community can fork and build their own, but the "official" Ritemark is yours

**Pros:**
- Maximum trust and transparency
- Simplest to execute (just flip the repo to public)
- Community can contribute immediately
- No organizational overhead
- Your existing governance (CLAUDE.md, sprint system) stays intact

**Cons:**
- You bear the maintenance burden of community management
- Someone could fork and compete (but this is unlikely if you maintain momentum)

**Sustainability:**
- GitHub Sponsors / Open Collective for donations
- Optional premium features via feature flags (already infrastructure in place)
- Consulting / custom integrations
- Potential Setapp distribution for "managed" version

### Option B: Open Core

**Model:** Core editor is open source, advanced features (Flows, Agent, future premium features) are proprietary.

**Examples:** GitLab, Supabase, Posthog

**How it works:**
- Core markdown editor: MIT (open)
- Flows, Agent, RAG: proprietary or delayed-open (Business Source License)
- Two repos or a monorepo with license boundaries

**Pros:**
- Protects the most differentiated features
- Clear monetization path
- Can offer hosted/managed versions later

**Cons:**
- Splits the codebase and community trust
- Harder to maintain two license boundaries in one extension
- Contradicts your stated goal ("they need to be able to control it")
- Flows/Agent are what makes Ritemark unique — hiding them defeats the purpose
- Community will contribute less if the interesting parts are closed

**Verdict: Not recommended.** Your stated goal is trust, not revenue protection. Open core sends mixed signals.

### Option C: Source-Available with Delayed Open Source

**Model:** Code is visible but not fully open. After a time delay (e.g., 12 months), code becomes MIT.

**Examples:** MariaDB (BSL), Sentry, Hashicorp

**Pros:**
- Competitors can't immediately clone and redistribute
- Code is auditable for trust
- Eventually becomes fully open

**Cons:**
- Confusing for contributors (can I fork this or not?)
- Doesn't build community the same way
- Legal complexity
- Overkill for a desktop editor with no server-side value

**Verdict: Not recommended.** You're not protecting a SaaS revenue stream. The complexity isn't worth it.

### Recommendation: Option A

Go fully open. MIT. Single maintainer. The architecture already supports it, the revenue model (BYOK) doesn't depend on closed code, and your stated values align perfectly with full transparency.

---

## Repository Strategy

### Current State

```
jarmo-productory/ritemark-native  (private, development repo)
jarmo-productory/ritemark-public  (public, releases only — DMG/exe downloads)
```

### Proposed Future State

```
jarmo-productory/ritemark-native  →  ritemark/ritemark  (public, main repo)
jarmo-productory/ritemark-public  →  redirect to ritemark/ritemark releases
```

### The Organization Question

**Option 1: Keep under `jarmo-productory`**
- Simpler, no migration
- But looks like a personal project, not a community one

**Option 2: Create `ritemark` GitHub organization (Recommended)**
- Professional appearance
- Allows adding maintainers later without sharing personal account
- Separate branding from personal identity
- Can have `ritemark/ritemark` (main), `ritemark/website`, `ritemark/homebrew-tap`

**Migration path:**
1. Create `ritemark` GitHub org
2. Transfer `ritemark-native` repo to org, rename to `ritemark`
3. GitHub auto-redirects all old URLs
4. Update `product.json` URLs, CI/CD, download links
5. Archive `ritemark-public` with a pointer to the main repo

---

## What Needs to Happen (Execution Plan)

### Phase 1: Legal & Governance Foundation (Week 1)

#### 1.1 Add LICENSE file
Create a proper MIT LICENSE file in the repo root. The README says MIT, product.json says MIT, but there's no actual LICENSE file.

```
MIT License

Copyright (c) 2026 Jarmo Tuisk

Permission is hereby granted, free of charge, to any person obtaining a copy...
```

**Decision: Productory OÜ** — The Ritemark brand is owned by Productory and permitted for use only in this OSS project. See `TRADEMARK.md` and `branding/LICENSE` for enforcement.

#### 1.2 Choose a contribution model

**Option A: DCO (Developer Certificate of Origin) — Recommended**
- Contributors add `Signed-off-by:` to commits
- Lightweight, no legal paperwork
- Used by Linux kernel, Git, many large projects
- Confirms contributor has the right to submit the code

**Option B: CLA (Contributor License Agreement)**
- Contributors sign a legal document
- Gives you broader rights (e.g., relicense later)
- More friction for contributors
- Used by Google, Meta, Apache projects

Recommendation: DCO. It's lighter, friendlier for a small project, and you're already MIT-licensed so relicensing isn't a concern.

#### 1.3 Add CODE_OF_CONDUCT.md

Use the Contributor Covenant v2.1 (industry standard). It signals "this is a welcoming project" without being heavy-handed. Enforcement contact: your email or a project email.

#### 1.4 Add SECURITY.md

Define how to report security vulnerabilities:
- Email for private reports (security@ritemark.app or your personal email)
- What counts as a security issue (API key leaks, XSS in webview, file system access bugs)
- Response time commitment (e.g., "I'll acknowledge within 48 hours")
- Scope: the Ritemark extension code, patches, and build scripts (not VS Code core — report those upstream)

### Phase 2: Developer Experience (Week 1-2)

#### 2.1 Write CONTRIBUTING.md

This is the most important file for open source. It should cover:

**Getting started:**
- Prerequisites (Node 20, macOS/Windows/Linux, git)
- Clone, setup, build, run dev mode
- How the VS Code submodule + patches work
- How the extension is structured

**Development workflow:**
- How to make changes to the extension (edit `extensions/ritemark/`)
- How to make changes to VS Code (create a patch)
- How to test changes (dev mode, production build)
- How to run the webview in development

**Contribution guidelines:**
- Open an issue before large changes
- Keep PRs focused and small
- Follow existing code style
- All VS Code changes must be patches (never direct submodule edits)

**What we're looking for help with:**
- Windows testing and fixes
- Linux support
- Accessibility improvements
- Localization (i18n)
- Documentation improvements
- Bug reports with reproduction steps

**What we probably won't merge:**
- Changes to core product direction without discussion
- Features that add external service dependencies
- Telemetry or tracking
- Features that break offline/local-first principle

#### 2.2 Create developer setup guide

A step-by-step from clone to running app. Currently this knowledge lives in CLAUDE.md (which is an AI governance doc, not a human developer guide).

```
1. Clone with submodules
2. Apply patches
3. Install dependencies
4. Compile extension
5. Run dev mode
6. Make changes
7. Test
```

#### 2.3 Add issue and PR templates

`.github/ISSUE_TEMPLATE/bug_report.md`:
- OS, version, steps to reproduce, expected vs actual

`.github/ISSUE_TEMPLATE/feature_request.md`:
- Problem description, proposed solution, alternatives considered

`.github/PULL_REQUEST_TEMPLATE.md`:
- What this changes, why, how to test, screenshots if UI

#### 2.4 Add `good first issue` labels

Identify 5-10 starter issues from the WISHLIST. Examples from your current list:
- "Custom Welcome tab icon" (Windows)
- "Columns have no max-width in Data Editor"
- "CSV row deletion with context menu"
- "Recent files list on welcome page"

These give new contributors a clear entry point.

### Phase 3: Code Cleanup & Audit (Week 2-3)

#### 3.1 Audit for hardcoded personal references

Search and update:
- `jarmo-productory` in URLs → new org URL (or keep if not migrating)
- Any personal paths in scripts (`/Users/jarmotuisk/...`) → make relative
- Email addresses that should be project-level

#### 3.2 Audit branding assets — DONE

**Resolved:** Brand assets are owned by Productory OÜ, **all rights reserved** (not MIT, not CC).
- `branding/LICENSE` — restricts use to official Ritemark project only
- `TRADEMARK.md` — full trademark policy (forks must rebrand)
- Fonts and theme still need audit for third-party licenses

#### 3.3 Clean up internal documentation

Some docs reference internal sprint processes that assume the Claude agent system. This is fine to leave — it's actually interesting for the community to see how the project was built. But add a note:

```
> Note: This project uses Claude Code as an AI development assistant.
> The .claude/ directory contains agent configurations used during development.
> These are not required for contributing — they're part of the development workflow.
```

#### 3.4 Audit dependencies for license compatibility

Quick scan needed:
- `extensions/ritemark/package.json` dependencies — all MIT/Apache/BSD compatible?
- VS Code OSS itself is MIT
- TipTap is MIT
- Orama is Apache 2.0
- OpenAI SDK is Apache 2.0
- Key risk areas: any copyleft (GPL) dependencies that would infect the MIT license

Generate a license report: `npx license-checker --summary` in the extension directory.

### Phase 4: Repository Preparation (Week 3)

#### 4.1 Decide on git history

**Option A: Keep full history (Recommended)**
- Shows the real development story
- 19.5 sprints of context
- No secrets were ever committed (BYOK model, keys in keychain)
- The Claude-assisted development history is actually a unique selling point

**Option B: Squash to clean history**
- Hides the messy early commits
- Loses context
- Only worth it if there are secrets in history (there aren't)

Recommendation: Keep full history. It's authentic and there's nothing to hide.

#### 4.2 Set up branch protection

On the main branch:
- Require PR reviews (even if you're the only reviewer initially)
- Require CI to pass
- No force pushes to main
- This signals professionalism and protects against accidents

#### 4.3 Enhance CI/CD for contributors

Current GitHub Actions only trigger on `v*` tags. Add:
- **PR checks:** Build + lint on every PR
- **Cross-platform CI:** macOS arm64 (already have x64), Windows, Linux
- **Extension compilation check:** `npx tsc --noEmit` on PRs
- **Webview build check:** Ensure `media/webview.js` builds correctly

#### 4.4 Add Linux support consideration

Ritemark currently targets macOS and Windows. Linux is the obvious next platform for an open-source project, and Linux users are disproportionately likely to contribute.

Current blockers:
- VS Code OSS builds for Linux (already supported upstream)
- Voice dictation is macOS-only (fine — feature flag handles this)
- Code signing doesn't apply
- Need to test: patches apply cleanly for Linux build

This could be a great "community-driven" goal — invite Linux contributors to help bring it up.

### Phase 5: Launch (Week 3-4)

#### 5.1 Flip the repository to public

The actual moment of going open source. Before flipping:
- [ ] LICENSE file exists
- [ ] CONTRIBUTING.md exists
- [ ] CODE_OF_CONDUCT.md exists
- [ ] SECURITY.md exists
- [ ] Issue/PR templates exist
- [ ] README updated with contribution section
- [ ] No secrets in git history (verified)
- [ ] CI runs on PRs
- [ ] Branding license clarified
- [ ] Dependencies audited

#### 5.2 Update README for open source

Add sections:
- **Contributing** — link to CONTRIBUTING.md
- **Building from source** — quick start
- **Community** — where to discuss (GitHub Discussions?)
- **Roadmap** — link to ROADMAP.md and WISHLIST.md
- **Acknowledgments** — VS Code OSS, TipTap, and key dependencies
- Remove or update the download links to point to the main repo's releases

#### 5.3 Write an announcement

A blog post / GitHub discussion explaining:
- Why you're going open source
- Your vision for Ritemark
- How people can get involved
- What kinds of contributions you're looking for
- Your commitment to the project

This is also a marketing moment. Post to:
- Hacker News (Show HN)
- Reddit (r/opensource, r/markdown, r/vscode)
- Twitter/X
- Product Hunt (optional, but good for visibility)

#### 5.4 Enable GitHub Discussions

As a lightweight community forum:
- General (Q&A, introductions)
- Ideas (feature requests that aren't issues yet)
- Show & Tell (people sharing their workflows)

This is less overhead than Discord/Slack and keeps everything in GitHub.

---

## Sustainability & Business Model

Going open source doesn't mean giving up revenue. Here's how other open-source desktop apps sustain themselves:

### Tier 1: Donations & Sponsorship (Easiest)

- **GitHub Sponsors:** Enable on your profile/org
- **Open Collective:** For organizational transparency
- Expected: $50-500/month if you build a modest community
- Examples: Helix editor, many VS Code extension authors

### Tier 2: Premium Features via Feature Flags (Already Built)

Your feature flag system already has a `premium` status that returns false. You could gate future advanced features:

| Free (Open Source) | Premium (Paid) |
|-------------------|----------------|
| Text editor (full) | Advanced Flow templates |
| Data editor (full) | Priority support |
| Basic Flows | Commercial license (for embedding) |
| AI Assistant (BYOK) | |
| Voice dictation | |
| Export (PDF/Word) | |

**Important:** Keep the current features free forever. Only gate *new* premium features. Breaking trust by paywalling existing features would be catastrophic.

The premium check could be:
- A simple license key (validated locally, no server needed)
- Gumroad / LemonSqueezy for key generation
- Honor system ("pay if you use it commercially")

### Tier 3: Managed Distribution

- **Setapp:** Already researched. Passive revenue from Setapp subscribers.
- **Mac App Store:** Higher friction but reaches non-technical users
- **Homebrew Cask:** Free, but raises visibility

### Tier 4: Services (Future)

- Hosted Flows (run AI workflows in the cloud)
- Team collaboration features
- Custom integrations for businesses

**Recommendation:** Start with Tier 1 (GitHub Sponsors). Add Tier 2 only when you have features worth charging for. Don't over-monetize early — community growth is more valuable than early revenue.

---

## Community Building Strategy

### Governance Model: BDFL (Benevolent Dictator For Life)

You make all final decisions. This is appropriate for a young project with a clear vision. Formal governance (steering committees, voting) is premature and would slow you down.

Document this clearly:
> Ritemark is maintained by Jarmo Tuisk. I welcome contributions, ideas, and feedback.
> For major decisions about project direction, I have final say. For everything else,
> the best idea wins regardless of who suggests it.

### Growing Contributors

**Phase 1 (Month 1-3): Seeds**
- 5-10 `good first issue` items
- Fast PR review turnaround (< 48 hours)
- Personal thank-you to every contributor
- Mention contributors in release notes

**Phase 2 (Month 3-6): Growth**
- Identify repeat contributors
- Give trusted contributors triage permissions
- Start delegating review of docs/minor PRs
- Monthly "what's happening" update post

**Phase 3 (Month 6+): Sustainability**
- Consider 1-2 co-maintainers for specific areas (e.g., Windows, Data Editor)
- Establish a regular release cadence community can rely on
- Community-driven features (Linux support, i18n, accessibility)

### Communication Channels

| Channel | Purpose | Overhead |
|---------|---------|----------|
| GitHub Issues | Bugs, feature requests | Low (already have) |
| GitHub Discussions | Community Q&A, ideas | Low |
| GitHub Releases | Announcements | Low (already have) |
| Blog (ritemark.app) | Major updates, tutorials | Medium |
| Discord / Matrix | Real-time chat | High (only if community demands it) |

Start with GitHub-native tools only. Add Discord/Matrix only when there's actual demand.

---

## Risk Analysis

### Risk: Someone forks and competes

**Likelihood:** Low-medium
**Impact:** Low
**Mitigation:** Your brand, momentum, community, and product vision are the moat. Forks rarely succeed unless the original project is abandoned or hostile. Stay active and responsive.

### Risk: Toxic community interactions

**Likelihood:** Medium (as project grows)
**Impact:** Medium
**Mitigation:** CODE_OF_CONDUCT.md, clear contribution guidelines, willingness to block/ban bad actors. Set the tone early.

### Risk: Maintenance burden overwhelms solo developer

**Likelihood:** Medium-high
**Impact:** High
**Mitigation:**
- Be honest about bandwidth ("I review PRs on weekends")
- Use "good first issue" and "help wanted" to direct energy
- Say no to scope creep politely
- Grow co-maintainers for specific areas

### Risk: Security vulnerability in a release

**Likelihood:** Low (no server, no network services)
**Impact:** High (reputation)
**Mitigation:** SECURITY.md, quick response process, ability to push hotfix releases. The BYOK model limits blast radius — worst case is a local file system issue, not a data breach.

### Risk: Contributor submits malicious code

**Likelihood:** Very low
**Impact:** High
**Mitigation:** All PRs require your review. CI checks. Code signing on official releases means users trust the signed build, not arbitrary forks.

### Risk: License confusion with VS Code components

**Likelihood:** Low
**Impact:** Medium
**Mitigation:** VS Code OSS is MIT. Your patches are MIT. Clear LICENSE file. The only risk is if Microsoft's trademarks are used (they shouldn't be — you've already rebranded everything to "Ritemark").

---

## The Claude Development Story

Here's something unique: Ritemark was built with AI-assisted development (Claude Code). The `.claude/` directory, the sprint docs, the agent system — this is a real-world example of human+AI collaboration.

**Recommendation: Don't hide this. Celebrate it.**

- It's a great story for the announcement
- Developers are curious about AI-assisted workflows
- The sprint documentation shows a transparent development process
- It could attract contributors who want to learn this workflow

Add a section in the README or a dedicated doc:
> Ritemark is built using AI-assisted development with Claude Code.
> The `.claude/` directory contains the agent configurations and the `docs/sprints/`
> directory has the full development history. You don't need Claude Code to contribute,
> but it's a core part of how the project is developed.

---

## Immediate Action Items (Sorted by Priority)

| # | Action | Effort | Blocks |
|---|--------|--------|--------|
| 1 | ~~Decide: copyright holder~~ | **DONE** | Productory OÜ |
| 2 | Decide: GitHub org vs personal account | Decision | Repo migration |
| 3 | Add LICENSE file | 5 min | Going public |
| 4 | Add CODE_OF_CONDUCT.md | 30 min | Going public |
| 5 | Add SECURITY.md | 30 min | Going public |
| 6 | Write CONTRIBUTING.md | 2 hours | Going public |
| 7 | Add issue/PR templates | 1 hour | Going public |
| 8 | Create developer setup guide | 2 hours | Contributions |
| 9 | Audit dependencies for license compatibility | 1 hour | Going public |
| 10 | Audit for hardcoded personal paths/URLs | 1 hour | Going public |
| 11 | ~~Clarify branding asset license~~ | **DONE** | `TRADEMARK.md` + `branding/LICENSE` |
| 12 | Update README with open-source sections | 1 hour | Going public |
| 13 | Add PR-triggered CI checks | 2 hours | Contributions |
| 14 | Identify 5-10 good first issues | 1 hour | Community |
| 15 | Enable GitHub Sponsors | 30 min | Sustainability |
| 16 | Write announcement blog post | 2 hours | Launch |
| 17 | Enable GitHub Discussions | 10 min | Community |
| 18 | Flip repo to public | 5 min | All above |

**Total estimated effort:** ~15-20 hours of focused work, spread over 2-3 weeks.

---

## Timeline

| Week | Focus | Milestone |
|------|-------|-----------|
| 1 | Legal foundation + decisions | LICENSE, CoC, SECURITY, CONTRIBUTING draft |
| 2 | Developer experience + audit | Setup guide, templates, dependency audit, code cleanup |
| 3 | CI/CD + final prep | PR checks, README update, branding license, final review |
| 4 | Launch | Flip to public, announcement, community seeding |

---

## One Last Thing

The most important part of going open source isn't the LICENSE file or the CONTRIBUTING.md. It's your continued presence and responsiveness. A well-documented project with an absent maintainer dies. A messy project with a responsive maintainer thrives.

Your 19.5 sprints of consistent work already demonstrate commitment. Keep showing up, and the community will form around you.

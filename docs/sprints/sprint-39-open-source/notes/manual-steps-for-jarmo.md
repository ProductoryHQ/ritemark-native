# Manual Steps for Jarmo

Things that cannot be automated and need to be done by hand in GitHub after this sprint is merged.

---

## 1. Enable GitHub Discussions

**Where:** Repository Settings > Features > Discussions

**Categories to create:**

| Category | Format | Description |
|----------|--------|-------------|
| General | Discussion | Q&A, introductions, getting help |
| Ideas | Discussion | Feature requests not yet filed as issues |
| Show & Tell | Discussion | Workflows, use cases, integrations users have built |

---

## 2. Set Up Branch Protection

**Where:** Repository Settings > Branches > Add branch protection rule

**Branch name pattern:** `main`

**Recommended settings:**
- [x] Require a pull request before merging
- [x] Require status checks to pass before merging (select "PR Checks" workflow)
- [x] Do not allow force pushes
- [ ] Require approvals (optional — as sole maintainer, you may want to skip this)

---

## 3. File Good First Issues

See `docs/sprints/sprint-39-open-source/notes/good-first-issues.md` for 7 pre-written issues.

**Steps:**
1. Go to GitHub Issues > New Issue
2. Copy title and description from each entry
3. Add labels: `good first issue`, `help wanted`, plus topic labels
4. Create topic labels if they don't exist: `data-editor`, `text-editor`, `export`, `windows`

---

## 4. Flip Repository to Public

**Where:** Repository Settings > Danger Zone > Change repository visibility

**Pre-flight checklist:**
- [ ] All sprint 39 files are merged to `main`
- [ ] `LICENSE` file exists at repo root
- [ ] `CODE_OF_CONDUCT.md` exists
- [ ] `SECURITY.md` exists
- [ ] `CONTRIBUTING.md` exists
- [ ] No secrets in git history (API keys, passwords, etc.)
- [ ] Download links in README are correct
- [ ] `.github/workflows/pr-checks.yml` exists

---

## 5. GitHub Sponsors (Optional)

**Where:** https://github.com/sponsors

This is optional but provides a way for the community to support development financially.

**Steps:**
1. Go to your GitHub profile > Sponsors
2. Set up a sponsors profile
3. Choose tier structure (or use defaults)
4. A "Sponsor" button will appear on the repository

---

## 6. Update Download Links (When Ready)

The README currently points to `jarmo-productory/ritemark-public` for downloads. When/if you migrate to a `ritemark` org or change the release repository, update these lines in `README.md`:

```
https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark.dmg
https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-Setup.exe
```

This is tracked separately from this sprint.

---

## 7. Social Announcement (Optional)

Consider announcing the open-source launch on:
- GitHub Discussions (first post in "General")
- Twitter / X
- Hacker News (Show HN)
- Reddit (r/opensource, r/vscode)

The `product-marketer` agent can help prepare announcement content when you're ready.

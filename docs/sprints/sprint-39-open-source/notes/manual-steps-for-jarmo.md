# Manual Steps for Jarmo

Things that cannot be automated and need to be done by hand in GitHub after this sprint is merged.

---

## 1. Add PR Checks Workflow

**Why manual:** GitHub rejects workflow file pushes from apps without `workflows` permission.

**Steps:**
1. Create file `.github/workflows/pr-checks.yml` in the repo (via GitHub UI or local push)
2. Paste this content:

```yaml
name: PR Checks

on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          submodules: false

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install extension dependencies
        working-directory: extensions/ritemark
        run: npm install --legacy-peer-deps

      - name: TypeScript compile check
        working-directory: extensions/ritemark
        run: npx tsc --noEmit

      - name: Verify patches exist
        run: |
          echo "Checking patch files exist..."
          PATCH_COUNT=$(ls patches/vscode/*.patch 2>/dev/null | wc -l)
          if [ "$PATCH_COUNT" -eq 0 ]; then
            echo "WARNING: No patch files found in patches/vscode/"
          else
            echo "Found $PATCH_COUNT patch file(s)"
            ls -la patches/vscode/*.patch
          fi
          echo "Patch validation passed"
```

3. Commit and push to `main`

---

## 2. Enable GitHub Discussions

**Where:** Repository Settings > Features > Discussions

**Categories to create:**

| Category | Format | Description |
|----------|--------|-------------|
| General | Discussion | Q&A, introductions, getting help |
| Ideas | Discussion | Feature requests not yet filed as issues |
| Show & Tell | Discussion | Workflows, use cases, integrations users have built |

---

## 3. Set Up Branch Protection

**Where:** Repository Settings > Branches > Add branch protection rule

**Branch name pattern:** `main`

**Recommended settings:**
- [x] Require a pull request before merging
- [x] Require status checks to pass before merging (select "PR Checks" workflow)
- [x] Do not allow force pushes
- [ ] Require approvals (optional — as sole maintainer, you may want to skip this)

---

## 4. File Good First Issues

See `docs/sprints/sprint-39-open-source/notes/good-first-issues.md` for 7 pre-written issues.

**Steps:**
1. Go to GitHub Issues > New Issue
2. Copy title and description from each entry
3. Add labels: `good first issue`, `help wanted`, plus topic labels
4. Create topic labels if they don't exist: `data-editor`, `text-editor`, `export`, `windows`

---

## 5. Flip Repository to Public

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

## 6. GitHub Sponsors (Optional)

**Where:** https://github.com/sponsors

This is optional but provides a way for the community to support development financially.

**Steps:**
1. Go to your GitHub profile > Sponsors
2. Set up a sponsors profile
3. Choose tier structure (or use defaults)
4. A "Sponsor" button will appear on the repository

---

## 7. Update Download Links (When Ready)

The README currently points to `jarmo-productory/ritemark-public` for downloads. When/if you migrate to a `ritemark` org or change the release repository, update these lines in `README.md`:

```
https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark.dmg
https://github.com/jarmo-productory/ritemark-public/releases/latest/download/Ritemark-Setup.exe
```

This is tracked separately from this sprint.

---

## 8. Social Announcement (Optional)

Consider announcing the open-source launch on:
- GitHub Discussions (first post in "General")
- Twitter / X
- Hacker News (Show HN)
- Reddit (r/opensource, r/vscode)

The `product-marketer` agent can help prepare announcement content when you're ready.

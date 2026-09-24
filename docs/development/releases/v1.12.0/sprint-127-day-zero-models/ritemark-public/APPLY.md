# Applying the model-catalog publisher to ritemark-public

This folder mirrors the layout of `jarmo-productory/ritemark-public`. Sprint 127 had no push access to that repository, so the publisher (R4) ships here as a ready-to-apply payload. Once applied, ritemark-public owns it. This `APPLY.md` is not copied.

## 1. Copy the files

From the ritemark-native root:

```bash
SRC=docs/development/releases/v1.12.0/sprint-127-day-zero-models/ritemark-public
DST=<path to your ritemark-public checkout>
mkdir -p "$DST/.github/workflows" "$DST/scripts/model-catalog/fixtures"
cp "$SRC"/.github/workflows/model-catalog-*.yml "$DST/.github/workflows/"
cp "$SRC"/scripts/model-catalog/*.mjs "$DST/scripts/model-catalog/"
cp "$SRC"/scripts/model-catalog/fixtures/*.json "$DST/scripts/model-catalog/fixtures/"
cp "$SRC"/feeds/model-catalog.config.json "$SRC"/feeds/README.md "$DST/feeds/"
```

## 2. Replace the feed with the current lineup

The published feed dates from 2026-07-25 and is older than the lineup built into the app, so current apps ignore it. Regenerate it right before you commit so that `updatedAt` is current:

```bash
cd extensions/ritemark
npx tsx scripts/export-bundled-model-catalog.ts --merge "$DST/feeds/model-catalog.json" > /tmp/model-catalog.json
cp /tmp/model-catalog.json "$DST/feeds/model-catalog.json"
```

`$SRC/feeds/model-catalog.json` is the same document generated on 2026-09-24, for review.

## 3. Check and commit

```bash
cd "$DST"
node --test 'scripts/model-catalog/*.test.mjs'   # Node 22; no dependencies
node scripts/model-catalog/validate.mjs
git add .github/workflows/model-catalog-*.yml scripts/model-catalog feeds
git commit -m "feat(model-catalog): automatic publishing of new Anthropic models"
git push origin main
```

## 4. Repository settings (GitHub → ritemark-public → Settings)

1. **Secret** `MODEL_CATALOG_ANTHROPIC_API_KEY` (Secrets and variables → Actions → Secrets). Create a dedicated workspace in the Anthropic Console with a small monthly spend limit, and create a key in it. Do not reuse a personal key.
2. **Branch rules.** If `main` is protected, allow GitHub Actions to push to it (ruleset bypass). Otherwise the publisher's push is rejected and the run fails.
3. **Workflow permissions** (Actions → General). The workflow asks for `contents: write` itself. If an organization policy forces read-only tokens, allow read and write.

## 5. Dry run, then switch on

1. Go to Actions → **Model catalog autopublish** → Run workflow and tick **dry run**. The expected log line is `claude-opus-5-5: canary passed on Claude Code 2.1.270`, followed by `Dry run: would add claude-opus-5-5`. If Opus 5.5 is not a candidate, compare its `created_at` with the `watermark` in `feeds/model-catalog.config.json`.
2. **Variable** `MODEL_CATALOG_AUTOPUBLISH` = `on` (Secrets and variables → Actions → Variables).
3. The next scheduled run, within about 10 minutes, commits `feed(model-catalog): auto-add claude-opus-5-5` as github-actions[bot]. This is the pipeline's live acceptance test (S16). Record the commit link and the timing in the sprint's `qa-evidence.md`.

## Release gate

Ship the Ritemark 1.12.0 client only after step 5.3 has happened. Subscription users who also saved an API key stop getting the key-based model list in 1.12.0 (R2), so the feed must already carry the new model when they update.

# Model catalog feed

`model-catalog.json` lists the AI models that Ritemark shows in its model menus. Every Ritemark app fetches it from this repository, so a change here reaches users without an app update. The apps ask only for changes (ETag) and the CDN caches the file for about 5 minutes.

## Who changes what

| Change | Who | How |
| --- | --- | --- |
| A new Anthropic model | Automation, within about 10 minutes | The `Model catalog autopublish` workflow |
| Labels, descriptions, order, defaults, other providers | People | Edit `model-catalog.json` and bump `updatedAt` |
| Hide a model everywhere | People | A tombstone (below) |
| Refresh the whole lineup at a shell release | People | The export script in ritemark-native (below) |

## How automatic publishing works

1. Every 10 minutes, and on demand, the workflow lists Anthropic's models (`GET /v1/models`) with the `MODEL_CATALOG_ANTHROPIC_API_KEY` key.
2. A model is new when all of these hold:
   - It has a Claude id.
   - It is not in the feed (tombstones count as in the feed).
   - It was created after the `watermark` in `model-catalog.config.json`.
   - It is not a dated snapshot of a model that is already known or listed.

   Each run takes at most `maxAdditionsPerRun` new models, oldest first.
3. **Canary.** For each Claude Code version in `canary.claudeCodeVersions`, the real CLI runs one short turn on the new model with no tools. The CLI is fetched from npm and its integrity is checked. The model is declared the way the Ritemark app declares it: `settings.modelPicker` plus the output budget. To pass, the CLI must list the model and start the session on it, the API must answer as that model, and the turn must finish.
4. A model that passes on every version is appended as a new row with:
   - `provenance: "auto"` and `addedAt`.
   - `minAppVersion`, so older apps ignore the row.
   - `claudeCode: { inject: true, maxOutputTokens }`.
   - Effort levels taken from Anthropic's capabilities.

   `updatedAt` and the watermark move forward. The commit message names the model, the CLI versions and the canary time.
5. The publisher can only append rows, and this is checked again before every push. It never edits a row, a default or another provider. It never adds a tombstone and never sets `behavesAs`. An automated row never becomes a default.
6. A failing canary publishes nothing. The run is marked failed, and GitHub emails the repository owner. The model is retried after a cooldown that starts at 1 hour and doubles each time, up to 24 hours. Other models in the same run are not blocked.

   Some models should never be published, for example one that Ritemark's workspace cannot use. To stop the retries, add a tombstone row for it (see below). The publisher then treats the model as known and leaves it alone:

   ```json
   { "id": "claude-example-1", "label": "Example 1", "description": "", "tier": "medium", "deprecated": true, "order": 99, "retired": true }
   ```

Listing models is free. Each canary is one short turn per CLI version and costs a fraction of a cent.

## Switches and secrets

- `MODEL_CATALOG_AUTOPUBLISH` (repository variable): `on` enables publishing. Any other value stops it from the next run, with no code change.
- `MODEL_CATALOG_ANTHROPIC_API_KEY` (repository secret): a key from a dedicated Anthropic workspace that has a monthly spend limit. Only the publish step can read it. Pull requests never run the publish workflow.
- **Dry run.** Go to Actions → Model catalog autopublish → Run workflow and tick *dry run*. It runs the canary and logs what it would add, but writes nothing. It works even while the variable is off.

## Editing by hand

- Keep `schemaVersion: 1`. Whenever you change anything, bump `updatedAt` to the current UTC time (`date -u +%Y-%m-%dT%H:%M:%SZ`) so that apps treat the document as fresher.
- `node scripts/model-catalog/validate.mjs` checks the schema and the 512 KB size limit. The `Model catalog tests` workflow runs it, together with the publisher's unit tests, on every pull request.
- **Curating an automated row.** To give it a better label, description or order, or a Claude Code behavior profile (`claudeCode.behavesAs`), edit the row and set `"provenance": "curated"`. Keep `addedAt`: an app keeps a curated row that exists only in the feed only when it was added after that app's bundled lineup. Only a curated row can become a default.

### Hiding a model everywhere (tombstone)

Set `"retired": true` on the model's row, keep the row, and bump `updatedAt`. Ritemark 1.12.0 and later then hide the model in every list, including the list that Claude Code reports itself, and stop declaring it. To undo, remove `retired`.

Do not delete the row. The publisher will not add a deleted automated row again, because the watermark has already passed it. But the model can still appear through Claude Code's own list.

## Refreshing the lineup at a shell release

Apps on older builds take a fresher feed as a whole, so the feed should carry the current lineup. In ritemark-native:

```bash
cd extensions/ritemark
npx tsx scripts/export-bundled-model-catalog.ts --merge <ritemark-public>/feeds/model-catalog.json > /tmp/model-catalog.json
cp /tmp/model-catalog.json <ritemark-public>/feeds/model-catalog.json
```

The script writes the app's bundled lineup and keeps three things: automated rows and tombstones that the lineup does not curate, and providers the app does not know. Write to a temporary file first, because a shell redirect onto the file being merged would empty it before it is read.

When a release bundles a new Claude Code version:
1. Check it offline with `node scripts/model-catalog/canary-smoke.mjs <version>`. This uses no key.
2. Add it to `canary.claudeCodeVersions`.
3. Keep the older versions for as long as apps that bundle them, at or above `autoRowMinAppVersion`, are in use.

## Operations

- GitHub can delay scheduled runs, most often at the top of the hour. Ritemark measures the real publish latency during the first day of runs and records it here.
- In a public repository, GitHub disables scheduled workflows after 60 days without repository activity, and emails a warning first. Any push resets the count. If it happens, re-enable the workflow under Actions.
- The cooldown state lives in the Actions cache (`.catalog-state/`). Losing it only means that a failed model is retried sooner.

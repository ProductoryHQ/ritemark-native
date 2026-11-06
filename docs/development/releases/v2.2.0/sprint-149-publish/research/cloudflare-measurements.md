# A4: the live Cloudflare measurements (M1–M11)

Sprint 149, PR 4 (#668). Run on 6 November 2026, ~06:10 Tallinn, on Jarmo's Cloudflare test account (free plan, not his own), with the token made from Cloudflare's "Edit Cloudflare Workers" template, limited to that account.

**How:** `scripts/qa/cloudflare-contract.mjs` through the vault script, on branch `sprint-149-publish-cloudflare`:

```
RITEMARK_BUILD_CHANNEL=test RITEMARK_TEST_PROFILE=/private/tmp/rm-a4 \
  scripts/qa/with-test-keys.sh --require cloudflare,cloudflare-account-id \
    -- node scripts/qa/cloudflare-contract.mjs --user-data-dir=/private/tmp/rm-a4 --register-subdomain rmtest-2155
```

The script drives Ritemark's own client, host and upload path (`src/publish/`), never a second implementation. The token came only from the Keychain (`ritemark-test-keys`) into that one process's environment; no session typed, printed or saw it. Every printed or recorded line went through `redact()` (token, account ID, any JWT). One Worker was created (`ritemark-a4-e1baff`) and deleted in the same run.

**Result: 12/12 PASS**, 151.6 s in all.

Redacted here: the account's name (it contains a personal email address) as `<account name>`, the account ID as `<redacted>`. The workers.dev name registered for the test is `rmtest-2155`.

## Results

| # | Measurement | Result | Timing |
|---|---|---|---|
| M1 | The account ID from a token alone, and its name for the sheet | **PASS.** The product's connect found the one account; its ID matched `CLOUDFLARE_ACCOUNT_ID`; its name read "`<account name>`" (Cloudflare's default, "…'s Account") | — |
| M2 | Whether a new account already has a workers.dev name; registering one by API | **PASS.** The new account had none: `GET …/workers/subdomain` answered HTTP 404, code 10007 ("You do not have a workers.dev subdomain"), which the client reads as "no name", never as a failure. Registered `rmtest-2155` by `PUT …/workers/subdomain`; the client read the name again just before the PUT (the subdomain guard) | — |
| M3 | The asset hash the upload session accepts | **PASS.** Ritemark's sha256-based asset keys (`assetHash`, first 32 hex of sha256 over base64 + extension) were accepted; no blake3 needed | part of the 9.0 s deploy |
| M4 | The metadata-only `PUT …/scripts/{name}` deploys an assets-only Worker | **PASS.** The direct caller's metadata-only PUT (no script module), with `assets.config._headers` carrying noindex, deployed `ritemark-a4-e1baff`: 3 of 3 files uploaded | deploy **9,019 ms** |
| M5 | `POST …/subdomain` with `previews_enabled: false` | **PASS.** The Worker's workers.dev route was turned on with previews off asked; the page answered at `https://ritemark-a4-e1baff.rmtest-2155.workers.dev/` | part of the deploy |
| M6 | Time from deploy to the first 200 at a new address | **PASS, slow:** the first 200 came **121,083 ms** after the deploy returned, on the brand-new workers.dev name. Checked once a second, `Cache-Control: no-cache`, no redirect followed | **121 s** |
| M7 | `X-Robots-Tag: noindex` on `/`, on `/index.html`'s redirect, on a picture and on a 404 | **PASS, all four:** `/` HTTP 200, `/index.html` HTTP 307, `/img/a.png` HTTP 200, `/nothing-here.png` HTTP 404, each with `X-Robots-Tag: noindex` | — |
| M8 | Update with the same name: only missing hashes upload; a file left out is gone | **PASS.** The same address; 1 of 2 files uploaded (only the changed page); the dropped picture answered 404 | fast (seconds) |
| M9 | Unpublish: `DELETE …/scripts/{name}`; time until the address stops serving | **PASS.** The address stopped answering **3,152 ms** after the delete | **3 s** |
| M10 | Workers Scripts Edit alone covers every call (subdomain included) | **PASS for the calls:** the template token connected (the product's token check said "connected") and covered every call above, the subdomain registration included. **The template link's prefilled permissions:** read in Cloudflare's dashboard, by Jarmo | — |
| M11 | The new Workers Admin role: does it change what the token needs or what the consent asks | **Read in Cloudflare's dashboard, by Jarmo.** Not measured by the script, and no session opened the dashboard | — |
| — | Cleanup | **PASS.** No `ritemark-a4-*` Worker left on the account at the end of the run | — |

M12–M14 (OAuth) need decision 6's private client and are not part of this run; PR 4 ships the token path (sprint-plan.md, *Pre-Implementation Gate*).

## What the run logged (redacted)

- Three `GET …/accounts/<redacted>/workers/subdomain` answers of HTTP 404, 10007, before the registration: the connect's read, the host's read, and the guard's read just before the PUT.
- `ritemark-a4-e1baff: deployed, 3 of 3 files uploaded`, then, for the update, `deployed, 1 of 2 files uploaded`.

## What changes because of it

**M6 changes R7 (`spec.md`, changed first).** On a brand-new workers.dev name the page took two minutes to answer after a successful upload. Before this change the bar said Published as soon as the upload returned, so the first link anyone opened on a new account showed "There is nothing here yet" for up to two minutes, which looks like a failure. Now a first publish keeps "Publishing…" until the address answers (checked every 2 s, at most 5 minutes) and shows one plain line while it waits: "Your address is new. It can take a couple of minutes before the page opens." (at once when the name was registered in this publish, otherwise after 10 s). At the cap it says Published anyway, since the upload went through. Updates don't wait (M8: the address already answers). `PublishController.waitForFirstAnswer`, `CloudflareHost.waitUntilOnline`; tests in `cloudflare.test.ts` and `PublishController.test.ts`, mutation-checked.

**No other requirement changes.** M2's 10007 reading, M3's hash, M4's metadata-only deploy, M5's previews off, M7's noindex, M8's update and M9's take-down all behave as `spec.md` R5–R7 and the client already assume. M9's 3 s means "Cloudflare is still taking the page down." (after 10 s) should rarely show.

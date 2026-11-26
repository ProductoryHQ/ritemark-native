# PR 3 · Keep the published deck link

## Today and after a naive move

Each example has `Kickoff.rtms` beside the listed files. Publish gathers the HTML and its referenced files. The examples use an external theme font and include a logo in (b) and (c). In the table, `K` means `Kickoff files`, `F` means `fonts/Inter-4.001-latin.woff2`, and `L` means `logos/logo-<hash>.svg`. Paths are in file order. `S` is that deck's existing `https://<site>.<subdomain>.workers.dev` origin, assuming the same Worker is used. Cloudflare also stamps the HTML and adds `/version.json` at the site root in every row. Neither the deck nor that generated version file is a gathered file.

| Case | On disk, relative to the deck | Gathered `relPath` | Served paths | Copy link |
| --- | --- | --- | --- | --- |
| Today (a), new pictures only | `Kickoff.html`, `K/new.png`, `F` | `Kickoff.html`, `K/new.png`, `F` | `/index.html`, `/K/new.png`, `/F` | `S/` |
| Today (b), old pictures and logo | `Kickoff.html`, `images/old.png`, `F`, `L` | `Kickoff.html`, `images/old.png`, `F`, `L` | `/index.html`, `/images/old.png`, `/F`, `/L` | `S/` |
| Today (c), both picture folders | `Kickoff.html`, `images/old.png`, `K/new.png`, `F`, `L` | `Kickoff.html`, `images/old.png`, `K/new.png`, `F`, `L` | `/index.html`, `/images/old.png`, `/K/new.png`, `/F`, `/L` | `S/` |
| Moved (a) | `K/Kickoff.html`, `K/new.png`, `K/F` | `Kickoff.html`, `new.png`, `F` | `/index.html`, `/new.png`, `/F` | `S/` |
| Moved (b) | `K/Kickoff.html`, `images/old.png`, `K/F`, `K/L` | `K/Kickoff.html`, `images/old.png`, `K/F`, `K/L` | `/K/index.html`, `/images/old.png`, `/K/F`, `/K/L` | `S/Kickoff files/` |
| Moved (c) | `K/Kickoff.html`, `images/old.png`, `K/new.png`, `K/F`, `K/L` | `K/Kickoff.html`, `images/old.png`, `K/new.png`, `K/F`, `K/L` | `/K/index.html`, `/images/old.png`, `/K/new.png`, `/K/F`, `/K/L` | `S/Kickoff files/` |

The moved rows assume the local picture references are rebased to `new.png` and `../images/old.png`. Otherwise gather resolves the old references from the new page directory and can silently miss pictures. Fonts and logos already use page-relative addresses. Cases (b) and (c) change links. Cloudflare constructs the copied string with a literal space here, and a browser encodes it as `%20`. Without a record move, any of the three can also lose its existing Worker association.

## Options

1. **Force the hosted page to the root.** Keep naive gathered asset paths and render hosted references from `/index.html`. In (a) the new picture becomes `new.png`. In (b) and (c) use `images/old.png`, `Kickoff%20files/new.png` where present, and prefix font and logo addresses with `Kickoff%20files/`. The disk uses the moved layout. Hosted HTML and asset paths change, and a single render with those references breaks local preview. The font address check also expects `fonts/…`.
2. **Keep the page beside the deck when a picture lives outside its folder.** Keeping the page and its support files beside the deck preserves today's HTML references and site paths for (b) and (c), while leaving those generated files outside the folder required by R1 and R5. In (a) all three move, and the naive picture path and HTML change. Adding or removing an outside picture can flip the layout and record key again.
3. **Always gather relative to the deck directory and force the page to the root.** Every deck uses the moved disk layout. The hosted HTML names deck-relative pictures and `Kickoff%20files/fonts/…` and `Kickoff%20files/logos/…`. The site keeps both picture prefixes but moves every external font and logo under `/Kickoff files/`. Local preview still needs its own references. A fixed gather root also needs an explicit policy for permitted project pictures above the deck directory.
4. **Preserve the hosted layout for the record.** Use the moved disk layout in all cases. Render local HTML from its new directory and render hosted HTML against the old logical page location. Keep `Kickoff.html` as the gathered page name and retain today's site paths for all three examples, including `/Kickoff files/new.png` and root-level fonts and logos. The hosted references can stay byte-for-byte as before for unchanged inputs, before normal version stamping. Carry the old layout forward for each site, including any existing nested page path. New decks can use today's logical layout too. The risk is a mismatch between the two renders or a path collision. Resolve local files through normal gather checks and freeze the hosted paths and scanned HTML into the verified plan. Reject collisions and keep the existing scope, cleaning, size and consent checks.

## Recommendation and migration

Use option 4. It preserves all three links and their site file names and layout. It changes local HTML paths and how the upload is assembled. For unchanged inputs the hosted HTML need not change beyond the existing version stamp. If implementation needs a site layout change, stop and ask under the sprint plan.

Until the next manual Publish or Update the page, resolve the legacy record for Copy link, Unpublish and live save. Continue live saves at the legacy location until that migration. Afterwards, use the new page key and the same hosted mapping for manual and live updates, including hashes, sheet comparisons and no-op saves. Open in your browser uses the local page and its local references.

Under the deploy lock, prepare the new files and keep the old record usable through cancel or failure. After a successful replacement, atomically rekey the records for the old page in one locked store write. Preserve each site's account, name, address, version, digest, file history and live consent or pause, updating publish fields for the site actually deployed. Guard both keys during migration so a save or Unpublish cannot race it. If persisting fails, retain the old record for retry. Unpublish from the deck or Settings still takes down the recorded Worker and removes that site's record.

Only take back the old page with its mark and verified unchanged bytes. For fonts and logos, the record supplies paths and hashes, but a matching hash alone cannot prove Ritemark created a file. Keep uncertain, modified and shared files, using the existing take-back checks and positive ownership evidence. Remove only empty owned directories.

## Tests to pin first

1. Publish (b), migrate with Update the page, then assert Copy link returns the exact previous string and the same Worker still serves it.
2. Assert manifest paths and resolved picture, font and logo URLs for (a), (b) and (c), including local preview with spaces and both picture folders.
3. Reopen after migration. Check unchanged and edited live saves, then Unpublish from the deck and Settings. Cover cancel, failed deploy, failed rekey, taken names, and old files that are edited, foreign or shared.

## PR 3 result

Pinned the baseline at `79eb140b` in `src/publish/deckPublishLayout.test.ts`. The cases cover the hosted manifest, HTML addresses, pre-stamp HTML hashes, and the exact address Copy link uses. When present, the logo comes first among the gathered assets because its reference occurs before the handout pictures. The path sets in the table above hold.

One renderer takes the page location. The local page and its fonts and logo are written into `<deck> files/`. The hosted render uses the beside-the-deck location, and gather keeps the checked HTML in the frozen plan. The upload reads that HTML and verifies each disk asset against its scanned hash. The three baseline pins match, including HTML bytes before Cloudflare's usual version stamp.

| What can differ after the move | Result |
| --- | --- |
| Local preview | The new page uses addresses from `<deck> files/`, including `../images/old.png` for an older picture and `new.png` for a picture in that folder. |
| A Git rule matches a moved font or logo | The existing Git check uses its real source path on disk. An ignored `Kickoff files/fonts/…` file stays out and the sheet names it. An unignored moved file keeps its old served path. |
| An existing site has a nested index | The record's layout keeps the index at the same address, even when a picture that previously set the gather root is removed. A reference that would require moving the site layout stops the upload. |

Manual Publish takes both page leases for the deploy and moves the records in one locked write after success. The old key still serves Copy link, Unpublish and live saves before migration, or after a failed deploy or record write. After the record write, the old page goes to the Trash when its meta mark and published byte hash match. For assets named by the old page or record, a font needs a generated name and the exact bytes of its bundled font file. A logo needs its generated name with the hash prefix and either the current theme logo's bytes or the prior record's full hash for that path. Every neighboring HTML page, including the old page if it stays, protects the files its HTML and inline CSS reference. Cleanup skips files held by a save and takes nothing back if a sibling page cannot be read. Cleanup uses the Trash for eligible files and for folders emptied by the cleanup. Read and Trash failures are quiet. Cancellation takes back newly created files and removes newly created folders only while empty.

The migration tests exercise the unchanged Copy link, a deck alone, a shared font that still resolves from the sibling page, different bytes under a generated font name, and a simulated Trash failure after the record moves. The publish suite passed 33 checks, including the hosted pins and migration cases. Its two localhost suites hit sandbox `listen EPERM`. The page suite passed 15 checks and the deck suite passed 67. TypeScript passed with the installed compiler. The `npx` launcher failed in the sandbox.

The browser's Publish uses the hosted render when it can match the local preview bytes, using the recorded fit to reproduce fitted pages after reopening. An unmeasured live save with the same public digest reuses that fit when it reproduces the published HTML hash. If it cannot reproduce those bytes, it directs the reader to Publish from the deck.

Proposed taken-page line: “Kickoff.html” is already in “Kickoff files”, and Ritemark didn’t make it from the deck, so it stays as it is. Rename that file to publish the deck.

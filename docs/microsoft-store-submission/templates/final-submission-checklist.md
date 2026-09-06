# Final Microsoft Store submission checklist

Candidate: `vX.Y.Z candidate N`  
SHA-256: `PENDING`  
Reviewer: `PENDING`  
Review date: `PENDING`

## Account and listing

- [ ] Productory company developer account is fully active.
- [ ] `Ritemark` is reserved.
- [ ] English listing is complete.
- [ ] Category, pricing, markets, and age rating are approved.
- [ ] Description, features, search terms, copyright, and license terms are final.
- [ ] What's new is blank for the first Store submission, or correct for an update.
- [ ] Support email is intentionally public and approved.
- [ ] No placeholder or test text remains.

## URLs and assets

- [ ] Product, support, privacy, and terms URLs return the expected English pages.
- [ ] Installer URL resolves over HTTPS and directly serves the EXE.
- [ ] Installer URL is versioned and protected from in-place replacement.
- [ ] 1:1 Store logo preview is correct.
- [ ] Final screenshots come from the installed Windows candidate.
- [ ] At least four screenshots are selected and captions reviewed.
- [ ] No development-host UI, private data, secrets, or misleading platform details are visible.

## Candidate identity

- [ ] Partner Center version matches candidate record.
- [ ] Partner Center architecture is x64.
- [ ] Partner Center installer parameters match candidate record.
- [ ] Fresh hosted download SHA-256 matches the approved CI artifact.
- [ ] Installer and Ritemark-owned PE signatures are valid for `Productory Services OÜ`.
- [ ] Standard-user silent install/uninstall passes.
- [ ] Defender scan passes.
- [ ] Clean Windows 11 / Smart App Control On test passes against this SHA-256.

## Submit boundary

- [ ] Package preprocessing/validation is green.
- [ ] Certification notes contain no placeholders or secrets.
- [ ] Every Partner Center section has been reviewed.
- [ ] Jarmo explicitly approves this exact version, URL, and SHA-256.
- [ ] Submission ID and timestamp will be recorded immediately after Submit.

Do not click **Submit to the Store** until every checkbox above is complete.

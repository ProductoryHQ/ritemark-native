# Productory Microsoft Store account onboarding

Last observed in Microsoft's onboarding flow: **2026-09-01**

## Organization record

| Field | Value |
|---|---|
| Account type | Company |
| Legal company name | Productory Services OÜ |
| Estonian registry code | 14781142 |
| Registered address | L. Koidula tn 11-4, Tallinn 10125, Estonia |
| Company website | https://productory.ai |
| Publisher display name | Productory Services OÜ |
| Account locale used during onboarding | English |

The Partner Center contact entered during onboarding is an account/verification contact. It must not automatically be reused as the public Store support contact.

## Verification result

| Check | State on 2026-09-01 |
|---|---|
| Business details | Completed |
| Contact details | Completed |
| Email verification | Verified |
| Employment verification | Verified |
| Business verification | **Verified** |
| Finish account setup | **Completed** |
| Partner Center access | **Working** — `Ritemark` EXE/MSI draft created |

Microsoft's onboarding page confirmed: **“Verification complete. Your account is ready. You can now publish apps to Microsoft Store.”** All three verification rows showed `Verified` on 2026-09-01. **Finish account setup** then completed successfully and the Productory account opened Partner Center's Apps and games area.

## D-U-N-S and uploaded evidence

No D-U-N-S match was found using the legal or ASCII company name during onboarding. A new D-U-N-S number was not requested because Microsoft allowed documentary business verification.

The official English Estonian e-Business Register extract used for verification is recorded by provenance rather than committed — see [`evidence/account-onboarding/README.md`](./evidence/account-onboarding/README.md) for why, and how to obtain a fresh one.

Recorded file facts:

| Property | Value |
|---|---|
| File name | `Productory-Services-OU-registry-extract-2026-09-01.pdf` |
| SHA-256 | `14ccd248647ccc16c1bc65039bb4a2c1c2024774c1c59682c9de972341cb3ad3` |
| Source | Estonian e-Business Register, https://ariregister.rik.ee/ |
| Committed to this repository | No — deliberately excluded |
| Pages | 1 |
| Language | English |
| Contents | Company identity, registry code, registered address, public company contact data, and extract source/time |

The document contains business contact information. Keep it as verification evidence; do not upload it as a public Store listing asset.

## Completion and next action

Verification and account creation have passed. `Ritemark` was found available and reserved as an EXE/MSI app. Partner Center ID: `3a2a9010-fbe3-47cf-ae87-4d338f587830`.

The application overview currently warns that recently created account verification may take up to 30 minutes to reflect across the system. Continue with [`PARTNER-CENTER-LIVE-DRAFT.md`](./PARTNER-CENTER-LIVE-DRAFT.md) after propagation.

If Microsoft later changes or rejects the account state:

1. Record Microsoft's exact rejection reason without copying secrets into the repository.
2. Use **Fix now** in Partner Center.
3. Confirm the legal name, address, website domain, email domain, and evidence all describe the same entity.
4. Supply only the additional evidence Microsoft asks for.

Microsoft's current company-verification guidance is linked in [`OFFICIAL-REFERENCES.md`](./OFFICIAL-REFERENCES.md).

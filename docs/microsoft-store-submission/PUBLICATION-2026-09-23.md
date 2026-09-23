# Microsoft Store publication — 2026-09-23

## Public identity

- Product: Ritemark.
- Publisher: `Productory Services OÜ`.
- Category: Productivity.
- Public Store ID: `XP9K8SP24TRNK4`.
- Canonical web listing: `https://apps.microsoft.com/detail/xp9k8sp24trnk4`.
- Partner Center product ID: `3a2a9010-fbe3-47cf-ae87-4d338f587830`.
- Package ID: `23647104`, x64.

The public Microsoft Store page was observed on 2026-09-23. It displayed the Ritemark title, Productory publisher, Productivity category, approved short description, age rating, full description, and public installation surface. This is evidence that Microsoft's certification/publication step completed for the v1.11.0 resubmission.

## Store-origin verification

Jarmo confirmed on 2026-09-23 that the Microsoft Store installation path was tested, including installation, launch, and uninstall. This owner confirmation closes those Store-origin checks. It does not independently record an edit/save exercise and does not imply that Windows Smart App Control was enabled.

## Submitted installer identity

- Candidate: v1.11.0 candidate 1.
- Package URL: `https://getritemark.com/windows/v1.11.0/Ritemark-Setup.exe`.
- Size: `444207592` bytes.
- SHA-256: `0ebda5016e432b2f039613f74665343220006e39e7749ddb76d285d0a87b932b`.
- R2 ETag: `"215bc154378ab2bf8ab4cce863ebaf9d"`.

A fresh anonymous stream on 2026-09-23 returned:

- HTTP `200` with no redirect or authentication step;
- `content-type: application/vnd.microsoft.portable-executable`;
- `content-length: 444207592`;
- `content-disposition: attachment; filename="Ritemark-Setup.exe"`;
- `etag: "215bc154378ab2bf8ab4cce863ebaf9d"`;
- `cache-control: public, max-age=31536000, immutable`;
- SHA-256 `0ebda5016e432b2f039613f74665343220006e39e7749ddb76d285d0a87b932b`.

The response body was piped directly into the SHA-256 calculation. No installer copy, header file, or probe object was retained.

## Remaining distinction

The Store channel is certified, public, and its install path has been exercised. A clean Windows 11 / Smart App Control On test remains a separate internal hardening evidence item. Store certification must not be used as a substitute for that test.

The submitted v1.11.0 object remains immutable. Any rebuilt binary requires a new versioned URL, candidate record, validation, and Store submission.

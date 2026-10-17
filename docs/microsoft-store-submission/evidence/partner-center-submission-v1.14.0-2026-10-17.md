# v1.14.0 Partner Center submission evidence — 2026-10-17

## Candidate identity

- Package ID: `23647104`
- Candidate: v1.14.0 candidate 2
- URL: `https://getritemark.com/windows/v1.14.0/Ritemark-Setup.exe`
- Size: `475059168` bytes
- SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`

## Approval and submission

Jarmo explicitly approved the exact candidate URL and full SHA-256 immediately before the final Partner Center **Submit** action on 2026-10-17.

Partner Center then displayed an **In-app purchases disclosure** recommendation. It stated that the inherited `Freemium` pricing model implies digital-goods purchases and recommended changing the age-rating answer to `Yes`. Ritemark does not sell digital goods in the app; its listing explains that optional third-party AI features may require the provider's own account, subscription, or API credits. Jarmo separately approved **Submit anyway** after this warning was presented.

At approximately `2026-10-17 15:00 EEST`, Partner Center returned to the Ritemark application overview and displayed:

- Store state: `In Microsoft Store`
- Update state: `Update in review`

No privacy or terms URL was changed during this update.

## Post-submit public-object verification

A fresh anonymous request and complete download after submission returned:

- HTTP `200`
- `Content-Type: application/vnd.microsoft.portable-executable`
- `Content-Length: 475059168`
- `Cache-Control: public, max-age=31536000, immutable`
- ETag: `"2bf534053f50f409b9dd7734eb1cae82"`
- downloaded SHA-256: `8f109ea80438202abab9f3105ba38ae8f1effce04d2a148e93c02d698393ca48`

The exact submitted bytes therefore remain publicly available and unchanged.

## Remaining work

- Monitor certification until Microsoft approves, fails, or requests action.
- If certification fails, do not replace the submitted object. Diagnose the finding and, if new bytes are required, publish them at a new versioned URL.
- After publication, verify the public Store page and Store-origin install, launch, edit/save, and uninstall.

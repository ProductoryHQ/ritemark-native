# Sprint 85 Technical Plan — Cloud Accounts (native **client** slice)

> Client workstreams only. Backend workstreams (service/ops, data model, auth+tokens, accounts web
> page) are in `ritemark-cloud/.../sprint-01-account-service/technical-plan.md`.

## Architecture (client side)

```text
Ritemark desktop (this repo)                    Ritemark Cloud (ritemark-cloud)
┌──────────────────────────────┐               ┌─────────────────────────────┐
│ Settings webview (Account UI) │               │ account service             │
│        ↕ bridge (account:*)   │   HTTPS       │  /device/code /device/token │
│ Extension host                │  ──────────▶  │  /token  /devices  /account │
│  device-flow client           │   (JWT)       └─────────────────────────────┘
│  SecretStorage (device token) │
└──────────────────────────────┘
        webview never calls cloud directly; extension host mediates
```

The client codes against `ritemark-cloud/CONTRACT.md` and stays version-skew tolerant.

## Workstream 5: Client Account slice (R8) — this repo

- **Device-flow client** in the extension host: request code, open browser, poll, store token in
  `SecretStorage`, exchange + silently refresh the access JWT. Reference the outbound-HTTPS pattern in
  `src/update/githubClient.ts`.
- **Settings "Account" section** via the existing `RitemarkSettingsProvider` + shadcn `ui/`
  components; new `account:*` bridge message types following the `webview/src/bridge.ts` pattern.
- **Sign-out** clears `SecretStorage` + best-effort server revoke.
- Signed-out / offline / error states. **No stubbing of the Settings page** (HARD RULE #1).

## Workstream 6: Architecture doc update (Gate item) — this repo

- Add the **Layer 0 backend pointer** to `docs/development/architecture.md`: what the layer is, that
  it lives in `ritemark-cloud`, the token lifecycle summary, and the client touch-points. Do **not**
  duplicate the backend internals here. `Last updated` ≥ branch creation date.

## Tests (client)

- Client unit/integration: device-flow happy path (mocked service), `SecretStorage` read/write, JWT
  refresh + refresh-failure → re-sign-in, signed-out/offline Settings states.
- `./scripts/validate-qa.sh` for the native client changes.
- Manual QA: [scenarios.md](scenarios.md), including the shared revoke-kills-session E2E test
  (coordinate with the cloud account-service sprint — needs the live backend).

## Cross-repo note

PRs in this repo and `ritemark-cloud` are tracked from the cross-repo register
(`ritemark-dev/releases/v1.9.0/release-register.md`). The client cannot be E2E-verified until the
service is deployed.

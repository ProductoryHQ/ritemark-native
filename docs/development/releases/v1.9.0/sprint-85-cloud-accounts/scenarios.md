# Sprint 85 Scenarios — Cloud Accounts (native **client** slice)

Client-side BDD examples; become this sprint's manual QA matrix. The pure-backend scenarios (OAuth
round-trip, magic-link issue/consume, server-side revocation, GDPR deletion) live in
`ritemark-cloud/.../sprint-01-account-service/scenarios.md`. The **"revoke kills the app session"**
test is end-to-end and shared between both sprints.

## Feature: Sign-in via device flow (R8, consumes backend R3/R4)

### Scenario: First sign-in from a fresh install
Given a Ritemark desktop with no stored device token
When the user opens Settings → Account → "Sign in to Ritemark Cloud"
Then the app requests a device code and opens the browser to the sign-in + device-approval page
And after the user approves the device, the app stores the device token in SecretStorage
And the Account section shows the signed-in identity and the device as active

### Scenario: Access token refresh
Given a signed-in app holding a valid device token
When the short-TTL access JWT expires
Then the app silently exchanges the device token for a new access JWT
And the user is not prompted to sign in again

## Feature: Account section in Settings (R8)

### Scenario: Sign out clears local token
Given a signed-in app
When the user clicks Sign out in Settings → Account
Then the device token is cleared from SecretStorage
And the server-side device is revoked best-effort
And the Account section returns to the signed-out state

### Scenario (negative): Backend unreachable
Given the account service is unreachable
When the user opens Settings → Account
Then the section shows a clear offline/error state
And the local editor remains fully functional (no cloud dependency on local editing)

## Feature: Device revocation — the headline exit test (E2E, shared with cloud)

### Scenario: Revoke kills the app session
Given a user signed in on this desktop device
When the user revokes that device from the accounts web page (served by ritemark-cloud)
Then within one access-JWT TTL (≤15 min) the app's silent refresh fails
And the app shows a re-sign-in state
And local editing is unaffected

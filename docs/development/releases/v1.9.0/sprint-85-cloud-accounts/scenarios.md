# Sprint 85 Scenarios — Cloud Accounts

These BDD examples pin down each requirement and become the manual QA matrix in [tasks.md](tasks.md). Negative/refusal paths are required for the security-sensitive requirements (R4, R5, R6).

## Feature: Sign-in via device flow (R3, R4)

### Scenario: First sign-in from a fresh install
Given a Ritemark desktop with no stored device token
When the user opens Settings → Account → "Sign in to Ritemark Cloud"
Then the app requests a device code and opens the browser to the sign-in + device-approval page
And after the user signs in with GitHub and approves the device, the app receives and stores a device token in SecretStorage
And the Account section shows the signed-in identity and the device as active

### Scenario: Access token refresh
Given a signed-in app holding a valid device token
When the short-TTL access JWT expires
Then the app silently exchanges the device token for a new access JWT
And the user is not prompted to sign in again

### Scenario (negative): Email magic link reused/expired
Given a user requested an email magic link
When the link is opened after it has expired or already been used
Then sign-in is refused with a clear "request a new link" message
And no session is created

## Feature: Device revocation (R5)

### Scenario: Revoke kills the app session
Given a user signed in on a desktop device
When the user revokes that device from the accounts web page
Then the device token can no longer mint access JWTs
And within one access-JWT TTL (≤15 min) the app shows a re-sign-in state
And the revocation appears in the audit log

### Scenario: Revoke all
Given a user with two authorized devices
When the user chooses "Revoke all"
Then both device tokens are invalidated
And both apps fall back to a re-sign-in state

## Feature: Account deletion (R6)

### Scenario: Delete account removes personal data
Given a signed-in user
When the user confirms account deletion on the web page
Then users / oauth_identities / devices rows are removed and audit_log personal data is anonymized per policy
And all device tokens for that user are invalid
And a subsequent sign-in starts a brand-new account

## Feature: Entitlement state with no subscription (R7)

### Scenario: No subscription means no product access
Given a signed-in user with no active subscription
When the app inspects the access JWT entitlements
Then entitlements is an empty array
And this is the expected, non-error state for Sprint 85 (billing arrives in Sprint 86)

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

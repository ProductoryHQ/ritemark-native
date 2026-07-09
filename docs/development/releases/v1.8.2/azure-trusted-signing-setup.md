# Azure Trusted Signing (Artifact Signing) — Setup Guide for Jarmo

**Purpose:** get the Windows code-signing certificate that fixes #130 (Smart App Control blocks the installer).
**Who does this:** Jarmo (it's your Azure account + Productory's legal identity). Claude wires the signing into CI afterward.
**Cost:** ~€9/month (Basic tier, 5000 signatures/month).
**Time:** setup ~1 hour of clicking; then **identity validation takes 1–20 business days** (Microsoft verifies Productory is a real company). Start ASAP — this wait is the critical path.
**Naming note:** Microsoft renamed "Trusted Signing" → "**Artifact Signing**" in the portal. Same thing. The resource provider is `Microsoft.CodeSigning`.

> Estonia (EU) is eligible for Public Trust certificates, and Productory (7 years old) clears the 3-year-history requirement. ✅

---

## Before you start — you need

1. An **Azure subscription that is PAID** (not free/trial — Artifact Signing refuses free subscriptions). If Productory doesn't have one, create one at portal.azure.com → "Subscriptions" → Add (Pay-As-You-Go is fine).
2. Sign in to [portal.azure.com](https://portal.azure.com/) with a Productory work account.
3. **Have Productory's legal details ready** (they must EXACTLY match the Estonian Business Register / Äriregister, or validation is delayed):
   - Legal entity name: **Productory Services OÜ** (confirm exact spelling in Äriregister)
   - Business registry code (registrikood)
   - Registered address (street, city, postal code, Estonia)
   - Website: productory.eu
   - A monitored email (e.g. jarmo@productory.eu) + a **second, different** email on the same @productory.eu domain
   - Your government ID (passport / ID-kaart) — you'll scan it during "Verified ID"
   - Your phone + the **Microsoft Authenticator** app installed on your phone

⚠️ **Critical:** before starting, make sure the Azure **billing account** legal name + address match the details above. Whatever is on the billing account can end up on the certificate.

---

## Step 1 — Turn on the service (register the resource provider)

1. portal.azure.com → search **"Subscriptions"** → click your paid subscription.
2. Left menu → **Settings** → **Resource providers**.
3. In the list find **`Microsoft.CodeSigning`** → select it → click **Register** (top).
4. Wait ~1 min until status = **Registered**.

## Step 2 — Create the Artifact Signing account

1. Search **"Artifact Signing Accounts"** (or "Trusted Signing Accounts") → **Create**.
2. Fill:
   - **Subscription:** your paid subscription
   - **Resource group:** Create new → `ritemark-signing`
   - **Account name:** `ritemark-signing` (3–24 letters/numbers, globally unique — if taken, try `productory-signing`)
   - **Region:** **North Europe** (closest to Estonia) — remember this, it maps to endpoint `https://neu.codesigning.azure.net`
   - **Pricing:** **Basic**
3. **Review + Create** → **Create** → **Go to resource**.

## Step 3 — Give yourself permission to validate identity

1. In the Artifact Signing account → left menu **Access control (IAM)** → **Add** → **Add role assignment**.
2. Role: **Trusted Signing Identity Verifier** (a.k.a. "Artifact Signing Identity Verifier") → assign to **yourself** (your user).
3. Save. (Without this role the "New Identity" button is greyed out in the next step.)

## Step 4 — Identity validation (THE LONG WAIT — start it today)

1. In the account → **Objects** → **Identity validations**.
2. Select **Organization** → **New Identity** → **Public**.
3. Fill the form with Productory's legal details from the checklist above (Organization Name, Website, Primary Email, Secondary Email, Business Identifier = registrikood, full address, your First/Last name **exactly as on your ID**).
4. Click **Certificate subject preview** to sanity-check what will appear on the cert → **Create**.
5. Status becomes **In Progress**. When it flips to **Action Required**, click your name → follow the **"complete your verification here"** link:
   - Verify your email (PIN code), enter phone, scan a QR code, scan your government ID via the AU10TIX partner, add the Verified ID to **Microsoft Authenticator**, share it back.
6. Then it returns to **In Progress** while Microsoft reviews Productory (**1–20 business days**). You'll get emails. If they ask for a document, upload Productory's business registration (issued within last 12 months) in the portal.
7. Done when status = **Completed**.

## Step 5 — Create the certificate profile (after Step 4 = Completed)

1. In the account → **Objects** → **Certificate profiles** → **Create** → type **Public Trust**.
2. **Certificate Profile Name:** `ritemark-public-trust` (5–100 chars)
3. **Verified CN and O:** select the identity validation you just completed.
4. **Create.**

## Step 6 — Create a login for the GitHub build (the technical bit)

The GitHub CI needs a "service principal" to sign during the build. Two options:

- **Easy:** tell Claude you've finished Steps 1–5 and give the 4 values below — Claude can guide the `az ad sp create-for-rbac` command and assign the signer role, then wire the GitHub secrets.
- **DIY:** portal → **Microsoft Entra ID** → **App registrations** → **New registration** (`ritemark-ci-signing`). Then in the Artifact Signing account → **IAM** → assign that app the **Trusted Signing Certificate Profile Signer** role. Create a client secret. Note the App (client) ID, Tenant ID, secret.

---

## When done — hand Claude these 4 values

Claude needs these to wire signing into `.github/workflows/build-windows.yml` + the Inno Setup step:

1. **Endpoint URI:** `https://neu.codesigning.azure.net` (if you picked North Europe)
2. **Account name:** e.g. `ritemark-signing`
3. **Certificate profile name:** e.g. `ritemark-public-trust`
4. **Service principal creds** (from Step 6): Client ID + Tenant ID + Subscription ID (+ client secret, which goes into GitHub Secrets — Claude handles that safely).

---

## Reality check (important)

Signing fixes the "unsigned / can't confirm publisher" block **immediately**. But **Smart App Control** also checks Microsoft's cloud *reputation* — a brand-new signed app can still be held until reputation builds. So after the first signed release we also (a) submit the app to Microsoft for review and (b) document a temporary workaround for SAC users. This is expected and already in the sprint plan (#130 "done" = sign + submit + document).

**Source:** [Microsoft Learn — Artifact Signing quickstart](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart) · [Sign for Smart App Control compliance](https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control)

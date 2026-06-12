# Cloud Sharing Strategies for Ritemark — Research & Analysis

**Date:** 2026-06-12
**Status:** Research / pre-sprint analysis (no implementation decision yet)
**Question:** How should Ritemark add cloud sharing (one file at a time — markdown/HTML via link) as its first monetization vector?

This document synthesizes (a) a codebase inventory of reusable infrastructure and (b) five
parallel deep-research passes: competitor landscape, monetization patterns, technical
architectures, live-collab/viewer UX, and AI-era publishing + EU legal. Claims below were
cross-verified against primary sources (official pricing pages, engineering blogs, EU law
texts); key sources are linked inline.

---

## 1. Executive summary

- **The market has converged on one shape:** keep the local editor free and unrestricted,
  charge only for things that run on your servers. Obsidian does ~$25M ARR with a 7–8 person
  team on exactly this model ([pricing](https://obsidian.md/pricing)). Never paywall local
  capability — that is the trust contract the local-first community enforces.
- **Price anchors (2026):** $4–6/mo for sync+share (Obsidian Sync $4, Craft Plus ~$4.80,
  Excalidraw+ $6), $8–10/mo for publishing/branded sharing (Obsidian Publish $8, CleanShot
  Cloud Pro $8, Notion custom domain +$8). Annual ≈ 20% off monthly. Expect **2–5% of active
  users** to convert if the free/paid boundary is crisp.
- **Infrastructure cost is a rounding error:** a Cloudflare Workers + R2 static-publish
  architecture costs **~$0/mo at 1k shared docs, ~$5 at 10k, ~$6–10 at 100k**
  ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)). Margin is effectively 100%;
  the real cost is abuse handling and support.
- **Three genuinely unclaimed gaps** Ritemark is unusually well positioned to take:
  1. **Live-updating share links from a local-first editor** — only Simplenote ever did this
     and it's being wound down; Obsidian requires manual pushes; Bear still hasn't shipped
     link sharing despite years of demand.
  2. **"Open this shared doc in your app" handback loop** — no markdown editor does
     shared-web-doc → local-app handoff; it's the same mechanic as Notion's
     duplicate-template growth engine.
  3. **Agent-native sharing** — a share link that is simultaneously a human page, a clean
     `.md` endpoint, and an **MCP resource**. GitBook does per-*site* MCP; nobody does
     per-document. Ritemark ships with AI agents built in — this is the on-brand wedge nobody
     else can claim credibly.
- **Recommended path:** ship a free BYO-backend publish first (zero liability, weeks of
  work), then **Ritemark Link** — one-click hosted share with a generous free quota and a
  **$5/mo Pro tier** (passwords, custom domain, view analytics, E2EE mode, unlimited links),
  with agent-readability as the headline differentiator. Live view + edit handback later.

---

## 2. What the codebase already gives us

From the repo inventory (June 2026):

| Reusable today | Where | Use for sharing |
|---|---|---|
| HTML export pipeline (normalized, sanitized) | `src/export/v2/htmlPipeline.ts` (`buildNormalizedExportHtml()`) | Render the shareable page |
| TipTap HTML serialization | webview `editor.getHTML()` + DOMSerializer | Source of truth for rendered content |
| Webview ↔ host bridge | `webview/src/bridge.ts` pattern | New `share:publish` message type |
| Settings page framework | `src/settings/RitemarkSettingsProvider.ts` | "Account & Sharing" section |
| Outbound HTTPS pattern | `src/update/githubClient.ts` | Reference for API client |
| Feature flags with unused `'premium'` status | `src/features/flags.ts` | Gate the feature; entitlement enforcement still needed server-side |
| PostHog (EU host) | `src/analytics/posthog.ts` | Funnel metrics for share→upgrade |

**Missing entirely:** any account system, backend API, database, payments, entitlements,
CRDT/Yjs substrate. The old `docs/WISHLIST.md` already listed "Sharing (online, cloud
sharing, view permissions)" — this has been on the radar since early days.

Implication: the client side of an MVP is mostly wiring existing pieces; the genuinely new
work is the (small) backend + identity + payments.

---

## 3. Competitor landscape — what's commodity, what's paid

### Commodity (free everywhere — table stakes)

Getting *some* markdown onto the web at an unlisted URL is solved many times over for $0:
Notion public pages (free), Simplenote publish (free, live-updating, but being wound down),
HackMD (free w/ per-note permissions), GitHub Gist, telegra.ph / rentry.co (no account at
all). "Anyone with the link" hard-to-guess URLs are the universal free privacy model.

### What people actually pay for (verified pricing)

| Upsell | Evidence |
|---|---|
| **Custom domain** (#1 upsell) | Notion +$8–10/mo add-on; Craft Plus $96/yr; Obsidian Publish includes it in $96/yr |
| **The hosting itself** (local-first vendors) | Obsidian Publish $8/site/mo; iA Presenter ties sharing to its $5/mo sub |
| **Access control** | Passwords (Obsidian site-wide, Craft), expiring/use-limited invite links (HackMD Prime ~$4/mo) |
| **Scale/limits** | Craft free tier: 1,500 blocks, **no link sharing on free** historically; HackMD image-upload caps |
| **Analytics & SEO** | Craft "advanced share analytics" (Plus); Notion search-indexing (paid); DocSend $10–45/mo purely for view analytics |
| **Branding removal / white-label** | CleanShot Cloud Pro ($8/mo): custom domain + branding |

### Named gaps in the market

- **Bear has no link publishing** as of June 2026 — "Share note via web link" is a top
  community request ([thread](https://community.bear.app/t/share-the-bear-who-wants-to-be-able-to-share-notes-via-a-web-link/10650)).
  Bear Web (July 2025) is browse-your-own-notes, not publishing. Demand is demonstrably unmet
  in this exact category.
- **Live-updating links from a local doc:** only Simplenote does it (free, dying,
  Automattic-subsidized). Obsidian Publish requires a manual "Publish changes" push.
- **No polished desktop editor offers frictionless sharing**; that space is ceded to
  pastebins — for abuse reasons (see §6), not lack of demand.

---

## 4. Monetization model — what fits Ritemark

### The proven shapes, in order of fit

1. **Generous free cloud quota + paid tier (CleanShot pattern) — best fit.**
   CleanShot X: $29 one-time app + free 1GB Cloud + **Cloud Pro $8/mo** (unlimited, custom
   domain, branding, self-destruct links). The free quota is generous enough to teach the
   habit; the paid boundary is *durability and control of shares*, not the ability to share.
   Quota by storage or active-link count — not Loom's "25 ever" hard wall (converts but
   breeds resentment).

2. **Ladder to a Publish-style product (Obsidian pattern).**
   Share-link tier at the low end; "your docs as a site" at $8–10/mo later. Obsidian proves
   non-technical users pay $96/yr purely for convenience over free alternatives (Quartz
   etc.). Don't fight technical users who self-host — they're the evangelists.

3. **Hybrid one-time supporter/commercial layer (Sketch / Obsidian Catalyst).**
   A $25–50 one-time supporter or commercial license adds revenue without touching the free
   contract. Optional, compatible with #1.

### Pricing recommendation

- **Free:** share links included — e.g., **5 active links / 50 MB**, `ritemark.site` domain,
  "Made with Ritemark" footer, 90-day inactivity expiry, viewing never requires an account.
- **Ritemark Cloud Pro: $5/mo or $48/yr** — unlimited active links, password protection,
  expiry control, custom domain, view analytics, E2EE "secure share" mode, live-updating
  links, branding removal.
- Later: **Publish tier $8–10/mo** (multi-doc site, custom domain included, themes).
- Education/nonprofit ~40% discount (Obsidian's playbook — cheap goodwill).

Conversion math: at 2–5% of MAU converting at ~$48–60/yr, the feature pays for itself at
trivially small user counts since infra is ~$10/mo; use PostHog MAU to size the realistic
ceiling before committing to a Stripe integration sprint.

**Hard trust rules (from kepano's playbook, the reason Obsidian's model works):**
- The local editor stays fully functional, free, forever. Sharing is *additive*.
- Every paid feature has a free DIY alternative (BYO-backend publish, §5-C).
- Viewing a shared doc never requires an account (Figma/Loom viral-loop lesson).

---

## 5. Technical architectures (three tiers, all verified for cost)

### C — BYO-backend publish (zero liability, ship first)

Ulysses model: publish from the editor to the **user's own** GitHub Gist (device-flow OAuth,
RFC 8628 — clean for desktop), GitHub Pages, Ghost, or WordPress via user tokens.
**$0/mo at any scale, zero abuse liability**, and it serves the power-user crowd a
VS-Code-fork audience overlaps with heavily. Weeks of work, no ops. Not monetization itself —
goodwill, funnel, and the "free alternative" that makes the paid tier ethically clean.

### A — "Ritemark Link" hosted static publish (the real product)

Desktop app → device token (minted via GitHub/Apple sign-in or license key) → small
Cloudflare Worker issues presigned R2 PUT → app uploads rendered HTML + assets → served on a
**separate cookie-less domain** (e.g., `ritemark.site/<slug>` — same isolation reason GitHub
uses `githubusercontent.com`; protects the app/update-feed domain reputation). Republish on
save = overwrite object (Obsidian-style ~5s staleness; SSE "reload" ping later).

Cost (verified pricing inputs): **~$0/mo @ 1k docs, ~$5 @ 10k, ~$6–10 @ 100k.**
Use Workers static assets (Pages is in maintenance mode). Per-doc OG card via
[workers-og](https://github.com/kvnang/workers-og) — unfurls are the viral loop; a share
link without `og:image` looks like spam.

EU-hosting variant: Bunny.net (Slovenian CDN, $1/mo minimum) or Hetzner Object Storage
(€5.99/mo per TB) if "EU-hosted, no US parent" becomes part of the pitch; costs comparable.

### B — E2EE "Secure Share" (premium toggle, never the anonymous default)

Excalidraw/Bitwarden pattern: AES-GCM key generated client-side, ciphertext to storage, key
in the URL `#fragment` (never sent to the server). Genuine zero-knowledge — "we cannot read
your shared docs" (Proton-grade marketing). Trade-offs: kills OG previews, kills
agent-readability, and removes server-side abuse scanning — which is why **Firefox Send
died** (E2EE + anonymous + trusted domain = malware distribution platform). So: paid-only or
at minimum account-gated, default 30-day expiry, size caps, takedown-by-ID. Mirrors
Bitwarden's free-text/paid-file split.

### Later — live view & collaboration substrate

For read-only published docs, static republish is 10–100x cheaper than WebSockets. When
"viewers see typing live" or comments become differentiators: **self-hosted Hocuspocus**
(MIT, from the TipTap team, runs on Cloudflare Workers) + Yjs/y-prosemirror. **Avoid TipTap
Cloud** ($49–$1,199/mo, couples every doc to their hosting). Google-Docs-style suggested
edits no longer require TipTap's paid Tracked Changes add-on — two MIT ProseMirror
suggestion-mode libraries shipped in 2025
([prosemirror-suggestion-mode](https://github.com/davefowler/prosemirror-suggestion-mode),
[prosemirror-suggest-changes](https://github.com/handlewithcarecollective/prosemirror-suggest-changes)).

---

## 6. Abuse & legal (EU/Estonia) — the part that kills naive designs

- **Anonymous + instant + free + trusted domain = guaranteed phishing weaponization.**
  telegra.ph (1,429 documented phishing campaigns), 0x0.st (shut uploads entirely), Firefox
  Send (discontinued after malware abuse). **Do not ship anonymous publishing.** Identity =
  at least an app-bound device token from a GitHub/Apple sign-in; per-device rate limits and
  a revocation kill-switch.
- **DSA, not DMCA**, governs an Estonian host. Micro-enterprises are exempt from the heavy
  obligations, but **Article 16 notice-and-action is mandatory**: abuse-report link in every
  published page footer, abuse@ inbox, a takedown runbook, statement of reasons on removal.
  Modest, but must exist on day one. (US users: registering a DMCA agent costs $6.)
- **CJEU *Russmedia* (Dec 2025)** expands GDPR controller exposure for platforms exercising
  "decisive influence" over dissemination of user content → design for **minimal
  dissemination**: no public feeds, no discovery, no directory, `noindex` by default,
  unlisted URLs only. This is also the right product call.
- NIS2: out of scope at 1–2 people. Estonian DSA coordinator (TTJA) is under-resourced —
  enforcement posture toward micro-hosts is light-touch, but don't rely on that.
- Anti-abuse stack: size caps (~5 MB/doc), Turnstile (free) on any unauthenticated endpoint,
  Google Safe Browsing check on outbound links at publish time, default expiry for free-tier
  links. Markdown-only content means URL-reputation checks matter more than antivirus.
- Serve user content with DOMPurify + strict CSP; rendering from our own ProseMirror
  JSON→HTML serializer (no raw-HTML node) is inherently safer than hosting arbitrary HTML.

---

## 7. The non-obvious plays

### 7.1 Agent-native share links (the clever one — genuinely unoccupied)

Every Ritemark share link serves three representations of the same doc:

1. **Human:** rendered HTML page (OG card, Ritemark-styled).
2. **Agent, pull:** clean markdown at `<url>.md` and via `Accept: text/markdown` content
   negotiation — exactly the pattern Cloudflare ("Markdown for Agents"), Vercel, and Mintlify
   standardized in 2025; Claude Code, Cursor, ChatGPT et al. genuinely consume it (verified:
   llms-full.txt endpoints get ~4–5x the agent traffic of llms.txt; IDE agents fetch them
   routinely).
3. **Agent, protocol:** the link doubles as an **MCP resource** (e.g.,
   `<url>/mcp`). GitBook proved the per-site pattern (`/~gitbook/mcp`); **nobody ships
   per-document MCP share links as a consumer feature.** MCP is now Linux-Foundation-governed
   with ~440 connectors in Claude's directory — the consumption side exists.

Why this is Ritemark's wedge specifically: the product's identity is *markdown editor with
AI agents built in*. "Share with a person **or with their AI**" — paste the link into Claude
Code/ChatGPT and the agent reads the canonical markdown, not scraped HTML. Near-zero
marginal cost on top of Architecture A (it's the same R2 object served with different
content types), and a marketing story no competitor can tell credibly.

Corollary: **viewer-pays AI reading** (the Claude artifacts model) — never host inference on
free public pages; make the doc maximally readable by the *reader's* agent instead. An
"Ask your AI about this doc" button that copies the MCP/`.md` URL costs nothing.

Explicit design rule: **E2EE mode and agent-readable mode are mutually exclusive per link.**
Offer both as named modes ("Secure share" vs "Open share") and the privacy story and the AI
story reinforce instead of contradicting each other.

### 7.2 "Open in Ritemark" handback loop (unclaimed growth mechanic)

Every shared page gets a **"Duplicate to Ritemark"** button: deep link (`ritemark://`)
that pulls the `.md` into the recipient's local app — or routes to the download page if they
don't have it. This is Notion's duplicate-template viral engine crossed with `obsidian://`
URIs; no markdown editor does shared-web-doc → local-app handoff today. Every shared doc
becomes a distribution channel for the app itself — which matters more than the
subscription revenue early on.

### 7.3 View analytics — the highest-WTP viewer feature

People demonstrably pay **$10–45/mo for read receipts on documents** (DocSend; Papermark is
a thriving OSS clone proving the implementation is a known quantity). For Ritemark's
prosumer audience (proposals, specs, CVs, investor docs): "see who viewed, when, how long"
as a Pro feature is the single strongest paid-tier converter identified in this research.
Cheap to build on Architecture A (a Worker logging views per share ID).

### 7.4 Anonymous viewer comments (differentiator, phase 2+)

Friction-free commenting without viewer accounts is the most-requested gap where missing
(Figma's top complaint; Google Docs/Dropbox/Loom all allow it). Buildable with a tiny
comments table keyed by share ID — no Liveblocks dependency needed at small scale. Pairs
with suggested-edits (§5) into a "send for review" workflow — markdown review for normal
humans, which is precisely Ritemark's audience.

### Deliberately NOT recommended (hype or wrong layer)

- llms.txt as an SEO/AI-visibility play (crawlers ignore it; ship it only for agent fetching).
- x402 / pay-per-crawl micropayments for shared docs (private beta, publisher-oriented —
  revisit 2027).
- A2A protocol for doc exchange (enterprise orchestration layer, wrong abstraction).
- TipTap Cloud / commercial collab (cost cliff, couples docs to their hosting).
- Whole-vault sync as the first paid product (Obsidian-class effort; single-doc sharing has
  better effort/reward and matches the explicit product intent).

---

## 8. Recommended strategy & sequencing

> Free local editor forever → free BYO publish → hosted Ritemark Link with free quota →
> $5/mo Pro for durability, control, analytics, privacy → live/collab later.

| Phase | Scope | Backend | Monetization |
|---|---|---|---|
| **0. BYO publish** | "Publish to Gist / GitHub Pages / Ghost / WordPress" from editor; device-flow OAuth | None | Free (goodwill + the "free alternative") |
| **1. Ritemark Link MVP** | One-click share → `ritemark.site/<slug>`; GitHub/Apple sign-in → device token; republish-on-save; OG cards; `.md` endpoint from day one; abuse stack + DSA report link | Workers + R2 (~$0–10/mo) | Free quota (5 active links), instrument funnel in PostHog |
| **2. Pro tier ($5/mo)** | Stripe; unlimited links, passwords, expiry control, custom domain, **view analytics**, E2EE "Secure share", branding removal; `'premium'` feature-flag status finally used | + payments + entitlements | Primary revenue switch-on |
| **3. Agent-native + handback** | Per-doc MCP endpoint, "Ask your AI" button, `ritemark://` "Duplicate to Ritemark" | Marginal | Marketing wedge + app distribution loop |
| **4. Live & review (optional)** | Live-updating links (SSE → Hocuspocus read-only rooms), anonymous comments, suggested edits | Self-hosted Hocuspocus | Pro-tier stickiness; possible $8–10 Publish tier |

Phase order rationale: 0 is cheap insurance and community goodwill; 1 must exist before any
monetization (and its quota design determines conversion); 2 is the revenue event; 3 is the
differentiation event and can leapfrog ahead of 2 for launch marketing if desired — it's
nearly free once 1 exists.

**Open decisions for Jarmo before a sprint is planned:**
1. Identity provider for sign-in (GitHub device-flow is cheapest to build and fits the
   audience; Apple sign-in matters for a future App Store story).
2. Cloudflare (cheapest, best DX) vs EU-native stack (Bunny/Hetzner — "EU-hosted, no US
   parent" marketing); both verified viable at <$10/mo.
3. Free-tier quota shape (active-link count vs storage vs expiry) — determines conversion
   pressure vs goodwill.
4. Whether Phase 3 (agent-native) ships with Phase 1 as launch differentiator.
5. Pricing: $5/mo single Pro tier vs $4 share + $8 publish ladder.

---

## Appendix: key verified data points

| Fact | Source |
|---|---|
| Obsidian Sync $4/mo, Publish $8/site/mo (annual) | obsidian.md/pricing |
| Obsidian ~$25M ARR, 7–8 people, no VC (third-party est.) | BigGo Finance / readthesignal.co |
| Craft: link sharing tied to plans; Plus $96/yr w/ custom domain + share analytics | craft.do/pricing |
| CleanShot X: $29 one-time + Cloud Pro $8/mo | cleanshot.com/pricing |
| Bear Pro $2.99/mo; **no link publishing exists** (June 2026) | bear.app/faq, community.bear.app |
| Joplin Cloud from €2.99/mo incl. publishing | joplinapp.org/plans |
| DocSend $10–45/mo for view analytics; viewers never need accounts | docsend.com/pricing |
| Excalidraw E2EE: AES-GCM key in URL fragment | plus.excalidraw.com/blog/end-to-end-encryption |
| Firefox Send killed by malware abuse (E2EE + anonymous + trusted domain) | securityweek.com |
| R2: $0.015/GB-mo, zero egress; Workers $5/mo for 10M reqs | developers.cloudflare.com |
| TipTap Cloud $49–1,199/mo; Hocuspocus MIT self-host | tiptap.dev/pricing |
| GitBook per-site MCP endpoints on published docs | gitbook.com/docs (MCP servers) |
| llms-full.txt gets ~4–5x agent traffic of llms.txt; IDE agents fetch routinely | mintlify.com/blog traffic study |
| DSA Art. 16 notice-and-action applies even to micro-hosts | eur-lex 2022/2065 |
| CJEU Russmedia (C-492/23): platform GDPR controller duties for disseminated user content | twobirds.com, wsgr.com analyses |
| Freemium conversion benchmark 2–5% (3–5% good) | Lenny's Newsletter, ChartMogul |

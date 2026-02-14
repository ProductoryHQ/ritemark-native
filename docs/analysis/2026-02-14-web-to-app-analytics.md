# Web-to-App Analytics: Tracking the Full User Journey

**Date:** 2026-02-14
**Status:** Research Complete
**Author:** Claude (Engineering)

* * *

## Executive Summary

This document researches how to integrate analytics across Ritemark's full user journey: from website visit (Google Analytics) through download, installation, and active app usage. The goal is to answer the question: "Where do our users come from, and do they become active users?"

**Key Finding:** A two-system approach (GA on web + PostHog/Aptabase in app) connected via UTM-stamped download URLs provides the best balance of attribution accuracy, privacy, and implementation simplicity.

**Current State:** Ritemark has zero analytics infrastructure. Telemetry is explicitly disabled (`enableTelemetry: false`). No backend servers, no user accounts. This is a greenfield implementation.

* * *

## 1. The Problem

Two separate worlds need to be connected:

| World | Technology | Tracking |
| --- | --- | --- |
| **Web** (ritemark.ai) | Google Analytics | Browser cookies, sessions, UTM params |
| **Desktop App** (Electron/VS Code fork) | Nothing yet | No cookies, no browser context |

The bridge between them is the **download moment** - the only point where both worlds intersect.

### What We Want to Answer

1. Which marketing channels drive actual installs (not just page views)?
2. What percentage of downloaders become active users?
3. Which features drive retention?
4. Where do users drop off in the funnel?

* * *

## 2. The Full Funnel

```
Website Visit → Download Click → Install → First Launch → Activation → Retention
     GA              GA           (gap)      App Analytics   App Analytics
```

### Funnel Stages

| Stage | Where | Tracked By | Key Metric |
| --- | --- | --- | --- |
| 1. Website Visit | ritemark.ai | GA | Visitors by source |
| 2. Download Page | ritemark.ai/download | GA | Download page conversion rate |
| 3. Download Click | ritemark.ai | GA Event | Downloads by source/campaign |
| 4. Install | User's Mac | (gap - can't track) | Inferred from first launch |
| 5. First Launch | Ritemark app | App Analytics | Installs by attribution |
| 6. Activation | Ritemark app | App Analytics | First document created/opened |
| 7. Engagement | Ritemark app | App Analytics | AI feature usage, session length |
| 8. Retention | Ritemark app | App Analytics | DAU, WAU, MAU |

**The install gap** (stage 4) is inherent to desktop apps. You can't know if someone ran the installer. You infer it from first launch.

* * *

## 3. The Attribution Bridge

This is the most critical design decision: how to carry the "where did this user come from?" data from the web into the desktop app.

### Option A: UTM-Stamped Download URLs (Recommended)

**How it works:**

```
1. User visits ritemark.ai?utm_source=twitter&utm_campaign=launch
2. GA captures page view with UTM params
3. User clicks "Download for Mac"
4. Download URL carries attribution:
   ritemark.ai/download/Ritemark-1.4.0.dmg?src=twitter&cmp=launch
5. Server logs download with attribution params
6. On first app launch, attribution is resolved (see options below)
```

**Carrying attribution into the app (sub-options):**

| Method | Complexity | Reliability | Privacy |
| --- | --- | --- | --- |
| **A1: Attribution JSON in DMG** | Medium | High | Good |
| **A2: Per-campaign DMG builds** | High | Very High | Good |
| **A3: First-run survey** | Low | Medium (user may skip) | Excellent |
| **A4: Download redirect + API** | Medium | High | Good |

**Recommended: A4 (Download redirect + API)**

```
1. Download button → ritemark.ai/api/download?src=twitter&cmp=launch
2. Server generates a unique download token (e.g., dl_abc123)
3. Server logs: { token: dl_abc123, source: twitter, campaign: launch, timestamp: ... }
4. Server redirects to: CDN/Ritemark-1.4.0.dmg (normal DMG, no modification needed)
5. Token is stored in a lightweight attribution cookie or returned in response headers
6. On first app launch, app calls: ritemark.ai/api/attribute?token=dl_abc123
7. Server returns: { source: twitter, campaign: launch }
8. App stores attribution and includes it in first_launch event
```

**Alternatively (simpler but less precise): A1**

Include an `attribution.json` file inside the DMG:

```json
{
  "source": "direct",
  "campaign": "none",
  "version": "1.4.0",
  "downloaded": "2026-02-14"
}
```

For tracked campaigns, generate DMGs with specific attribution or use the download redirect to dynamically insert the JSON.

### Option B: Deep Links / Custom Protocol

Register `ritemark://` protocol handler. Website sets a deferred deep link that the app picks up on first launch.

**Verdict:** Overkill for current needs. More relevant for mobile apps. Skip for now.

### Option C: Clipboard-Based Attribution

Copy a hidden attribution token to clipboard on download, app reads clipboard on first launch.

**Verdict:** Unreliable, privacy-invasive, bad UX. Don't use.

### Recommendation

Start with **Option A1** (attribution JSON in DMG) for simplicity. Graduate to **A4** (download redirect + API) when you have a server/backend. Both approaches work without requiring user accounts or PII.

* * *

## 4. Desktop App Analytics Provider

### Requirements

| Requirement | Priority | Notes |
| --- | --- | --- |
| Privacy-first | Must | Aligns with Ritemark's values |
| No PII required | Must | No user accounts in Ritemark |
| Event-based analytics | Must | Not just page views |
| Funnel analysis | Should | Web → Install → Active |
| Retention charts | Should | DAU/WAU/MAU |
| Self-hosting option | Nice | Full data control |
| Electron/Node.js SDK | Must | Must work in VS Code extension context |
| Offline buffering | Should | Local-first app may be offline |
| Free tier for indie | Should | Early stage product |

### Provider Comparison

| Provider | Privacy | Self-Host | Electron SDK | Offline Buffer | Free Tier | Funnel Analysis |
| --- | --- | --- | --- | --- | --- | --- |
| **PostHog** | Good | Yes | JS SDK works in Node | Manual | 1M events/mo | Yes |
| **Aptabase** | Excellent | No | Purpose-built for desktop | Yes (built-in) | Free for indie | Basic |
| **TelemetryDeck** | Excellent | No | Swift-native, JS SDK | Partial | 100K signals/mo | Yes |
| **Mixpanel** | OK | No | JS SDK | Manual | 20M events/mo | Yes |
| **Amplitude** | OK | No | Node SDK | Manual | 50K MTUs | Yes |
| **Plausible** | Excellent | Yes | Web-only (no desktop) | No | Paid only | No |
| **Custom endpoint** | Full control | Yes | Custom | Custom | Dev time | Custom |

### Recommendations

**Primary: Aptabase**

- Purpose-built for desktop and mobile apps (not retrofitted web analytics)
- Privacy-first by design (no cookies, no PII, GDPR compliant out of the box)
- Built-in offline event buffering (critical for local-first apps)
- Electron SDK available
- Free for indie developers
- Simple API: `trackEvent("app_launched", { source: "twitter" })`
- Limitation: Less sophisticated funnel/retention than PostHog

**Alternative: PostHog**

- Much more powerful analytics (funnels, retention, feature flags, A/B tests)
- Self-hostable for full data control
- Generous free tier (1M events/month)
- JS SDK works in Node.js/Electron context
- Requires more setup and configuration
- Better choice if you want to deeply analyze user behavior

**Recommendation:** Start with **Aptabase** for simplicity and privacy alignment. Migrate to **PostHog** if/when you need deeper product analytics.

* * *

## 5. What to Track

### Privacy Principles

1. **Anonymous by default** - Random UUID per install, no PII
2. **No content ever** - Never track filenames, file contents, AI prompts
3. **No paths** - Never track file paths (they reveal username and directory structure)
4. **Aggregate over individual** - Track counts, not specifics
5. **Opt-out respected** - Kill switch in Settings, immediately stops all tracking

### Event Taxonomy

#### Lifecycle Events

| Event | Properties | Purpose |
| --- | --- | --- |
| `app_first_launch` | `attribution_source`, `attribution_campaign`, `app_version`, `os_version` | Attribution, install tracking |
| `app_session_start` | `app_version`, `session_number` | DAU/MAU calculation |
| `app_session_end` | `session_duration_seconds` | Engagement depth |
| `app_updated` | `from_version`, `to_version`, `update_method` | Update adoption rate |

#### Activation Events

| Event | Properties | Purpose |
| --- | --- | --- |
| `document_opened` | `is_new` (boolean), `document_count` (total) | Activation metric |
| `document_created` | `document_count` | Content creation |
| `workspace_opened` | `file_count_range` (e.g., "1-10", "11-50") | Usage scale |

#### Feature Adoption Events

| Event | Properties | Purpose |
| --- | --- | --- |
| `ai_feature_used` | `feature` (chat/flow/dictation/image), `ai_provider` (openai/gemini) | Feature adoption |
| `flow_executed` | `node_count_range`, `has_custom_nodes` | Flow complexity |
| `dictation_used` | `duration_range` | Dictation adoption |
| `settings_changed` | `setting_category` (not the value!) | Settings engagement |
| `theme_changed` | `theme` (light/dark) | UI preferences |

#### What We NEVER Track

| Data | Reason |
| --- | --- |
| File names or paths | Reveals personal info |
| File contents | Privacy violation |
| AI prompts or responses | User's private data |
| API keys | Security risk |
| IP addresses | Configure provider to strip |
| Exact file counts | Ranges are sufficient |
| Keystrokes or input | Surveillance |

* * *

## 6. Implementation Architecture

```
+---------------------------------------+
| Ritemark App                          |
|                                       |
|  +-------------+  +----------------+  |
|  | Extension   |  | Analytics      |  |
|  | Host        |--| Service        |  |
|  | (events)    |  |                |  |
|  +-------------+  | - event queue  |  |
|                    | - batch timer  |  |
|  +-------------+  | - offline buf  |  |
|  | Webview     |--| - opt-out chk  |  |
|  | (events)    |  |                |  |
|  +-------------+  +-------+--------+  |
|                           |           |
|  +-------------+          |           |
|  | Settings    |          |           |
|  | (opt-out    |          |           |
|  |  toggle)    |          |           |
|  +-------------+          |           |
+---------------------------+-----------+
                            | HTTPS (batched, every 5 min)
                            v
                     +---------------+
                     | Aptabase /    |
                     | PostHog       |
                     +---------------+
```

### Key Design Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Opt-in vs opt-out | **Opt-out** | VS Code precedent, better data, clear notice on first launch |
| Event delivery | **Batched** (5 min intervals) | Reduce network calls, battery-friendly |
| Offline handling | **Queue to disk** | Local-first app may be offline for extended periods |
| Anonymous ID | **Random UUID v4** | Generated on first launch, stored in app config |
| ID reset | **User can reset** | Settings option to generate new anonymous ID |

### File Structure (Proposed)

```
extensions/ritemark/src/
  analytics/
    analyticsService.ts    # Core service: init, track, flush, opt-out
    events.ts              # Event type definitions and validation
    attribution.ts         # First-launch attribution resolution
    constants.ts           # Event names, provider config
```

### First Launch Flow

```
1. App launches for the first time
2. Generate anonymous UUID, store in globalState
3. Check for attribution data (JSON in app bundle or API call)
4. Show first-launch notice:
   "Ritemark collects anonymous usage data to improve the app.
    No personal data is ever collected. You can disable this
    in Settings at any time."
   [OK] [Disable Analytics]
5. Send first_launch event with attribution data
6. Normal app usage begins, events queued and batched
```

* * *

## 7. Connecting GA and App Analytics

You won't have a single dashboard showing the full funnel. Instead, you'll stitch data across two systems:

### GA Dashboard (Web Side)

```
Visitors by Source → Download Page Views → Download Clicks
(utm_source)        (conversion rate)     (by source/campaign)
```

### App Analytics Dashboard (App Side)

```
First Launches → Activated Users → Retained Users
(by attribution  (opened 1+ doc    (returned in
 source)          in first week)    week 2+)
```

### Stitching the Funnel

Export data from both systems (weekly/monthly) and combine:

```
Source    | GA Visits | Downloads | First Launches | Activated | Retained (W2)
----------|-----------|-----------|----------------|-----------|-------------
Twitter   | 5,000     | 500       | 200            | 120       | 60
Blog Post | 2,000     | 400       | 300            | 250       | 150
HN        | 10,000    | 1,000     | 400            | 200       | 80
Direct    | 1,000     | 200       | 150            | 100       | 70
```

This tells you: Blog post readers convert and retain best. HN drives volume but lower retention.

**Future enhancement:** If using PostHog, you can use their Data Warehouse feature to import GA data and build a unified funnel in one dashboard.

* * *

## 8. Opt-Out Implementation

### Settings UI

Add to the existing Settings page:

```
Privacy & Analytics
  [Toggle] Send anonymous usage data

  Help improve Ritemark by sharing anonymous usage statistics.
  No personal data, file contents, or AI prompts are ever collected.

  [Reset Anonymous ID]  [View Privacy Policy]
```

### Technical Implementation

```typescript
// Check before every event
if (!config.get('analytics.enabled', true)) {
  return; // Silently drop the event
}
```

### Respecting System Preferences

On macOS, also check the system-level analytics preference:

```typescript
// Respect macOS "Share Analytics" preference
const systemAnalyticsEnabled = !app.commandLine.hasSwitch('disable-telemetry');
```

* * *

## 9. Timeline and Effort Estimate

| Phase | Work | Effort | Dependencies |
| --- | --- | --- | --- |
| 1. Provider setup | Create Aptabase/PostHog account, get API key | 1 hour | Decision on provider |
| 2. Analytics service | Core service, event queue, opt-out | 1 sprint | None |
| 3. Event instrumentation | Add tracking calls to key touchpoints | 1 sprint | Phase 2 |
| 4. Attribution bridge | UTM parsing, first-launch attribution | 0.5 sprint | Phase 2 |
| 5. Settings UI | Opt-out toggle, privacy notice | 0.5 sprint | Phase 2 |
| 6. GA download tracking | Event tracking on download button | 2 hours | Website access |
| 7. Dashboard setup | Configure funnels, retention charts | 2 hours | Phase 3 |

**Total estimate:** 2-3 sprints for full implementation.

* * *

## 10. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Users perceive analytics as surveillance | Trust damage, bad reviews | Clear communication, minimal data, easy opt-out |
| Analytics SDK increases bundle size | Larger app, slower load | Aptabase SDK is tiny (~20KB); PostHog is larger |
| Network calls reveal app usage to ISP | Privacy concern | Batch calls, use HTTPS, minimal frequency |
| Attribution data lost in DMG copy | Broken funnel tracking | Fallback to "direct/unknown" source |
| Provider goes down/changes pricing | Data loss, cost increase | Use provider with data export; PostHog self-host as backup |
| Over-instrumentation | Context overload, noise | Start with 10 core events, add more based on actual questions |

* * *

## 11. Recommendations

1. **Start with Aptabase** for desktop analytics (simplest, most privacy-aligned)
2. **Use UTM-stamped download URLs** for web-to-app attribution (Option A1)
3. **Track 10-12 core events** only (resist the urge to track everything)
4. **Opt-out model** with clear first-launch notice
5. **No PII, no content, no paths** - ever
6. **Batch events** every 5 minutes, buffer offline
7. **Stitch GA + app data manually** at first; automate later if needed
8. **Add to sprint planning** as a 2-3 sprint effort

* * *

## Appendix: VS Code Telemetry Precedent

VS Code handles telemetry as follows (relevant since Ritemark is a VS Code fork):

- **Opt-out by default** (telemetry is ON unless user disables it)
- **Three levels:** `all`, `error`, `crash`, `off`
- **Setting:** `telemetry.telemetryLevel`
- **Clear documentation** of what's collected
- **Extension telemetry** via `@vscode/extension-telemetry` package (sends to Azure Application Insights)

Ritemark has explicitly disabled VS Code's built-in telemetry (`enableTelemetry: false` in product.json). The analytics system proposed here is independent and purpose-built for Ritemark's needs.

* * *

## Appendix: Competitive Landscape

How other note-taking/writing apps handle analytics:

| App | Analytics | Approach |
| --- | --- | --- |
| Obsidian | Opt-in | Minimal, anonymous, community-respected |
| Notion | Full tracking | Account-based, extensive analytics |
| Bear | Opt-out | Apple-ecosystem, minimal |
| Typora | None | No analytics at all |
| iA Writer | Minimal | Crash reports only |

Ritemark's proposed approach (opt-out, anonymous, minimal events) aligns most closely with **Obsidian's** approach, which is well-regarded in the privacy-conscious note-taking community.

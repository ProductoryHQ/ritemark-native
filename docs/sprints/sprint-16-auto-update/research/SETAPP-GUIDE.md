# Setapp Distribution Guide

**Date:** 2026-01-13
**Verdict:** Future consideration, not for v1.0

---

## What is Setapp?

Setapp is a subscription service for Mac apps ("Netflix for Mac apps"):
- Users pay ~$10/month for access to 240+ apps
- Developers get revenue share based on usage
- 1M+ active subscribers

---

## Revenue Model

- **Subscription pool:** Monthly fees collected from all users
- **Distribution:** Split among developers based on app usage time
- **Typical earnings:** Varies widely by app popularity

---

## Requirements for RiteMark

### Technical Requirements

1. **Setapp Framework Integration**
   - Must integrate Setapp SDK into the app
   - SDK handles licensing, activation, analytics
   - Requires code changes

2. **Custom URL Scheme**
   - Must match bundle identifier
   - Used for activation flow

3. **Activation Flow**
   - App activates via Setapp without additional user steps
   - Must show activation status

4. **Code Signing & Notarization**
   - Still required for Setapp distribution
   - No way around Apple's requirements

### Quality Requirements

- High quality, polished app
- Good reputation/reviews
- Unique value proposition
- Setapp team reviews and approves

---

## Integration Effort

### Estimated Work
- SDK integration: 2-4 hours
- Testing activation flow: 1-2 hours
- Submission & review: Days to weeks
- **Total:** ~1 day dev + waiting

### Code Changes Required

```swift
// Add to app initialization
import Setapp

func applicationDidFinishLaunching() {
    SetappManager.shared.start(with: .default)
    // Check subscription status
    SetappManager.shared.subscriptionStatus { status in
        // Handle status
    }
}
```

---

## Pros & Cons for RiteMark

### Pros
- Access to 1M+ potential users
- Passive income stream
- Handles payment processing
- Good for Mac-focused apps

### Cons
- Revenue share (not direct sales)
- Still requires notarization
- SDK integration overhead
- Review process (may be rejected)
- Setapp users expect "premium" apps

---

## Recommendation

**Not for v1.0 launch.**

Consider Setapp when:
1. RiteMark is more mature
2. You want subscription revenue
3. You have time for SDK integration

For now, focus on:
1. GitHub Releases (primary)
2. Homebrew Cask (developer reach)

---

## If You Decide to Proceed

### Step 1: Apply
- https://setapp.com/developers
- Submit app info and screenshots

### Step 2: Get Approved
- Setapp reviews app quality
- May request changes

### Step 3: Integrate SDK
- Add Setapp Framework
- Implement activation

### Step 4: Submit Build
- Upload to Setapp portal
- Final review

### Step 5: Go Live
- App appears in Setapp catalog
- Start earning revenue share

---

## Sources

- [Setapp Developer Portal](https://setapp.com/developers)
- [Setapp Requirements](https://docs.setapp.com/docs/preparing-your-application-for-setapp)
- [Distribution Models](https://docs.setapp.com/docs/distribution-models-overview)
- [Setapp Wikipedia](https://en.wikipedia.org/wiki/Setapp)

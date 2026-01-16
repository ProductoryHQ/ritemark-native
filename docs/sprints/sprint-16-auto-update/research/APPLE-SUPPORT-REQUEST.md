# Apple Developer Support Request

**Topic:** App Distribution → Notarization
**Priority:** High
**Date:** 2026-01-13

---

## Subject

Notarization submission stuck "In Progress" for over 28 hours (January 2026 issue)

---

## Message

Hello,

I submitted my macOS application for notarization and it has been stuck in "In Progress" status for an unusually long time.

I've noticed multiple developers reporting similar issues in the Apple Developer Forums since January 2nd, 2026, with submissions stuck for 24-72+ hours despite the system status page showing "Operational".

### Submission Details

- **Submission ID:** a8e1af43-4716-40ca-b2b8-8e433f9d87ad
- **Submitted:** 2026-01-12T09:38:28.241Z (over 28 hours ago)
- **Package name:** RiteMark-notarize.zip
- **App name:** RiteMark
- **Team ID:** JKBSC3ZDT5
- **Apple ID:** jarmo@productory.eu

### What I've verified

1. The app is properly signed with Developer ID Application certificate
2. `codesign --verify --deep --strict` passes on all binaries
3. Previous submissions with signing issues correctly returned "Invalid" status within minutes
4. This submission uploaded successfully and has been "In Progress" since

### Context

This is my first notarization from this developer account. I understand first submissions may take longer, but 28+ hours seems excessive given Apple's stated target of 98% completion within 15 minutes.

### Commands used to check status

```
xcrun notarytool info a8e1af43-4716-40ca-b2b8-8e433f9d87ad \
  --apple-id "jarmo@productory.eu" \
  --team-id "JKBSC3ZDT5" \
  --password [app-specific-password]
```

Response:
```
Successfully received submission info
  createdDate: 2026-01-12T09:38:28.241Z
  id: a8e1af43-4716-40ca-b2b8-8e433f9d87ad
  name: RiteMark-notarize.zip
  status: In Progress
```

### Request

Could you please check the status of this submission and advise if there are any issues or if this delay is expected? I have users waiting for this release.

Thank you for your assistance.

Best regards,
Jarmo Tuisk
Developer ID: JKBSC3ZDT5

---

## How to Submit

1. Go to: https://developer.apple.com/contact/
2. Sign in with Apple ID
3. Select: **Development and Technical** → **Other Development or Technical Questions**
   - (This is what Apple recommends in forums for stuck notarization)
4. Or try: **Membership and Account** → **App Distribution**
5. Copy/paste the message above

---

## Alternative: Developer Forums

Post at: https://developer.apple.com/forums/tags/notarization

Subject: First notarization stuck "In Progress" for 28+ hours

(Same content, may get community or Apple engineer response)

---

## Reference: Similar Reports (January 2026)

- https://developer.apple.com/forums/topics/code-signing-topic/code-signing-topic-notarization
- Multiple developers reporting 24-72h+ stuck submissions since Jan 2, 2026
- System status shows "Operational" but processing is delayed

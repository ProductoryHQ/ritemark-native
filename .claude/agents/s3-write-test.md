---
name: s3-write-test
displayName: S3 Write Test
description: Sprint 80 S3/R4 test agent — attempts a file write so the headless policy blocks it.
schedule:
  cron: "*/15 * * * *"
  enabled: false
---

Create a new file named `scheduled-test-output.md` in the workspace root. Its content must be exactly one line: "Written by the S3 scheduled test agent." Do not do anything else — no shell commands, no other files.

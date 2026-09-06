# Microsoft Store release candidates

This directory holds one immutable evidence record per Windows binary considered for Microsoft Store submission.

Copy [`../templates/release-candidate-record.md`](../templates/release-candidate-record.md) to a name such as:

- `v1.10.0-candidate-1.md`
- `v1.10.0-candidate-2.md`
- `v1.11.0-candidate-1.md`

If bytes change, create a new candidate record and a new hosted path. Never overwrite a submitted candidate's version, URL, or SHA-256 to describe another build.

The Store process remains release-independent even though each binary has a release version. This directory is the bridge between the reusable submission hub and release-specific build evidence.

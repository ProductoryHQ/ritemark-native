# Sprint 117 Phase 0 fixtures

Synthetic inputs for the collector, round-trip, protocol, and store tests. No real user documents, transcripts, or identifiers. Each file names the scenario it serves in [../../scenarios.md](../../scenarios.md).

| File | Serves |
|---|---|
| `anchored-single.md` | Single comment creates one accepted task |
| `anchored-multiblock.md` | One multi-block mark (shared id) counts once |
| `anchored-link-split.md` | Link-split fragments stay one comment |
| `standalone-legacy-no-id.md` | Standalone note receives a stable ID before dispatch |
| `standalone-with-id.md` | Proposed `{id:…}` carrier round-trips |
| `duplicate-ids.md` | Duplicate ID with a different note is re-minted |
| `two-agents-and-unsupported.md` | Meaningful second mention survives; unsupported alias does not dispatch |
| `same-text-A.md`, `same-text-B.md` | Two documents reuse the same legacy comment text |
| `records/task-completed.json` | `CommentTaskRecordV1` in `completed` |
| `records/task-needs-user.json` | `CommentTaskRecordV1` in `needs-user` |
| `protocol/accept-request.json` | `comment-task/accept` |
| `protocol/accept-result-ok.json` | accepted result |
| `protocol/accept-result-queue-full.json` | rejected result |
| `protocol/projection.json` | `comment-task/projection` snapshot |

UUIDs below are fixed test values, not minted ones.

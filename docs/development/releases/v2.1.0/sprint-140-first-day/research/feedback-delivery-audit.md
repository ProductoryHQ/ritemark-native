# What a feedback send can know it delivered (R13, D6)

26 October 2026.

## The question

The straight route says "Thank you. It's with the people who make Ritemark." only when the service accepted the message (D6). `ConsentGate.sendFeedback` sends through posthog-node's `captureImmediate`, with usage data on (the shared client) or off (a client made for that one send). Does a failed request tell it so?

## What posthog-node 5.35.8 does

`captureImmediate` awaits the HTTP request, but a failed request (a refused connection, a 5xx after its retries) does not reject: the client emits `'error'` and the promise resolves. So 2.0's `sendFeedback` returned true for a send that never arrived, with usage data on and off.

## The fix

`analytics/posthog.ts` `createClient` wraps the client: it counts `'error'` emissions, and `captureImmediate` throws when an error was emitted during that send. `sendFeedback` catches it and returns false. Tests in `consent.test.ts` (an offline harness: the send fails, false; a reachable one, true).

## Checked live, with a local stand-in

PostHog's host pointed at a stand-in on 127.0.0.1:9241 (`RITEMARK_POSTHOG_HOST`, `RITEMARK_POSTHOG_PROJECT_KEY=phc_local_standin`); nothing left the Mac.

| Case | Result |
|---|---|
| Usage data on, the stand-in answering | `feedback_opened {from}` then `feedback_sent {message}`; the sheet closed; the thank-you showed |
| The stand-in answering 503 | The sheet stayed with the message, "It didn't go. Your message is still here: try again, or open it in e-mail.", Open in e-mail and Try again (D5) |
| Usage data off (`ritemark.analytics.enabled: false`) | Only `feedback_sent {message}`, from a one-off id (not the profile's), with no shared properties; no `feedback_opened`; the thank-you showed |
| The first-week card on Home | `feedback_sent {message, asked: made_this_week}`; the card gone for the release |

## What the words claim

The thank-you claims the service accepted it, which is now what Ritemark knows. The e-mail route never says sent (`emailRouteStrings()` against `DELIVERY_CLAIM_WORDS`, `feedback.test.ts`). A message held for later is not built: a send that did not go stays in the sheet.

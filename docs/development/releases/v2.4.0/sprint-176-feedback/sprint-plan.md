# Sprint 176 · Hear from people

**Draft for the manager's approval** · SDD · Phase 2, planning · Planning branch and worktree `plan/sprint-176-feedback`, based on `ba93ceba`. Implementation branch after approval `sprint-176-feedback`.

Parent release v2.4.0. App half of #1045. Jarmo put the app half in 2.4 on 25 November (“3. Jah rakenduse pool 2.4.”). Approved by the Development manager on 25 November under the 2.4 roadmap, which Jarmo approved (sprint plans are the manager's); the scope is Jarmo's decision of the same day. The design is the Experience lead's experience 53, in words, kept in the private design repository (ritemark-dev `8b13e5e`, `product/design/experience/experiences/voice/README.md`). The frames follow by 27 November.

## SDD artifacts

- [Spec](spec.md) gives the behaviour for R1–R6.
- [Scenarios](scenarios.md) gives the proof for S1–S12.
- [Technical plan](technical-plan.md) records the audit, changes and events.
- [Tasks](tasks.md) gives the PR order, tiers and proof.

## Scope

People can react while they read an AI answer and open feedback from a failure. Send feedback can carry a picture of the Ritemark window by e-mail. Home gives one earned invitation to star the project or join Discussions, and Help keeps both links handy. Saved days carry forward when the app updates.

## Decisions on 25 November

1. **Use the existing doors and the Home slot.** The action belongs beside the answer or failure. Send feedback keeps its status-bar and Help entrances, and Home shows one guidance card at a time.
2. **Keep the mark small.** A thumb sends `ai_answer_reacted` only with usage data on; with it off, a thumb sends nothing and still counts locally for Home, and thumbs-down offers the ordinary Send feedback. An explicit Send with usage data off sends exactly what it sends today, the text only, through the existing one-off route: the new `from` property goes only with usage data on, so the usage-off rules don't change (manager, 25 November). Growth writes the privacy line for the usage-on events, with Jarmo's yes, before 2.4 publishes.
3. **Show what goes.** A failure quote is visible and removable. A selected answer goes through the existing report mail route with the exact excerpt shown. The window picture waits in memory until the person opens e-mail and chooses to paste it. This uses the existing mail path and requires no upload service.
4. **Remember the invitation locally.** Count real presentations once per release and up to three per rolling year. The app can observe the Star browser handoff, so an accepted handoff ends the ask. Keep saved dates across releases so frequent updates no longer reset progress.
5. **Use the shell where it owns the surface.** Help filters contributed actions and the feedback sheet is workbench DOM. Both changes go in the 2.4 app build. Webview buttons use shadcn Button and `ui/tooltip.tsx` and stay on one line. Shell buttons and menu items use their existing platform controls and available hints. Popups close on outside click and Esc. The Experience lead checks the native-control mapping.

## Success criteria

- [ ] Every AI’s finished answer gives the person the correct thumb and a way to add words (R1).
- [ ] Supported failure cards open a removable quote, and Send sends only the reviewed content (R2).
- [ ] The Home invitation appears after the first session and an earned action, respects both caps and stays away after Star (R3).
- [ ] A window picture can be inspected and handed to e-mail on each platform with explicit action (R4).
- [ ] Both Help links remain available alongside Send feedback (R5).
- [ ] Distinct saved days survive an update with usage data off and while offline (R6).
- [ ] Experience accepts the visible states, the privacy wording has Jarmo’s yes and final QA records S1–S12.

## Release notes

You can now tell us when an AI answer helped or missed the mark.

- **Report a problem where it happened.** Open **Tell us about this** on a failure card and edit the message before sending.
- **Show us what you saw.** Preview a picture of your Ritemark window and paste it into your feedback e-mail.
- **Find Ritemark’s community.** Open the project on GitHub or join **Discussions** from Help.
- **Keep your saved days after updates.** Ritemark remembers them when deciding when to invite you to its GitHub community.

## Out of scope

Growth owns the website and community half of #1045, including Discussions setup, posts and the privacy-page wording. Ratings, surveys, interrupting prompts and a picture upload service are outside this sprint.

## Risks and open decisions

- **Frames.** The Experience lead settles exact failure-card coverage, footer and Home layout, native menu grouping and picture preview and handoff states on 27 November.
- **Window capture.** The native API and clipboard need proof on both platforms. The feedback sheet PR starts with a spike; if the pinned shell has no supported capture of the originating window alone, the window picture is cut from 2.4 (the other five items don't depend on it), never shipped as a stub, and the manager says so in the PR.
- **Local caps.** Legacy data can recover only days still stored. Concurrent Home windows need proof that they spend at most one display per release.
- **Delivery language.** Usage-off and offline thumbs can qualify locally. An e-mail handoff and a browser handoff have separate meanings from delivered feedback and a star. Check the final words against those outcomes.
- **Consent.** Settled in decision 2. The privacy page's wording is Growth's, with Jarmo's yes, before publish.

## Approval

- [x] Approved by the Development manager, 25 November, with decisions 2 and the window-capture fallback settled.
- Implementation starts on `sprint-176-feedback` branches; the visible PRs wait for the Experience lead's frames (27 November), and PR 1 (saved days) can start before them.

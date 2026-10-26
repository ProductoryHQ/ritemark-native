/**
 * The always-visible way to report AI output — Sprint 126 (RQ1).
 *
 * Microsoft Store policy 11.16 asks for a "discoverable, working user action".
 * Sprint 126 put "Report AI issue" in the status bar at priority 99.
 *
 * Sprint 140 (R10, R16): the status bar's door is now "Send feedback"
 * (`feedback/feedbackStatusBar.ts`), whose tooltip names AI issues and whose
 * sheet has the AI-issue box; AI information keeps its labelled "Report an AI
 * issue". This command id stays registered there and opens the same sheet,
 * ready for an AI issue.
 */

export const REPORT_COMMAND_ID = 'ritemark.reportAIOutput';

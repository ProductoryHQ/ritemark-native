/**
 * Platform detection for webview context
 */

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** Modifier key label: "Cmd" on macOS, "Ctrl" on Windows/Linux */
export const modKey = isMac ? 'Cmd' : 'Ctrl'

/** Platform-appropriate spreadsheet app name when Excel is not available */
export const defaultSpreadsheetApp = isMac ? 'Numbers' : 'Spreadsheet App'

/** Whether the current platform is macOS */
export { isMac }

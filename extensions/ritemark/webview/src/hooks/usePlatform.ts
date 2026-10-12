/**
 * Platform detection for webview context
 */

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** Modifier key label: "Cmd" on macOS, "Ctrl" on Windows/Linux */
export const modKey = isMac ? 'Cmd' : 'Ctrl'

/** Platform-appropriate spreadsheet app name when Excel is not available */
export const defaultSpreadsheetApp = isMac ? 'Numbers' : 'Spreadsheet App'

/** Whether the current platform is Windows */
const isWindows = /Win/.test(navigator.platform || navigator.userAgent)

/** The platform in the extension host's terms (`process.platform`) */
export type WebviewPlatform = 'darwin' | 'win32' | 'linux'
export const webviewPlatform: WebviewPlatform = isMac ? 'darwin' : isWindows ? 'win32' : 'linux'

/** Whether the current platform is macOS */
export { isMac, isWindows }

/** The whole-window sheet's dev demo (`devSheetDemo.ts`) is asked for by this variable, in a development build only. */
export const SHEET_DEMO_SETTING = 'RITEMARK_WEBVIEW_SHEET_DEMO';

/** The trigger file a launch named (pure, tested): none outside a development build. */
export function sheetDemoTrigger(env: Record<string, string | undefined>): string | undefined {
  if (env.VSCODE_DEV !== '1') return undefined;
  const value = env[SHEET_DEMO_SETTING]?.trim();
  return value ? value : undefined;
}

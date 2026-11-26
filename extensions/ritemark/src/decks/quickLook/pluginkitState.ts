export const quickLookSettingsUrl = 'x-apple.systempreferences:com.apple.LoginItems-Settings.extension';

export type PluginkitState = 'on' | 'off' | 'unknown';

/** A single matching registration with an explicit election. Duplicate copies are ambiguous. */
export function parsePluginkitState(stdout: string, bundleId: string): PluginkitState {
  const match = /^([+-])[ \t]+([^\s(]+)(?:\([^()\r\n]+\))?$/.exec(stdout.trim());
  if (!match || match[2] !== bundleId) return 'unknown';
  return match[1] === '+' ? 'on' : 'off';
}

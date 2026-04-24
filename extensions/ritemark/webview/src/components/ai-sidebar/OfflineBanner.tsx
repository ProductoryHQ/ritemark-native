/**
 * OfflineBanner — warning when offline.
 */

import { Icon } from '../ui/Icon';
import { Alert, AlertDescription } from '../ui/alert';

export function OfflineBanner() {
  return (
    <div className="px-3 py-2">
      <Alert>
        <div className="flex items-center gap-2">
          <Icon name="wifi-slash" size={14} className="shrink-0 opacity-70" />
          <AlertDescription className="text-xs">
            <strong>Offline</strong> — AI features require internet connection
          </AlertDescription>
        </div>
      </Alert>
    </div>
  );
}

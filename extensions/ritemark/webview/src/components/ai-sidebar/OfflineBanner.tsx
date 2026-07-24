/**
 * OfflineBanner — warning when offline.
 */

import { Icon } from '../ui/Icon';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { useAISidebarStore } from './store';

export function OfflineBanner() {
  const isCheckingConnectivity = useAISidebarStore((s) => s.isCheckingConnectivity);
  const recheckConnectivity = useAISidebarStore((s) => s.recheckConnectivity);

  return (
    <div className="px-3 py-2">
      <Alert>
        <div className="flex items-center gap-2">
          <Icon name="wifi-slash" size={14} className="shrink-0 opacity-70" />
          <AlertDescription className="text-xs">
            <strong>Offline</strong> — AI features require internet connection
          </AlertDescription>
          <Button
            variant="link"
            size="sm"
            className="ml-auto h-auto shrink-0 p-0 text-xs"
            disabled={isCheckingConnectivity}
            onClick={recheckConnectivity}
          >
            {isCheckingConnectivity ? 'Checking…' : 'Check again'}
          </Button>
        </div>
      </Alert>
    </div>
  );
}

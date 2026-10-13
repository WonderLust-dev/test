import { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2, RefreshCw, X } from 'lucide-react';

interface OfflineIndicatorProps {
  isOffline: boolean;
  wasOffline?: boolean;
  pendingSyncCount?: number;
  onSyncNow?: () => void;
}

export default function OfflineIndicator({
  isOffline,
  wasOffline = false,
  pendingSyncCount = 0,
  onSyncNow,
}: OfflineIndicatorProps) {
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal when offline state flips
  useEffect(() => {
    setDismissed(false);
  }, [isOffline]);

  if (!isOffline && !wasOffline) return null;
  if (dismissed && isOffline) return null;

  return (
    <div className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-50 animate-fadeIn max-w-[92vw] sm:max-w-md w-full px-2 pointer-events-auto">
      {isOffline ? (
        <div className="flex items-center justify-between gap-2.5 px-3.5 py-2 rounded-2xl bg-amber-500 text-white shadow-xl text-xs font-bold border border-amber-400/40 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <WifiOff size={14} className="text-white" />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="block truncate">Offline Mode Active</span>
              <span className="text-[10px] font-normal opacity-90 block truncate">
                {pendingSyncCount > 0
                  ? `Saved locally • ${pendingSyncCount} item${pendingSyncCount > 1 ? 's' : ''} queued for cloud sync`
                  : 'Tests & answers are saved locally on this device'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {pendingSyncCount > 0 && onSyncNow && (
              <button
                onClick={onSyncNow}
                className="px-2 py-0.5 rounded-lg bg-white/20 hover:bg-white/30 text-[10px] font-extrabold transition-all"
                title="Retry syncing"
              >
                Sync
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="p-1 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-all"
              title="Dismiss banner"
              aria-label="Dismiss offline banner"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : wasOffline ? (
        <div className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-600 text-white shadow-xl text-xs font-bold border border-emerald-400/40 backdrop-blur-md animate-fadeIn">
          <CheckCircle2 size={15} className="text-emerald-200 shrink-0" />
          <span>Back Online! All test progress synced to cloud.</span>
        </div>
      ) : null}
    </div>
  );
}

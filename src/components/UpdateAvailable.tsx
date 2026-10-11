import { RefreshCw } from 'lucide-react';

interface UpdateAvailableProps {
  onUpdate: () => void;
}

export default function UpdateAvailable({ onUpdate }: UpdateAvailableProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div className="glass-panel rounded-2xl p-4 shadow-strong border border-white/30">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-500">
              <RefreshCw size={24} className="text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm mb-1">
              Update Available
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              A new version of SSC CGL Prep is available. Update now for the latest features and improvements.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onUpdate}
                className="flex-1 px-3 py-2 btn btn-primary text-xs"
              >
                Update Now
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-2 btn btn-ghost text-xs"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

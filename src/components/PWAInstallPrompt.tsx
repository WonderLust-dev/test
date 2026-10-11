import { Download, X } from 'lucide-react';

interface PWAInstallPromptProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export default function PWAInstallPrompt({ onInstall, onDismiss }: PWAInstallPromptProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-slide-up">
      <div className="glass-panel rounded-2xl p-4 shadow-strong border border-white/30">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-brand)' }}>
              <Download size={24} className="text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm mb-1">
              Install SSC CGL Prep
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              Install the app for a better experience. Access your exams offline and get study reminders.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onInstall}
                className="flex-1 px-3 py-2 btn btn-primary text-xs"
              >
                Install Now
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-2 btn btn-ghost text-xs"
              >
                Later
              </button>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

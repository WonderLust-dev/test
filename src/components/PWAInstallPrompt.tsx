import { useState } from 'react';
import { Download, X, Share, PlusSquare, CheckCircle, Smartphone, Monitor, Sparkles } from 'lucide-react';

interface PWAInstallPromptProps {
  onInstall: () => void;
  onDismiss: () => void;
  showModal?: boolean;
  onCloseModal?: () => void;
  isIOS?: boolean;
}

export default function PWAInstallPrompt({
  onInstall,
  onDismiss,
  showModal = false,
  onCloseModal,
  isIOS = false,
}: PWAInstallPromptProps) {
  // If modal is requested, show full installation modal
  if (showModal && onCloseModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
        <div className="bg-[var(--bg-surface)] text-[var(--text-main)] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-[var(--border-color)] relative">
          {/* Close button */}
          <button
            onClick={onCloseModal}
            className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3.5 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center font-bold shadow-xs">
              <Download size={22} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[var(--text-main)] leading-tight">
                Install SSC CGL Prep
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                PWA • Works 100% Offline
              </p>
            </div>
          </div>

          {/* Benefits pills */}
          <div className="grid grid-cols-2 gap-2 mb-5">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle size={14} className="shrink-0 text-emerald-500" />
              <span>Full Offline Access</span>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
              <Sparkles size={14} className="shrink-0 text-indigo-500" />
              <span>Faster Load Speeds</span>
            </div>
          </div>

          {isIOS ? (
            /* iOS Installation Guide */
            <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-200/80 mb-5 text-xs text-gray-700">
              <div className="font-bold text-gray-900 flex items-center gap-2">
                <Smartphone size={16} className="text-indigo-600" />
                <span>How to Install on iPhone / iPad:</span>
              </div>
              <ol className="space-y-2.5 list-decimal list-inside text-gray-600 leading-relaxed font-medium">
                <li>
                  Tap the <strong className="text-gray-900 inline-flex items-center gap-1">Share button <Share size={13} className="inline text-blue-600" /></strong> in Safari's bottom toolbar.
                </li>
                <li>
                  Scroll down the share sheet and tap <strong className="text-gray-900 inline-flex items-center gap-1">Add to Home Screen <PlusSquare size={13} className="inline text-emerald-600" /></strong>.
                </li>
                <li>
                  Tap <strong className="text-gray-900">Add</strong> in the top-right corner to install on your home screen.
                </li>
              </ol>
            </div>
          ) : (
            /* Android / Desktop Installation Guide */
            <div className="space-y-3 mb-5">
              <button
                onClick={() => {
                  onInstall();
                  onCloseModal();
                }}
                className="w-full btn btn-primary text-xs py-3 rounded-full flex items-center justify-center gap-2 font-bold shadow-xs"
              >
                <Download size={16} />
                <span>Trigger Install Prompt</span>
              </button>

              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 text-[11px] text-gray-500 leading-relaxed">
                <p className="font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Monitor size={14} /> Desktop or Android Manual Install:
                </p>
                Click the <strong>Install App (⊕)</strong> icon on the right side of your browser's address bar, or open your browser menu (⋮) and choose <strong>"Install app"</strong>.
              </div>
            </div>
          )}

          <button
            onClick={onCloseModal}
            className="w-full text-center text-xs font-bold text-gray-500 hover:text-gray-900 py-1 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Floating prompt banner
  return (
    <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-fadeIn pointer-events-auto">
      <div className="bento-card p-4 shadow-xl border border-[var(--border-color)] bg-[var(--bg-surface)] backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gray-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Download size={18} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-[var(--text-main)] text-xs mb-0.5">
              Install SSC CGL Prep App
            </h3>
            <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
              Practice mock tests offline with zero lag. Installs directly onto your device.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onInstall}
                className="flex-1 px-3 py-1.5 btn btn-primary text-xs rounded-full font-bold shadow-2xs"
              >
                Install Now
              </button>
              <button
                onClick={onDismiss}
                className="px-3 py-1.5 btn btn-outline text-xs rounded-full font-medium"
              >
                Later
              </button>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

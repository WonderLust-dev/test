import { useState, useEffect, useCallback } from 'react';
import { syncPendingOfflineData, getPendingSyncCount } from '../services/database';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UsePWAReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  wasOffline: boolean;
  pendingSyncCount: number;
  syncNow: () => Promise<void>;
  install: () => Promise<void>;
  dismissInstall: () => void;
  updateAvailable: boolean;
  update: () => void;
}

export function usePWA(): UsePWAReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => getPendingSyncCount());
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if app is already installed
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSInstalled = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isIOSInstalled);
  }, []);

  const refreshPendingCount = useCallback(() => {
    setPendingSyncCount(getPendingSyncCount());
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      await syncPendingOfflineData();
      refreshPendingCount();
    } catch (e) {
      console.warn('[PWA] Manual sync failed:', e);
    }
  }, [refreshPendingCount]);

  // Listen for online/offline events & auto-sync
  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      setWasOffline(true);
      // Auto-dismiss the "back online" confirmation banner after 4 seconds
      setTimeout(() => setWasOffline(false), 4000);

      try {
        await syncPendingOfflineData();
        refreshPendingCount();
      } catch (err) {
        console.warn('[PWA] Auto-sync on reconnection failed:', err);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Refresh pending count periodically (e.g. after tests are completed)
    const interval = setInterval(refreshPendingCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount]);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const swUrl = `${import.meta.env.BASE_URL || './'}sw.js`;
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          setRegistration(reg);
          console.log('[PWA] Service Worker registered:', reg.scope);

          // Check for updates
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New update available
                    setUpdateAvailable(true);
                  }
                }
              };
            }
          };
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    }
  }, []);

  // Install the app
  const install = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] App installed');
      setIsInstalled(true);
    } else {
      console.log('[PWA] Install dismissed');
    }

    setDeferredPrompt(null);
  };

  // Dismiss install prompt
  const dismissInstall = () => {
    setDeferredPrompt(null);
  };

  // Update the app
  const update = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage('SKIP_WAITING');
      window.location.reload();
    }
  };

  return {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    isOffline,
    wasOffline,
    pendingSyncCount,
    syncNow,
    install,
    dismissInstall,
    updateAvailable,
    update,
  };
}

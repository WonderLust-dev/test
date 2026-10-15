import { useState, useEffect, useCallback } from 'react';
import { syncPendingOfflineData, getPendingSyncCount } from '../services/database';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface UsePWAReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  canInstall: boolean;
  isOffline: boolean;
  wasOffline: boolean;
  pendingSyncCount: number;
  showInstallModal: boolean;
  syncNow: () => Promise<void>;
  install: () => Promise<void>;
  dismissInstall: () => void;
  openInstallModal: () => void;
  closeInstallModal: () => void;
  updateAvailable: boolean;
  update: () => void;
}

function getSWRegistrationUrl(): { swUrl: string; scope: string } {
  let path = window.location.pathname;
  if (!path.endsWith('/')) {
    if (path.includes('.')) {
      path = path.substring(0, path.lastIndexOf('/') + 1);
    } else {
      path = `${path}/`;
    }
  }
  return {
    swUrl: `${path}sw.js`,
    scope: path,
  };
}

export function usePWA(): UsePWAReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => getPendingSyncCount());
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const isIOS = typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;

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
      console.log('[PWA] beforeinstallprompt captured successfully');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Also listen for appinstalled event
    const handleAppInstalled = () => {
      console.log('[PWA] App successfully installed on device');
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowInstallModal(false);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Register service worker with exact base URL and scope
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const { swUrl, scope } = getSWRegistrationUrl();
      console.log(`[PWA] Registering service worker at ${swUrl} with scope ${scope}`);

      navigator.serviceWorker
        .register(swUrl, { scope })
        .then((reg) => {
          setRegistration(reg);
          console.log('[PWA] Service Worker registered with scope:', reg.scope);

          // Pre-cache runtime scripts and stylesheets that were loaded by Vite
          const cacheRuntimeBundles = () => {
            const assetsToCache: string[] = [];
            document.querySelectorAll('script[src]').forEach((el) => {
              const src = (el as HTMLScriptElement).src;
              if (src && src.startsWith(window.location.origin)) {
                assetsToCache.push(src);
              }
            });
            document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
              const href = (el as HTMLLinkElement).href;
              if (href && href.startsWith(window.location.origin)) {
                assetsToCache.push(href);
              }
            });

            if (assetsToCache.length > 0 && (reg.active || navigator.serviceWorker.controller)) {
              const target = reg.active || navigator.serviceWorker.controller;
              target?.postMessage({
                type: 'CACHE_ASSETS',
                urls: assetsToCache,
              });
            }
          };

          // Cache on ready
          navigator.serviceWorker.ready.then(cacheRuntimeBundles);
          setTimeout(cacheRuntimeBundles, 1500);

          // Check for updates
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
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
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('[PWA] App install accepted');
          setIsInstalled(true);
          setShowInstallModal(false);
        } else {
          console.log('[PWA] App install dismissed by user');
        }
      } catch (e) {
        console.warn('[PWA] prompt error:', e);
      }
      setDeferredPrompt(null);
    } else {
      // If native deferred prompt is not ready or platform is iOS, open instructions modal
      setShowInstallModal(true);
    }
  };

  const openInstallModal = () => setShowInstallModal(true);
  const closeInstallModal = () => setShowInstallModal(false);

  const dismissInstall = () => {
    setDeferredPrompt(null);
  };

  const update = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage('SKIP_WAITING');
      window.location.reload();
    }
  };

  return {
    isInstallable: !!deferredPrompt && !isInstalled,
    isInstalled,
    isIOS,
    canInstall: !isInstalled,
    isOffline,
    wasOffline,
    pendingSyncCount,
    showInstallModal,
    syncNow,
    install,
    dismissInstall,
    openInstallModal,
    closeInstallModal,
    updateAvailable,
    update,
  };
}

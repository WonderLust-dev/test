import { useState, useEffect, useCallback } from 'react';

export type AppTheme = 'bento' | 'dark' | 'high-contrast';

const THEME_STORAGE_KEY = 'sscp_theme';

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') return 'bento';
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
      if (saved && (saved === 'bento' || saved === 'dark' || saved === 'high-contrast')) {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'bento';
  });

  const setTheme = useCallback((newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
      // Dispatch storage event for other components/tabs
      window.dispatchEvent(new CustomEvent('sscp_theme_change', { detail: newTheme }));
    } catch (e) {
      console.warn('Could not persist theme to localStorage:', e);
    }
  }, []);

  useEffect(() => {
    // Sync to html document attribute on mount & change
    document.documentElement.setAttribute('data-theme', theme);

    const handleExternalChange = (e: Event) => {
      const customEvent = e as CustomEvent<AppTheme>;
      if (customEvent.detail && customEvent.detail !== theme) {
        setThemeState(customEvent.detail);
      }
    };

    window.addEventListener('sscp_theme_change', handleExternalChange);
    return () => {
      window.removeEventListener('sscp_theme_change', handleExternalChange);
    };
  }, [theme]);

  return { theme, setTheme };
}

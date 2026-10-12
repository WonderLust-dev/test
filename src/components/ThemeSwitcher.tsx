import React from 'react';
import { Sun, Moon, Contrast, LucideIcon } from 'lucide-react';
import { useTheme, AppTheme } from '../hooks/useTheme';

interface ThemeSwitcherProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export const THEME_OPTIONS: Array<{
  id: AppTheme;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
}> = [
  {
    id: 'bento',
    label: 'Clean Light',
    shortLabel: 'Light',
    icon: Sun,
    description: 'Minimalist SaaS Bento layout',
  },
  {
    id: 'dark',
    label: 'Midnight Dark',
    shortLabel: 'Dark',
    icon: Moon,
    description: 'Pro dark mode for eye comfort',
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    shortLabel: 'Contrast',
    icon: Contrast,
    description: 'WCAG AAA maximum readability & bold outlines',
  },
];

export default function ThemeSwitcher({ variant = 'compact', className = '' }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center p-0.5 sm:p-1 rounded-full bg-[var(--bg-subcard)] border border-[var(--border-color)] shadow-2xs backdrop-blur-sm theme-switcher-container ${className}`}
        role="group"
        aria-label="Select color theme"
      >
        {THEME_OPTIONS.map((opt) => {
          const isActive = theme === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`relative p-1 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-xs theme-switcher-active'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)] theme-switcher-inactive'
              }`}
              title={`${opt.label} — ${opt.description}`}
              aria-label={opt.label}
              aria-pressed={isActive}
            >
              <Icon size={13} className={isActive ? 'text-amber-400' : 'text-[var(--text-subtle)]'} />
              <span className="hidden sm:inline text-[11px] font-bold">{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-2xs theme-switcher-card ${className}`}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-subtle)]">Theme</span>
        <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
          {theme === 'bento' ? 'Light' : theme === 'dark' ? 'Dark' : 'High Contrast'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[var(--bg-subcard)] border border-[var(--border-color)] theme-switcher-subgroup">
        {THEME_OPTIONS.map((opt) => {
          const isActive = theme === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xs border border-[var(--border-color)] theme-switcher-btn-active'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-subcard-hover)] theme-switcher-btn-inactive'
              }`}
              title={opt.description}
              aria-pressed={isActive}
            >
              <Icon
                size={16}
                className={`mb-1 ${isActive ? 'text-[var(--text-main)]' : 'text-[var(--text-subtle)]'}`}
              />
              <span className="text-[10px] leading-tight text-center">{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
        className={`inline-flex items-center p-1 rounded-full bg-white/80 border border-gray-200/90 shadow-2xs backdrop-blur-sm theme-switcher-container ${className}`}
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
              className={`relative p-1.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-gray-900 text-white shadow-xs theme-switcher-active'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/70 theme-switcher-inactive'
              }`}
              title={`${opt.label} — ${opt.description}`}
              aria-label={opt.label}
              aria-pressed={isActive}
            >
              <Icon size={14} className={isActive ? 'text-amber-300' : 'text-gray-400'} />
              <span className="hidden sm:inline text-[11px] font-bold">{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-2xl bg-white border border-gray-200/80 shadow-2xs theme-switcher-card ${className}`}>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Theme</span>
        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
          {theme === 'bento' ? 'Light' : theme === 'dark' ? 'Dark' : 'High Contrast'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-gray-50/80 border border-gray-100 theme-switcher-subgroup">
        {THEME_OPTIONS.map((opt) => {
          const isActive = theme === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? 'bg-white text-gray-900 shadow-2xs border border-gray-200/80 theme-switcher-btn-active'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-white/60 theme-switcher-btn-inactive'
              }`}
              title={opt.description}
              aria-pressed={isActive}
            >
              <Icon
                size={16}
                className={`mb-1 ${isActive ? 'text-gray-900' : 'text-gray-400'}`}
              />
              <span className="text-[10px] leading-tight text-center">{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

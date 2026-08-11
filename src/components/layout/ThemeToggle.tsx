'use client';

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Hydration-safe mounted check via useSyncExternalStore (no setState-in-effect).
const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro', icon: Sun, description: 'Tema claro' },
  { value: 'system', label: 'Sistema', icon: Monitor, description: 'Detectar sistema' },
  { value: 'dark', label: 'Oscuro', icon: Moon, description: 'Tema oscuro' },
] as const;

type ThemeValue = 'light' | 'dark' | 'system';

/**
 * Enhanced theme toggle for the sidebar.
 * 3-state dropdown (Light / System / Dark) with:
 * - Animated icon transitions on the trigger button
 * - Active theme indicator with check mark
 * - Keyboard shortcut Ctrl+Shift+D to cycle themes
 * - Resolved theme awareness (shows Sun/Moon based on system pref)
 * - Compact mode for sidebar integration
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const mounted = useSyncExternalStore(emptySubscribe, clientSnapshot, serverSnapshot);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Cycle through light → dark → system on keyboard shortcut
  const cycleTheme = useCallback(() => {
    const current = theme as ThemeValue;
    const cycle: ThemeValue[] = ['light', 'dark', 'system'];
    const currentIndex = cycle.indexOf(current);
    const nextIndex = (currentIndex + 1) % cycle.length;
    setTheme(cycle[nextIndex]);
  }, [theme, setTheme]);

  // Toggle between light and dark directly (most common action)
  const toggleDark = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  // Register keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggleDark();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDark]);

  // Hydration placeholder — avoids mismatch between server and client
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={compact ? 'h-8 w-8' : 'h-9 w-9'}
        aria-label="Cambiar tema"
        disabled
      >
        <Sun className="w-4 h-4" />
      </Button>
    );
  }

  // Determine which icon to show on the trigger based on resolved theme
  const TriggerIcon = resolvedTheme === 'dark' ? Moon : Sun;
  const isSystemActive = theme === 'system';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`
            relative text-sidebar-foreground/70 hover:text-sidebar-foreground
            hover:bg-sidebar-accent/40 transition-all duration-300
            ${compact ? 'h-8 w-8' : 'h-9 w-9'}
          `}
          aria-label="Cambiar tema"
          title="Cambiar tema (Ctrl+Shift+D)"
        >
          <span className="relative w-4 h-4">
            {/* Animated icon swap using CSS transitions */}
            <Sun
              className={`
                absolute inset-0 w-4 h-4 transition-all duration-300
                ${resolvedTheme === 'dark'
                  ? 'rotate-90 scale-0 opacity-0'
                  : 'rotate-0 scale-100 opacity-100'
                }
              `}
            />
            <Moon
              className={`
                absolute inset-0 w-4 h-4 transition-all duration-300
                ${resolvedTheme === 'dark'
                  ? 'rotate-0 scale-100 opacity-100'
                  : '-rotate-90 scale-0 opacity-0'
                }
              `}
            />
          </span>
          {/* System indicator dot — small dot when system mode is active */}
          {isSystemActive && (
            <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-sidebar-primary animate-pulse-subtle" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-48"
      >
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = theme === opt.value;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`
                gap-2.5 cursor-pointer transition-colors duration-150
                ${isActive ? 'font-medium' : ''}
              `}
            >
              <span className={`
                flex items-center justify-center w-4 h-4
                ${isActive ? 'text-primary' : 'text-muted-foreground'}
              `}>
                <Icon className="w-4 h-4" />
              </span>
              <span className="flex-1">{opt.label}</span>
              {isActive && (
                <Check className="w-3.5 h-3.5 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        {/* Keyboard shortcut hint */}
        <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
          <kbd className="kbd-key text-[10px]">Ctrl</kbd>
          <span>+</span>
          <kbd className="kbd-key text-[10px]">⇧</kbd>
          <span>+</span>
          <kbd className="kbd-key text-[10px]">D</kbd>
          <span className="ml-1">Alternar</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

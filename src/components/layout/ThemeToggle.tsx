'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Hydration-safe mounted check via useSyncExternalStore (no setState-in-effect).
const emptySubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * Theme toggle for the sidebar.
 * Cycles light / dark / system. Hydration-safe (renders a placeholder until mounted).
 */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const mounted = useSyncExternalStore(emptySubscribe, clientSnapshot, serverSnapshot);
  const { theme, setTheme } = useTheme();

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

  const isDark = theme === 'dark';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-[#162826] transition-colors ${compact ? 'h-8 w-8' : 'h-9 w-9'}`}
          aria-label="Cambiar tema"
          title="Cambiar tema"
        >
          {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem onClick={() => setTheme('light')} className="gap-2 cursor-pointer">
          <Sun className="w-4 h-4" />
          Claro
          {theme === 'light' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className="gap-2 cursor-pointer">
          <Moon className="w-4 h-4" />
          Oscuro
          {theme === 'dark' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} className="gap-2 cursor-pointer">
          <Monitor className="w-4 h-4" />
          Sistema
          {theme === 'system' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

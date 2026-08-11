'use client';

/**
 * AnimatedNumber
 * --------------
 * Animates a numeric value from its previous value to the new value
 * over `duration` ms using requestAnimationFrame and an ease-out cubic curve.
 *
 * Useful for dashboard KPIs where the underlying value changes frequently
 * and a hard swap would feel jarring.
 *
 * Notes:
 * - Handles negative numbers and decimals.
 * - Falls back to a hard render on the server (no animation) — the first
 *   client render will animate from 0 (or the previous value once mounted).
 * - Default formatter is `formatMoney` from `@/lib/format`.
 */

import { useEffect, useRef, useState } from 'react';

import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface AnimatedNumberProps {
  /** Target value to animate towards. */
  value: number;
  /** Animation duration in milliseconds. Defaults to 600. */
  duration?: number;
  /** Custom formatter (e.g. formatPercent, formatMoneyFull). Defaults to formatMoney. */
  format?: (n: number) => string;
  className?: string;
}

// Ease-out cubic: fast start, slow end. Maps t∈[0,1] → [0,1].
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export function AnimatedNumber({
  value,
  duration = 600,
  format = formatMoney,
  className,
}: AnimatedNumberProps) {
  // Keep a ref to the currently displayed value so subsequent animations
  // start from where we left off (rather than always from 0).
  const fromRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);
  const [display, setDisplay] = useState<number>(value);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;

    // No animation needed if the value hasn't changed (handles mount, SSR).
    // display is already in sync with `to`, so nothing to do.
    if (from === to) {
      return;
    }

    const start = performance.now();
    const delta = to - from;
    let cancelled = false;

    const tick = (now: number) => {
      if (cancelled) return;
      const elapsed = now - start;
      const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      const current = from + delta * eased;
      setDisplay(current);
      fromRef.current = current;

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Snap to exact target to avoid floating point drift on the final frame.
        setDisplay(to);
        fromRef.current = to;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [value, duration]);

  return (
    <span className={cn('tabular-nums', className)} aria-live="polite">
      {format(display)}
    </span>
  );
}

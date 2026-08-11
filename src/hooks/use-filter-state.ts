'use client';

import { useState, useCallback } from 'react';

/**
 * Persist a piece of UI filter state (e.g. dropdown selection, search query)
 * in the URL query string so that it survives page reloads and module
 * navigation, and so the URL can be shared/bookmarked.
 *
 * - On mount, hydrates the state from `?key=...` if present (JSON.parse),
 *   using a lazy `useState` initializer so there's no flash of the default
 *   value and no cascading effect render.
 * - On update, writes back with `window.history.replaceState` so we don't
 *   trigger a full page reload or scroll jump.
 * - Other existing URL params are preserved.
 *
 * Example:
 *   const [estado, setEstado] = useFilterState('reservas_estado', 'todos');
 *   <Select value={estado} onValueChange={setEstado} />
 */
export function useFilterState<T>(key: string, defaultValue: T) {
  // Lazy initializer: read once from the URL on the very first render so we
  // never display a stale default and don't need a follow-up setState effect.
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue;
    const params = new URLSearchParams(window.location.search);
    const stored = params.get(key);
    if (stored !== null) {
      try {
        return JSON.parse(stored) as T;
      } catch {
        /* ignore malformed param */
      }
    }
    return defaultValue;
  });

  const update = useCallback(
    (newValue: T) => {
      setValue(newValue);
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      params.set(key, JSON.stringify(newValue));
      const qs = params.toString();
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState({}, '', url);
    },
    [key]
  );

  return [value, update] as const;
}

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useHotelStore } from '@/lib/store';
import { usePresenceStore } from '@/lib/presence-store';

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

/** How often the client sends a heartbeat (ms) */
const HEARTBEAT_INTERVAL = 30_000;

/** How often the client fetches the online users list (ms) */
const POLL_INTERVAL = 15_000;

/** Delay before starting heartbeat (let the app load first) */
const START_DELAY = 5_000;

// ═══════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════

/**
 * usePresence — manages real-time online status tracking.
 *
 * - Sends a heartbeat every 30 s to /api/presence/heartbeat
 * - Polls /api/presence/online every 15 s to get the latest online list
 * - Updates the presence-store (usePresenceStore) for any component to read
 * - Cleans up on unmount
 * - Gracefully degrades: if the user is not logged in, does nothing
 *
 * Call this once in the app layout — all components read from usePresenceStore.
 */
export function usePresence() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const mountedRef = useRef(true);
  const startedRef = useRef(false);

  // ── Send heartbeat ──
  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch('/api/presence/heartbeat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Silently fail — heartbeat is best-effort
    }
  }, []);

  // ── Fetch online users ──
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/presence/online', {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.onlineUserIds)) {
        if (mountedRef.current) {
          usePresenceStore.getState().setOnlineUsers(data.onlineUserIds);
          usePresenceStore.getState().setLoaded(true);
        }
      }
    } catch {
      // Silently fail — will retry next poll
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Only start if user is logged in
    if (!usuarioActual) return;
    // Only start once (avoid double-init from React StrictMode)
    if (startedRef.current) return;
    startedRef.current = true;

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    const start = () => {
      if (!mountedRef.current) return;

      // Send first heartbeat immediately
      sendHeartbeat();
      // Fetch online users immediately
      fetchOnlineUsers();

      // Periodic heartbeat
      heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

      // Periodic poll for online users
      pollTimer = setInterval(fetchOnlineUsers, POLL_INTERVAL);
    };

    // Delayed start to not block initial app load
    startTimer = setTimeout(start, START_DELAY);

    return () => {
      mountedRef.current = false;
      startedRef.current = false;
      if (startTimer) clearTimeout(startTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [usuarioActual, sendHeartbeat, fetchOnlineUsers]);
}

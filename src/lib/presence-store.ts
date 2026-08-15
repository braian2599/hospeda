import { create } from 'zustand';

/**
 * Lightweight store for real-time user presence (online status).
 * Separate from the main hotel store to avoid coupling and breakage.
 *
 * Updated by the usePresence hook, consumed by any component that
 * needs to know who is currently online.
 */

interface PresenceStore {
  /** Set of tenantUserIds currently online */
  onlineUserIds: Set<string>;
  /** Convenience count */
  onlineCount: number;
  /** Whether the first fetch has completed */
  loaded: boolean;

  // Actions (called by usePresence hook)
  setOnlineUsers: (ids: string[]) => void;
  setLoaded: (loaded: boolean) => void;
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  onlineUserIds: new Set<string>(),
  onlineCount: 0,
  loaded: false,

  setOnlineUsers: (ids: string[]) =>
    set({
      onlineUserIds: new Set(ids),
      onlineCount: ids.length,
    }),

  setLoaded: (loaded: boolean) => set({ loaded }),
}));

/**
 * Convenience: check if a specific tenantUserId is online.
 */
export function isUserOnline(tenantUserId: string): boolean {
  return usePresenceStore.getState().onlineUserIds.has(tenantUserId);
}

import { create } from 'zustand';

/**
 * Store liviano para la presencia (quién está conectado).
 * Separado del store principal para no acoplarlo.
 *
 * Lo llena el hook useOnlineUsers, que corre SOLO en el módulo de Usuarios —
 * el único lugar donde se muestra el punto verde.
 */

interface PresenceStore {
  /** Set of tenantUserIds currently online */
  onlineUserIds: Set<string>;
  /** Convenience count */
  onlineCount: number;
  /** Whether the first fetch has completed */
  loaded: boolean;
  /**
   * false cuando la presencia no está disponible (Redis sin configurar). Sirve
   * para no mostrar a todo el mundo como desconectado, que es distinto de que
   * realmente no haya nadie.
   */
  disponible: boolean;

  // Actions (called by useOnlineUsers hook)
  setOnlineUsers: (ids: string[]) => void;
  setLoaded: (loaded: boolean) => void;
  setDisponible: (disponible: boolean) => void;
}

export const usePresenceStore = create<PresenceStore>((set) => ({
  onlineUserIds: new Set<string>(),
  onlineCount: 0,
  loaded: false,
  disponible: true,

  setOnlineUsers: (ids: string[]) =>
    set({
      onlineUserIds: new Set(ids),
      onlineCount: ids.length,
    }),

  setLoaded: (loaded: boolean) => set({ loaded }),

  setDisponible: (disponible: boolean) => set({ disponible }),
}));

/**
 * Convenience: check if a specific tenantUserId is online.
 */
export function isUserOnline(tenantUserId: string): boolean {
  return usePresenceStore.getState().onlineUserIds.has(tenantUserId);
}

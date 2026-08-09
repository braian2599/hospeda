/**
 * Notification store for Hospeda.
 * Manages in-app notifications with read/unread state, dismiss, and auto-expiry.
 */
import { create } from 'zustand';
import type { Notification } from '@/components/ui/notification-center';

interface NotificationStore {
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

let nextId = 0;

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],

  addNotification: (n) => {
    const id = `notif-${++nextId}-${Date.now()}`;
    const notification: Notification = {
      ...n,
      id,
      timestamp: new Date().toISOString(),
      read: false,
    };
    set({ notifications: [notification, ...get().notifications].slice(0, 50) });

    // Auto-dismiss info/success after 30 seconds
    if (n.type === 'info' || n.type === 'success') {
      setTimeout(() => {
        set({ notifications: get().notifications.filter(x => x.id !== id) });
      }, 30000);
    }
  },

  markRead: (id) => {
    set({
      notifications: get().notifications.map(n =>
        n.id === id ? { ...n, read: true } : n
      ),
    });
  },

  markAllRead: () => {
    set({
      notifications: get().notifications.map(n => ({ ...n, read: true })),
    });
  },

  dismiss: (id) => {
    set({ notifications: get().notifications.filter(n => n.id !== id) });
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));

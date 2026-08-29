/**
 * Enhanced Notification store for Hospeda.
 * Manages in-app notifications with categories, priorities, read/unread state,
 * action URLs, persisted flag, auto-dismiss, and smart grouping.
 */
import { create } from 'zustand';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

/** Notification categories aligned with hotel operations */
export type NotificationCategory = 'reserva' | 'pago' | 'checkin' | 'habitacion' | 'sistema' | 'limpieza';

/** Priority levels for notifications */
export type NotificationPriority = 'info' | 'warning' | 'urgent';

/** Legacy type alias for backward compatibility */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  /** Legacy type field — kept for backward compat; maps to priority internally */
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  /** Category for filtering and icon display */
  category: NotificationCategory;
  /** Priority level */
  priority: NotificationPriority;
  /** URL to navigate to when notification is clicked (e.g. module route) */
  actionUrl?: string;
  /** Label for the action button (e.g. "Ver reserva", "Cobrar") */
  actionLabel?: string;
  /** If true, notification survives auto-dismiss and page reload */
  persisted: boolean;
}

/** Input type for adding a notification (omits auto-generated fields) */
export type NotificationInput = Omit<Notification, 'id' | 'timestamp' | 'read'>;

/** Smart group: merged similar notifications */
export interface NotificationGroup {
  key: string;
  category: NotificationCategory;
  title: string;
  count: number;
  notifications: Notification[];
}

// ═══════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════

interface NotificationStore {
  notifications: Notification[];
  /** Track if a new notification was just added (for bell animation) */
  hasNew: boolean;
  addNotification: (n: NotificationInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  clearHasNew: () => void;
  /** Get unread count */
  getUnreadCount: () => number;
  /** Get grouped notifications for a category */
  getGrouped: (category?: NotificationCategory | 'all') => NotificationGroup[];
}

let nextId = 0;

/** Auto-dismiss timers (non-persisted, non-urgent notifications) */
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Clean up a timer */
function clearDismissTimer(id: string) {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],
  hasNew: false,

  addNotification: (n) => {
    const id = `notif-${++nextId}-${Date.now()}`;
    const notification: Notification = {
      ...n,
      id,
      timestamp: new Date().toISOString(),
      read: false,
    };
    set({
      notifications: [notification, ...get().notifications].slice(0, 100),
      hasNew: true,
    });

    // Auto-dismiss non-persisted, non-urgent notifications after 10 seconds
    if (!n.persisted && n.priority !== 'urgent') {
      clearDismissTimer(id);
      dismissTimers.set(id, setTimeout(() => {
        set({ notifications: get().notifications.filter(x => x.id !== id) });
        dismissTimers.delete(id);
      }, 10_000));
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
    clearDismissTimer(id);
    set({ notifications: get().notifications.filter(n => n.id !== id) });
  },

  clearAll: () => {
    // Clear all timers
    for (const id of dismissTimers.keys()) {
      clearDismissTimer(id);
    }
    set({ notifications: [] });
  },

  clearHasNew: () => {
    set({ hasNew: false });
  },

  getUnreadCount: () => {
    return get().notifications.filter(n => !n.read).length;
  },

  getGrouped: (category = 'all') => {
    const notifs = get().notifications;
    const filtered = category === 'all'
      ? notifs
      : notifs.filter(n => n.category === category);

    // Sort by timestamp descending
    const sorted = [...filtered].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Group by category + title similarity (within the same hour)
    const groups: NotificationGroup[] = [];
    const grouped = new Map<string, Notification[]>();

    for (const n of sorted) {
      // Group key: category + title (normalize for similar titles)
      const hourBucket = new Date(n.timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
      const key = `${n.category}:${n.title}:${hourBucket}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(n);
      } else {
        grouped.set(key, [n]);
        groups.push({
          key,
          category: n.category,
          title: n.title,
          count: 1,
          notifications: [n],
        });
      }
    }

    // Update counts and titles for merged groups
    for (const g of groups) {
      const items = grouped.get(g.key) || [];
      g.notifications = items;
      g.count = items.length;
      if (items.length > 1) {
        // Smart grouping title
        const categoryLabel = CATEGORY_LABELS[g.category] || g.category;
        g.title = `${items.length} ${categoryLabel.toLowerCase()} — ${g.title}`;
      }
    }

    return groups;
  },
}));

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  reserva: 'Reservas',
  pago: 'Pagos',
  checkin: 'Check-in',
  habitacion: 'Habitaciones',
  sistema: 'Sistema',
  limpieza: 'Limpieza',
};

export const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  reserva: 'text-info',
  pago: 'text-success',
  checkin: 'text-warning',
  habitacion: 'text-chart-5',
  sistema: 'text-muted-foreground',
  limpieza: 'text-warning',
};

export const CATEGORY_BG: Record<NotificationCategory, string> = {
  reserva: 'bg-[#0284C71A] border-l-info',
  pago: 'bg-[#0596691A] border-l-success',
  checkin: 'bg-[#D977061A] border-l-warning',
  habitacion: 'bg-[#8B5CF61A] border-l-chart-5',
  sistema: 'bg-muted border-l-muted-foreground',
  limpieza: 'bg-[#D977061A] border-l-warning',
};

export const PRIORITY_INDICATOR: Record<NotificationPriority, string> = {
  info: '',
  warning: 'border-warning',
  urgent: 'border-destructive',
};

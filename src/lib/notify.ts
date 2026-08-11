/**
 * Unified notification helper.
 * Pushes both a toast (transient feedback) AND a notification (persistent, shown in NotificationCenter).
 *
 * Usage:
 *   import { notifySuccess, notifyInfo, notifyWarning, notifyError } from '@/lib/notify';
 *   notifySuccess('Reserva guardada', 'Juan Pérez - Hab. 101');
 *   notify({ type: 'success', category: 'reserva', title: 'Nueva reserva', message: 'Juan Pérez', actionUrl: '/reservas/123', actionLabel: 'Ver reserva' });
 */
import { toast } from 'sonner';
import { useNotificationStore, type NotificationCategory, type NotificationPriority, type NotificationType } from '@/lib/notification-store';

// ═══════════════════════════════════════════════════════════
// ENHANCED NOTIFY
// ═══════════════════════════════════════════════════════════

interface NotifyOptions {
  type?: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  message?: string;
  actionUrl?: string;
  actionLabel?: string;
  persisted?: boolean;
}

/**
 * Push a notification with full control over category, priority, and actions.
 */
export function notify(opts: NotifyOptions) {
  const {
    type = 'info',
    category = 'sistema',
    priority = type === 'warning' ? 'warning' : type === 'error' ? 'urgent' : 'info',
    title,
    message = '',
    actionUrl,
    actionLabel,
    persisted = priority === 'urgent' || priority === 'warning',
  } = opts;

  // Toast (transient)
  const toastFn = type === 'success' ? toast.success : type === 'warning' ? toast.warning : type === 'error' ? toast.error : toast.info;
  toastFn(title, message ? { description: message } : undefined);

  // Notification center (persistent)
  try {
    useNotificationStore.getState().addNotification({
      type,
      title,
      message,
      category,
      priority,
      actionUrl,
      actionLabel,
      persisted,
    });
  } catch {
    // Store may not be ready during SSR — fail silently
  }
}

// ═══════════════════════════════════════════════════════════
// LEGACY SHORTCUTS (backward compatible)
// ═══════════════════════════════════════════════════════════

const pushNotification = (type: NotifyType, title: string, message?: string) => {
  try {
    useNotificationStore.getState().addNotification({
      type,
      title,
      message: message || '',
      category: 'sistema',
      priority: type === 'warning' ? 'warning' : 'info',
      persisted: false,
    });
  } catch {
    // Store may not be ready during SSR — fail silently
  }
};

type NotifyType = 'info' | 'success' | 'warning' | 'error';

export function notifySuccess(title: string, message?: string) {
  toast.success(title, message ? { description: message } : undefined);
  pushNotification('success', title, message);
}

export function notifyInfo(title: string, message?: string) {
  toast.info(title, message ? { description: message } : undefined);
  pushNotification('info', title, message);
}

export function notifyWarning(title: string, message?: string) {
  toast.warning(title, message ? { description: message } : undefined);
  pushNotification('warning', title, message);
}

// Note: errors are kept as toast-only (too noisy for the notification center)
export function notifyError(title: string, message?: string) {
  toast.error(title, message ? { description: message } : undefined);
}

// ═══════════════════════════════════════════════════════════
// CATEGORY-SPECIFIC HELPERS
// ═══════════════════════════════════════════════════════════

/** Notify about a new reservation */
export function notifyReserva(title: string, message: string, actionUrl?: string) {
  notify({ type: 'success', category: 'reserva', title, message, actionUrl, actionLabel: 'Ver reserva', persisted: true });
}

/** Notify about a payment */
export function notifyPago(title: string, message: string, actionUrl?: string) {
  notify({ type: 'success', category: 'pago', title, message, actionUrl, actionLabel: 'Ver pago', persisted: true });
}

/** Notify about check-in */
export function notifyCheckin(title: string, message: string, actionUrl?: string) {
  notify({ type: 'success', category: 'checkin', title, message, actionUrl, actionLabel: 'Ver reserva', persisted: true });
}

/** Notify about a room/habitación event */
export function notifyHabitacion(title: string, message: string, priority?: NotificationPriority) {
  notify({ type: priority === 'urgent' ? 'warning' : 'info', category: 'habitacion', priority: priority || 'info', title, message, persisted: priority === 'urgent' });
}

/** Notify about cleaning */
export function notifyLimpieza(title: string, message: string) {
  notify({ type: 'info', category: 'limpieza', title, message, actionLabel: 'Ver habitación', persisted: true });
}

/** Notify about system events */
export function notifySistema(title: string, message: string, priority?: NotificationPriority) {
  notify({ type: priority === 'urgent' ? 'warning' : 'info', category: 'sistema', priority: priority || 'info', title, message, persisted: priority === 'urgent' || priority === 'warning' });
}

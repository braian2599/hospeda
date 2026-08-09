/**
 * Unified notification helper.
 * Pushes both a toast (transient feedback) AND a notification (persistent, shown in NotificationCenter).
 *
 * Usage:
 *   import { notifySuccess, notifyInfo, notifyWarning, notifyError } from '@/lib/notify';
 *   notifySuccess('Reserva guardada', 'Juan Pérez - Hab. 101');
 */
import { toast } from 'sonner';
import { useNotificationStore } from '@/lib/notification-store';

type NotifyType = 'info' | 'success' | 'warning' | 'error';

const pushNotification = (type: NotifyType, title: string, message?: string) => {
  try {
    useNotificationStore.getState().addNotification({ type, title, message: message || '' });
  } catch {
    // Store may not be ready during SSR — fail silently
  }
};

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

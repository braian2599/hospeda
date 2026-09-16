/**
 * Enhanced Notification store for Hospi.
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
  /**
   * El usuario tuvo el panel abierto con esta notificacion adentro. A partir
   * de ahi NUNCA se descarta sola: solo se va si la borra a mano.
   * No la setea quien crea la notificacion — la marca el store.
   */
  vista?: boolean;
}

/** Input type for adding a notification (omits auto-generated fields) */
export type NotificationInput = Omit<Notification, 'id' | 'timestamp' | 'read' | 'vista'>;

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
  /** `${tenantId}:${tenantUserId}` de la sesion actual. null = todavia no hidrato. */
  duenio: string | null;
  /** Track if a new notification was just added (for bell animation) */
  hasNew: boolean;
  /**
   * El panel de notificaciones esta abierto en pantalla. Mientras lo este,
   * NADA se descarta solo: lo que llega se marca como visto de una.
   */
  panelAbierto: boolean;
  /** Lo llama el NotificationCenter al abrir y cerrar el panel. */
  setPanelAbierto: (abierto: boolean) => void;
  /**
   * Carga lo guardado en este navegador para ESTE usuario de ESTE hotel.
   * Lo llama el layout una vez que sabe quien inicio sesion. Si lo guardado
   * es de otro usuario, se descarta.
   */
  hidratar: (tenantId: string, tenantUserId: string) => void;
  /** Borra todo, de memoria y del navegador. Se llama al cerrar sesion. */
  olvidar: () => void;
  addNotification: (n: NotificationInput) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  /** Get unread count */
  getUnreadCount: () => number;
  /** Get grouped notifications for a category */
  getGrouped: (category?: NotificationCategory | 'all') => NotificationGroup[];
}

// ═══════════════════════════════════════════════════════════
// GUARDADO EN EL NAVEGADOR
// ═══════════════════════════════════════════════════════════
// Las notificaciones NO van a la base: Neon cobra por tiempo despierto y esto
// no vale una consulta. Van al localStorage del navegador, que es gratis.
//
// Lo que eso implica, y esta bien que asi sea:
//   - son por dispositivo: si el dueño entra desde el celular, ve las suyas
//   - se pierden si limpia los datos del navegador
//   - nunca salen de esa maquina
//
// DUEÑO: en el hotel se cambia de turno en la MISMA computadora. Lo guardado
// lleva marcado a que hotel y a que usuario pertenece; si al hidratar no
// coincide con quien esta entrando, se descarta entero. Nadie hereda las
// notificaciones del turno anterior.

const CLAVE_GUARDADO = 'hospi:notificaciones:v1';

/** Cuanto vive una notificacion guardada. Mas vieja que esto, se tira al entrar. */
export const DIAS_DE_VIDA = 7;

/** Tope de notificaciones, en memoria y en el guardado. */
export const TOPE_NOTIFICACIONES = 100;

interface Guardado {
  duenio: string;
  notifications: Notification[];
}

/** Identidad de quien es dueño de lo guardado. */
function claveDuenio(tenantId: string, tenantUserId: string): string {
  return `${tenantId}:${tenantUserId}`;
}

/**
 * Todo acceso al storage va envuelto: en modo incognito, con las cookies
 * bloqueadas o con el disco lleno, tirar una excepcion acá dejaria la
 * campanita rota. Una notificacion perdida no es grave; una pantalla en
 * blanco, si.
 */
function leerGuardado(): Guardado | null {
  if (typeof window === 'undefined') return null;
  try {
    const crudo = window.localStorage.getItem(CLAVE_GUARDADO);
    if (!crudo) return null;
    const dato = JSON.parse(crudo) as Partial<Guardado>;
    if (typeof dato?.duenio !== 'string' || !Array.isArray(dato.notifications)) return null;
    return { duenio: dato.duenio, notifications: dato.notifications as Notification[] };
  } catch {
    return null;
  }
}

function escribirGuardado(g: Guardado | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (g === null) window.localStorage.removeItem(CLAVE_GUARDADO);
    else window.localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(g));
  } catch {
    // Sin storage se sigue funcionando: las notificaciones viven en memoria.
  }
}

/** Una notificacion sirve para guardar si es de las que no se descartan solas. */
function vaAlGuardado(n: Notification): boolean {
  return n.persisted || n.priority === 'urgent';
}

function estaVencida(n: Notification, ahora: number): boolean {
  const t = Date.parse(n.timestamp);
  // Una fecha ilegible se trata como vencida: mejor perderla que dejarla para siempre.
  if (Number.isNaN(t)) return true;
  return ahora - t > DIAS_DE_VIDA * 86_400_000;
}

let nextId = 0;

/**
 * Cuanto vive una notificacion menor que NADIE mira.
 *
 * OJO con el significado: el reloj mide "nadie la vio", no "pasaron 10
 * segundos". Antes era lo segundo, y por eso una notificacion se borraba
 * delante del usuario mientras la estaba leyendo. Cualquier señal de que la
 * vio (abrir el panel, marcarla leida) cancela el reloj para siempre.
 */
export const MS_AUTO_DESCARTE = 10_000;

/** Relojes de auto-descarte, uno por notificacion. */
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Apaga el reloj de una notificacion. */
function clearDismissTimer(id: string) {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
}

/** Apaga TODOS los relojes. Se usa al abrir el panel y al limpiar todo. */
function clearAllDismissTimers() {
  for (const timer of dismissTimers.values()) clearTimeout(timer);
  dismissTimers.clear();
}

/**
 * hasNew enciende la campanita. Si la ultima notificacion sin leer se fue
 * (descartada sola o borrada a mano), tiene que apagarse: si no, la campanita
 * queda llamando la atencion sobre un panel vacio.
 */
function recalcularHasNew(previo: boolean, restantes: Notification[]): boolean {
  return previo && restantes.some(n => !n.read);
}

/**
 * Vuelca al navegador lo que vale la pena guardar.
 *
 * No escribe NADA mientras duenio sea null: antes de hidratar no sabemos de
 * quien es la maquina, y guardar ahi le pisaria las notificaciones al usuario
 * del turno anterior con una lista vacia.
 */
function sincronizar(estado: { duenio: string | null; notifications: Notification[] }): void {
  if (!estado.duenio) return;
  escribirGuardado({
    duenio: estado.duenio,
    notifications: estado.notifications.filter(vaAlGuardado).slice(0, TOPE_NOTIFICACIONES),
  });
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  notifications: [],
  hasNew: false,
  panelAbierto: false,
  duenio: null,

  hidratar: (tenantId, tenantUserId) => {
    const duenio = claveDuenio(tenantId, tenantUserId);
    const guardado = leerGuardado();

    // Lo guardado es de otro usuario (cambio de turno en la misma maquina) o
    // no hay nada: se arranca limpio y se pisa el guardado ajeno.
    if (!guardado || guardado.duenio !== duenio) {
      clearAllDismissTimers();
      set({ duenio, notifications: [], hasNew: false });
      escribirGuardado({ duenio, notifications: [] });
      return;
    }

    const ahora = Date.now();
    const rescatadas = guardado.notifications
      .filter(n => n && typeof n.id === 'string' && vaAlGuardado(n) && !estaVencida(n, ahora))
      // Vienen de una sesion anterior: ya fueron vistas, asi que nunca se
      // descartan solas ni vuelven a hacer rebotar la campanita.
      .map(n => ({ ...n, vista: true }))
      .slice(0, TOPE_NOTIFICACIONES);

    clearAllDismissTimers();
    set({ duenio, notifications: rescatadas, hasNew: false });
    escribirGuardado({ duenio, notifications: rescatadas });
  },

  olvidar: () => {
    clearAllDismissTimers();
    set({ notifications: [], hasNew: false, panelAbierto: false, duenio: null });
    escribirGuardado(null);
  },

  setPanelAbierto: (abierto) => {
    if (abierto) {
      // Abrir el panel ES verlas. Se apagan todos los relojes y lo que hay
      // adentro queda marcado como visto, asi que ya no se descarta solo
      // aunque el panel se cierre en el segundo siguiente.
      clearAllDismissTimers();
      set({
        panelAbierto: true,
        hasNew: false,
        notifications: get().notifications.map(n => n.vista ? n : { ...n, vista: true }),
      });
      sincronizar(get());
      return;
    }
    // Al cerrar NO se vuelven a armar relojes: lo visto, visto queda.
    set({ panelAbierto: false });
  },

  addNotification: (n) => {
    const id = `notif-${++nextId}-${Date.now()}`;
    const panelAbierto = get().panelAbierto;
    const notification: Notification = {
      ...n,
      id,
      timestamp: new Date().toISOString(),
      read: false,
      // Si el panel esta abierto, la esta viendo aparecer.
      vista: panelAbierto,
    };

    const siguientes = [notification, ...get().notifications];
    // El tope descarta las mas viejas: hay que apagarles el reloj o
    // queda una entrada colgada en el Map por cada una.
    const recortadas = siguientes.slice(0, TOPE_NOTIFICACIONES);
    for (const vieja of siguientes.slice(TOPE_NOTIFICACIONES)) clearDismissTimer(vieja.id);

    set({ notifications: recortadas, hasNew: !panelAbierto });
    sincronizar(get());

    // Solo se arma el reloj para las menores, y solo si NADIE esta mirando.
    if (!n.persisted && n.priority !== 'urgent' && !panelAbierto) {
      clearDismissTimer(id);
      dismissTimers.set(id, setTimeout(() => {
        dismissTimers.delete(id);
        const restantes = get().notifications.filter(x => x.id !== id);
        set({ notifications: restantes, hasNew: recalcularHasNew(get().hasNew, restantes) });
        sincronizar(get());
      }, MS_AUTO_DESCARTE));
    }
  },

  markRead: (id) => {
    // Marcarla leida tambien es haberla visto.
    clearDismissTimer(id);
    set({
      notifications: get().notifications.map(n =>
        n.id === id ? { ...n, read: true, vista: true } : n
      ),
    });
    sincronizar(get());
  },

  markAllRead: () => {
    clearAllDismissTimers();
    set({
      notifications: get().notifications.map(n => ({ ...n, read: true, vista: true })),
      hasNew: false,
    });
    sincronizar(get());
  },

  dismiss: (id) => {
    clearDismissTimer(id);
    const restantes = get().notifications.filter(n => n.id !== id);
    set({ notifications: restantes, hasNew: recalcularHasNew(get().hasNew, restantes) });
    sincronizar(get());
  },

  clearAll: () => {
    clearAllDismissTimers();
    set({ notifications: [], hasNew: false });
    sincronizar(get());
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

'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Bell, CheckCheck, Trash2, CalendarDays, Wallet, DoorOpen, Bed, Settings, Sparkles, X,
  ChevronRight, Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { timeAgo } from '@/lib/format';
import {
  useNotificationStore,
  type Notification,
  type NotificationCategory,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_BG,
  PRIORITY_INDICATOR,
} from '@/lib/notification-store';
import { useHotelStore } from '@/lib/store';

// ═══════════════════════════════════════════════════════════
// CATEGORY ICON MAP
// ═══════════════════════════════════════════════════════════

const CategoryIcon: Record<NotificationCategory, React.ComponentType<{ className?: string }>> = {
  reserva: CalendarDays,
  pago: Wallet,
  checkin: DoorOpen,
  habitacion: Bed,
  sistema: Settings,
  limpieza: Sparkles,
};

// ═══════════════════════════════════════════════════════════
// FILTER TABS CONFIG
// ═══════════════════════════════════════════════════════════

type FilterTab = 'all' | NotificationCategory;

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'reserva', label: 'Reservas' },
  { value: 'pago', label: 'Pagos' },
  { value: 'habitacion', label: 'Hab.' },
  { value: 'sistema', label: 'Sistema' },
];

// ═══════════════════════════════════════════════════════════
// NOTIFICATION ITEM
// ═══════════════════════════════════════════════════════════

function NotificationItem({
  notification,
  onMarkRead,
  onDismiss,
  onNavigate,
  index,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate: (url: string) => void;
  index: number;
}) {
  const n = notification;
  const Icon = CategoryIcon[n.category];
  const colorClass = CATEGORY_COLORS[n.category];
  const bgClass = CATEGORY_BG[n.category];
  const priorityBorder = PRIORITY_INDICATOR[n.priority];

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 border-l-[3px] transition-all duration-300
        ${bgClass}
        ${priorityBorder ? `border-r-2 ${priorityBorder}` : ''}
        ${!n.read ? 'bg-opacity-100' : 'opacity-60'}
        animate-in slide-in-from-right-2 fade-in-0
      `}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      {/* Category icon */}
      <div className={`shrink-0 mt-0.5 ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className={`text-sm truncate ${!n.read ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
          {/* Unread dot */}
          {!n.read && (
            <Circle className="w-2 h-2 fill-primary text-primary shrink-0" />
          )}
        </div>
        {n.message && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{n.message}</p>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{timeAgo(n.timestamp)}</span>
          {n.actionLabel && n.actionUrl && (
            <button
              onClick={() => onNavigate(n.actionUrl!)}
              className="text-[10px] font-medium text-primary hover:underline inline-flex items-center gap-0.5"
            >
              {n.actionLabel}
              <ChevronRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {!n.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onMarkRead(n.id)}
            aria-label="Marcar como leída"
          >
            <Circle className="w-3 h-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => onDismiss(n.id)}
          aria-label="Descartar"
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// NOTIFICATION CENTER (Sheet Panel)
// ═══════════════════════════════════════════════════════════

interface NotificationCenterProps {
  /** Optional: override open state (controlled mode) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Enhanced Notification Center with slide-out panel, category tabs,
 * smart grouping, and staggered animations.
 */
export function NotificationCenter({ open, onOpenChange }: NotificationCenterProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  // Store subscriptions
  const notifications = useNotificationStore(s => s.notifications);
  const markRead = useNotificationStore(s => s.markRead);
  const markAllRead = useNotificationStore(s => s.markAllRead);
  const dismiss = useNotificationStore(s => s.dismiss);
  const clearAll = useNotificationStore(s => s.clearAll);
  const clearHasNew = useNotificationStore(s => s.clearHasNew);
  const hasNew = useNotificationStore(s => s.hasNew);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (activeTab === 'all') return sorted;
    return sorted.filter(n => n.category === activeTab);
  }, [notifications, activeTab]);

  const handleNavigate = useCallback((url: string) => {
    // Navigate to the module via store
    try {
      useHotelStore.getState().setModulo(url as any);
    } catch {
      // Fallback: just close the sheet
    }
    setIsOpen(false);
  }, [setIsOpen]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setIsOpen(newOpen);
    if (newOpen) {
      clearHasNew();
    }
  }, [setIsOpen, clearHasNew]);

  return (
    <>
      {/* Bell trigger button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => handleOpenChange(true)}
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
      >
        <Bell className={`w-4 h-4 ${hasNew ? 'animate-bounce' : ''}`} />
        {unreadCount > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-bold bg-destructive text-white border-0 animate-in zoom-in-50 duration-300">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Sheet panel */}
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-semibold">Notificaciones</SheetTitle>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
                    <CheckCheck className="w-3 h-3 mr-1" />
                    Leer todo
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={clearAll}>
                    <Trash2 className="w-3 h-3 mr-1" />
                    Limpiar
                  </Button>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <SheetDescription>{unreadCount} sin leer</SheetDescription>
            )}
          </SheetHeader>

          {/* Category filter tabs */}
          <div className="px-4 pt-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)} className="w-full">
              <TabsList className="w-full h-8 p-0.5">
                {FILTER_TABS.map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="text-[11px] h-7 px-2 data-[state=active]:bg-background"
                  >
                    {tab.label}
                    {tab.value !== 'all' && (
                      <Badge
                        variant="secondary"
                        className="ml-1 h-4 min-w-4 px-1 text-[9px]"
                      >
                        {notifications.filter(n => n.category === tab.value).length}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-hidden border-t mt-2">
            {filteredNotifications.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bell className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Todo tranquilo</p>
                <p className="text-xs mt-1">No hay notificaciones{activeTab !== 'all' ? ` de ${CATEGORY_LABELS[activeTab as NotificationCategory]?.toLowerCase() || activeTab}` : ''}</p>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="divide-y">
                  {filteredNotifications.map((n, i) => (
                    <NotificationItem
                      key={n.id}
                      notification={n}
                      onMarkRead={markRead}
                      onDismiss={dismiss}
                      onNavigate={handleNavigate}
                      index={i}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// STANDALONE BELL (for embedding without sheet — opens the shared sheet)
// ═══════════════════════════════════════════════════════════

/**
 * A standalone bell icon that shows unread count and opens the notification sheet.
 * Use this when you want the bell without the Sheet content rendered inline.
 */
export function NotificationBell({ onClick }: { onClick?: () => void }) {
  const notifications = useNotificationStore(s => s.notifications);
  const hasNew = useNotificationStore(s => s.hasNew);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      onClick={onClick}
      aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
    >
      <Bell className={`w-4 h-4 transition-transform ${hasNew ? 'animate-bounce' : ''}`} />
      {unreadCount > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-bold bg-destructive text-white border-0 animate-in zoom-in-50 duration-300">
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </Button>
  );
}

// Re-export the Notification type for backward compatibility
export type { Notification };

'use client';

import { useState, useMemo } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatFechaHora } from '@/lib/format';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

const typeStyles: Record<Notification['type'], string> = {
  info: 'border-l-blue-400 bg-blue-50/50',
  success: 'border-l-emerald-400 bg-emerald-50/50',
  warning: 'border-l-amber-400 bg-amber-50/50',
  error: 'border-l-red-400 bg-red-50/50',
};

const typeBadge: Record<Notification['type'], string> = {
  info: 'bg-blue-100 text-blue-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-red-100 text-red-700',
};

/**
 * Notification center with popover, mark-read, and dismiss actions.
 * Designed to be embedded in the Sidebar header area.
 */
export function NotificationCenter({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onClearAll,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const sorted = useMemo(
    () => [...notifications].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [notifications]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount})` : ''}`}>
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] font-bold bg-destructive text-white border-0">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notificaciones</h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onMarkAllRead}>
                <CheckCheck className="w-3 h-3 mr-1" />
                Leer todo
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={onClearAll}>
                <Trash2 className="w-3 h-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bell className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Sin notificaciones</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="divide-y">
              {sorted.map(n => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-l-2 ${typeStyles[n.type]} ${!n.read ? 'font-medium' : 'opacity-60'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeBadge[n.type]}`}>
                        {n.type}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatFechaHora(n.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {!n.read && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onMarkRead(n.id)} aria-label="Marcar como leida">
                        <Check className="w-3 h-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDismiss(n.id)} aria-label="Descartar">
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}

import { Bed, CalendarDays, Users, Wallet, Sparkles, SprayCan, BarChart3, FileText, Package } from 'lucide-react';

const variants: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; title: string; description: string }> = {
  reservas: { icon: CalendarDays, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30', title: 'Sin reservas', description: 'No hay reservas que coincidan con los filtros actuales.' },
  clientes: { icon: Users, color: 'text-rose-500 bg-rose-100 dark:bg-rose-900/30', title: 'Sin clientes', description: 'No hay clientes registrados. Creá el primero.' },
  pagos: { icon: Wallet, color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30', title: 'Sin pagos', description: 'No hay pagos registrados para esta reserva.' },
  habitaciones: { icon: Bed, color: 'text-sky-500 bg-sky-100 dark:bg-sky-900/30', title: 'Sin habitaciones', description: 'No hay habitaciones registradas. Creá la primera.' },
  limpieza: { icon: SprayCan, color: 'text-amber-500 bg-amber-100 dark:bg-amber-900/30', title: 'Todo limpio', description: 'No hay habitaciones pendientes de limpieza.' },
  mantenimiento: { icon: Sparkles, color: 'text-slate-500 bg-slate-100 dark:bg-slate-800/50', title: 'Sin mantenimiento', description: 'No hay habitaciones en mantenimiento.' },
  reportes: { icon: BarChart3, color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30', title: 'Sin datos', description: 'No hay datos suficientes para generar el reporte.' },
  generic: { icon: FileText, color: 'text-slate-500 bg-slate-100 dark:bg-slate-800/50', title: 'Sin resultados', description: 'No se encontraron resultados.' },
  search: { icon: FileText, color: 'text-slate-500 bg-slate-100 dark:bg-slate-800/50', title: 'Sin resultados', description: 'No se encontraron resultados para la búsqueda.' },
  facturacion: { icon: Wallet, color: 'text-violet-500 bg-violet-100 dark:bg-violet-900/30', title: 'Sin facturas', description: 'No hay facturas pendientes ni registradas.' },
  combo: { icon: Package, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30', title: 'Sin combinaciones', description: 'No hay habitaciones combinadas disponibles.' },
};

interface EmptyStateProps {
  variant?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export function EmptyState({ variant = 'generic', title, description, action, compact }: EmptyStateProps) {
  const v = variants[variant] || variants.generic;
  const Icon = v.icon;
  
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Icon className="w-8 h-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">{title || v.title}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className={`w-14 h-14 rounded-2xl ${v.color} flex items-center justify-center mb-4`}>
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title || v.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description || v.description}</p>
      {action}
    </div>
  );
}
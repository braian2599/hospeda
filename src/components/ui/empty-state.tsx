import { Bed, CalendarDays, Users, Wallet, Sparkles, SprayCan, BarChart3, FileText, Package } from 'lucide-react';

const variants: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; title: string; description: string }> = {
  reservas: { icon: CalendarDays, color: 'text-info bg-[#0284C726]', title: 'Sin reservas', description: 'No hay reservas que coincidan con los filtros actuales.' },
  clientes: { icon: Users, color: 'text-rose-500 bg-[#8B08364D]', title: 'Sin clientes', description: 'No hay clientes registrados. Creá el primero.' },
  pagos: { icon: Wallet, color: 'text-primary bg-[#0F766E1A]', title: 'Sin pagos', description: 'No hay pagos registrados para esta reserva.' },
  habitaciones: { icon: Bed, color: 'text-info bg-[#0284C726]', title: 'Sin habitaciones', description: 'No hay habitaciones registradas. Creá la primera.' },
  limpieza: { icon: SprayCan, color: 'text-warning bg-[#D9770626]', title: 'Todo limpio', description: 'No hay habitaciones pendientes de limpieza.' },
  mantenimiento: { icon: Sparkles, color: 'text-muted-foreground bg-muted', title: 'Sin mantenimiento', description: 'No hay habitaciones en mantenimiento.' },
  reportes: { icon: BarChart3, color: 'text-warning bg-[#D9770626]', title: 'Sin datos', description: 'No hay datos suficientes para generar el reporte.' },
  generic: { icon: FileText, color: 'text-muted-foreground bg-muted', title: 'Sin resultados', description: 'No se encontraron resultados.' },
  search: { icon: FileText, color: 'text-muted-foreground bg-muted', title: 'Sin resultados', description: 'No se encontraron resultados para la búsqueda.' },
  facturacion: { icon: Wallet, color: 'text-chart-5 bg-[#8B5CF626]', title: 'Sin facturas', description: 'No hay facturas pendientes ni registradas.' },
  combo: { icon: Package, color: 'text-info bg-[#0284C726]', title: 'Sin combinaciones', description: 'No hay habitaciones combinadas disponibles.' },
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
      <div className="flex flex-col items-center justify-center py-6 text-center animate-fade-in">
        <Icon className="w-8 h-8 text-[#64748B66] mb-2" />
        <p className="text-sm text-muted-foreground">{title || v.title}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
      <div
        className={`w-14 h-14 rounded-2xl ${v.color} flex items-center justify-center mb-4 relative overflow-hidden`}
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 60%)',
        }}
      >
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold mb-1">{title || v.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description || v.description}</p>
      {action ? (
        <div className="transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5">
          {action}
        </div>
      ) : null}
    </div>
  );
}

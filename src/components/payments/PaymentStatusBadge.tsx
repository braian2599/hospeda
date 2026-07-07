'use client';

import { Badge } from '@/components/ui/badge';
import type { PaymentStatus } from '@/lib/payments/types';
import { Clock, CheckCircle2, XCircle, Loader2, AlertTriangle, Ban } from 'lucide-react';

const STATUS_CONFIG: Record<PaymentStatus, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending:    { label: 'Pendiente',    variant: 'secondary',  icon: Clock },
  processing: { label: 'Procesando',  variant: 'secondary',  icon: Loader2 },
  paid:       { label: 'Activo',      variant: 'default',    icon: CheckCircle2 },
  failed:     { label: 'Fallido',     variant: 'destructive', icon: XCircle },
  refunded:   { label: 'Devuelto',    variant: 'outline',    icon: AlertTriangle },
  cancelled:  { label: 'Cancelado',   variant: 'outline',    icon: Ban },
};

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  showIcon?: boolean;
  className?: string;
}

export default function PaymentStatusBadge({ status, showIcon = true, className }: PaymentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={`gap-1 ${className}`}>
      {showIcon && <Icon className="w-3 h-3" />}
      {config.label}
    </Badge>
  );
}
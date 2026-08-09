'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, X } from 'lucide-react';

export default function PaymentResultBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentStatus = searchParams.get('payment');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (paymentStatus) {
      setVisible(true);
      // Limpiar el query param de la URL
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      router.replace(url.pathname, { scroll: false });
    }
  }, [paymentStatus, router]);

  if (!visible || !paymentStatus) return null;

  const config = {
    success: {
      icon: CheckCircle2,
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: '¡Pago recibido!',
      message: 'Tu suscripción se está activando. En unos minutos verás tu nuevo plan reflejado.',
    },
    failure: {
      icon: XCircle,
      bg: 'bg-red-500/10 border-red-500/20',
      iconColor: 'text-red-600 dark:text-red-400',
      title: 'El pago no se completó',
      message: 'Podés intentar nuevamente desde la sección de Suscripción, o contactarnos si tenés algún problema.',
    },
    pending: {
      icon: Clock,
      bg: 'bg-amber-500/10 border-amber-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: 'Pago pendiente',
      message: 'Tu pago está siendo procesado. Te notificaremos cuando se acredite.',
    },
  };

  const c = config[paymentStatus as keyof typeof config];
  if (!c) return null;

  const Icon = c.icon;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b ${c.bg} animate-in slide-in-from-top duration-300`}>
      <Icon className={`w-5 h-5 shrink-0 ${c.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${c.iconColor}`}>{c.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{c.message}</p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="p-1 rounded-md hover:bg-accent/50 transition-colors shrink-0"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
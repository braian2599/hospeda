'use client';

// La tarjeta de las reservas que entran por la página del hotel.
// Las reglas están en src/lib/reservas-web.ts, que se puede probar sin React.

import { useMemo } from 'react';
import { CalendarClock, AlertTriangle, ArrowRight, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHotelStore } from '@/lib/store';
import { formatMoney } from '@/lib/format';
import { reservasDeLaWeb, haceCuanto, type ReservaDeLaWeb } from '@/lib/reservas-web';

const fechaCorta = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });

function Fila({ r, urgente }: { r: ReservaDeLaWeb; urgente: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 p-2.5 rounded-lg ${
        urgente ? 'bg-[#D9770618] border border-[#D9770640]' : 'hover:bg-muted/50 transition-colors'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug">
          {r.huesped}
          <span className="text-muted-foreground font-normal"> — Hab. {r.habitacion}</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {fechaCorta(r.checkin)} → {fechaCorta(r.checkout)}
          {r.total !== undefined && <> · {formatMoney(r.total)}</>}
          {' · entró '}{haceCuanto(r.horasEsperando)}
        </p>
      </div>
      {r.demorada && (
        <Badge variant="outline" className="shrink-0 h-[18px] px-1.5 text-[10px] font-bold uppercase tracking-wide border-[#D9770666] bg-[#D9770626] text-warning">
          Demorada
        </Badge>
      )}
    </div>
  );
}

export default function ReservasDeLaWeb() {
  const reservas = useHotelStore(s => s.reservas);
  const setModulo = useHotelStore(s => s.setModulo);

  // Se recalcula con cada sincronización. Es una vista de los datos, no algo
  // guardado: por eso no depende de que alguien haya estado conectado cuando
  // entró la reserva.
  const resumen = useMemo(() => reservasDeLaWeb(reservas), [reservas]);

  const hayEspera = resumen.aConfirmar.length > 0;
  const hayNuevas = resumen.recientes.length > 0;

  // Si no hay nada, la tarjeta no existe. El Dashboard ya es largo: una
  // tarjeta que dice "no hay nada" es una fila más para saltear todos los días.
  if (!hayEspera && !hayNuevas) return null;

  return (
    <Card className={resumen.hayDemoradas ? 'border-[#D9770666]' : undefined}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            Reservas de tu página web
          </CardTitle>
          {hayEspera && (
            <Badge
              variant={resumen.hayDemoradas ? 'destructive' : 'secondary'}
              className="text-[10px] px-1.5"
            >
              {resumen.aConfirmar.length} sin resolver
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 text-xs gap-1"
            onClick={() => setModulo('reservas')}
          >
            Ir a Reservas
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {hayEspera && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-warning">
              <AlertTriangle className="w-3.5 h-3.5" />
              Esperando que confirmes la seña
            </p>
            {/*
              Esto no es un aviso, es trabajo pendiente: mientras la reserva
              está a confirmar la habitación sigue figurando libre, así que se
              puede vender dos veces. Por eso no vence: se muestra hasta que
              alguien la resuelva.
            */}
            <p className="text-[11px] text-muted-foreground leading-snug">
              La habitación sigue figurando disponible hasta que confirmes el pago.
            </p>
            {resumen.aConfirmar.map(r => (
              <Fila key={r.id} r={r} urgente={r.demorada} />
            ))}
          </div>
        )}

        {hayNuevas && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <CalendarClock className="w-3.5 h-3.5" />
              Entraron en las últimas 24 horas
            </p>
            {resumen.recientes.map(r => (
              <Fila key={r.id} r={r} urgente={false} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

/**
 * ReservasSenaKPI
 * ----------------
 * Tarjeta interactiva del Dashboard sobre las reservas online (landing).
 * Cambia según el modo de cobro de seña configurado por el hotel:
 *  - Mercado Pago: próximos check-ins ya confirmados y pagados desde la landing.
 *  - Contacto manual: reservas "A confirmar" — esperando que el personal
 *    confirme el pago de la seña coordinado con el huésped.
 * Cada fila es clickeable y muestra el detalle de la reserva en un popover.
 */

import { useEffect, useMemo, useState } from 'react';
import { useHotelStore } from '@/lib/store';
import { formatMoney, formatFecha, todayLocal } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarCheck, Clock3, Loader2, Users } from 'lucide-react';

const MAX_ITEMS = 8;

export default function ReservasSenaKPI() {
  const reservas = useHotelStore(s => s.reservas);
  const calcularTotalReserva = useHotelStore(s => s.calcularTotalReserva);
  const setModulo = useHotelStore(s => s.setModulo);

  const [modoCobroSena, setModoCobroSena] = useState<'mercadopago' | 'manual'>('mercadopago');
  const [loadingModo, setLoadingModo] = useState(true);

  useEffect(() => {
    fetch('/api/configuracion/hotel')
      .then(r => r.json())
      .then(data => setModoCobroSena(data.modoCobroSena === 'manual' ? 'manual' : 'mercadopago'))
      .catch(() => {})
      .finally(() => setLoadingModo(false));
  }, []);

  const hoyStr = todayLocal();

  const items = useMemo(() => {
    const landingReservas = reservas.filter(r => r.origen === 'landing');
    if (modoCobroSena === 'manual') {
      return landingReservas
        .filter(r => r.estado === 'A confirmar')
        .sort((a, b) => a.checkin.localeCompare(b.checkin));
    }
    return landingReservas
      .filter(r => r.estado === 'Confirmada' && r.checkin >= hoyStr)
      .sort((a, b) => a.checkin.localeCompare(b.checkin))
      .slice(0, MAX_ITEMS);
  }, [reservas, modoCobroSena, hoyStr]);

  const esManual = modoCobroSena === 'manual';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {esManual ? <Clock3 className="w-4 h-4 text-brand-amber" /> : <CalendarCheck className="w-4 h-4 text-primary" />}
          {esManual ? 'Reservas a confirmar (landing)' : 'Próximos check-ins (landing)'}
          {esManual && items.length > 0 && (
            <Badge className="bg-[#F59E0B26] text-brand-amber border-[#F59E0B66] ml-1">{items.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loadingModo ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {esManual ? 'No hay reservas de la landing esperando confirmación de pago.' : 'No hay próximos check-ins de reservas online.'}
          </p>
        ) : (
          items.map(r => (
            <Popover key={r.id}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#F1F5F94D] hover:bg-[#F1F5F980] transition-colors text-left"
                >
                  <span className="flex items-center gap-2 text-sm min-w-0">
                    <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{r.huesped}</span>
                    <span className="text-muted-foreground shrink-0">Hab. {r.habitacion}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{formatFecha(r.checkin)}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-2" align="end">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{r.huesped}</p>
                  <Badge className={esManual ? 'bg-[#F59E0B26] text-brand-amber border-[#F59E0B66]' : 'bg-[#05966926] text-success border-[#0F766E66]'}>
                    {r.estado}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Habitación {r.habitacion} · {r.personas} persona{r.personas !== 1 ? 's' : ''}</p>
                  <p>{formatFecha(r.checkin)} → {formatFecha(r.checkout)}</p>
                  <p>Teléfono: {r.telefono || '—'}</p>
                  <p>Total: {formatMoney(calcularTotalReserva(r.id))}</p>
                </div>
                <Button size="sm" className="w-full" onClick={() => setModulo('reservas')}>
                  {esManual ? 'Confirmar pago en Reservas →' : 'Ver en Reservas →'}
                </Button>
              </PopoverContent>
            </Popover>
          ))
        )}
      </CardContent>
    </Card>
  );
}

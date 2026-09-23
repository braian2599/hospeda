'use client';

// "Quedó saldo: ¿lo pasás a una cuenta corriente?"
//
// Montado UNA sola vez (en la pantalla principal de la app). Lo dispara el
// check-out cuando queda saldo —desde Reservas, Check-in o Dashboard, da
// igual— o el botón "Pasar a cuenta corriente" de una reserva ya cerrada.
// Un solo diálogo para todos: la pregunta no puede quedar distinta en una
// pantalla que en otra.
//
// Se anota el saldo COMPLETO: "el que anota fiado anota todo". No toca la
// caja: no entró plata (ver docs/cuenta-corriente.md).

import { useEffect, useState } from 'react';
import { Loader2, BookOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHotelStore } from '@/lib/store';
import { api, type DbTitular } from '@/lib/api-client';
import type { Reserva } from '@/lib/types';
import { moduloDisponible } from '@/lib/plan-config';
import { formatMoney } from '@/lib/format';
import { notifySuccess, notifyWarning } from '@/lib/notify';
import { manejaCuentaCorriente, aPesos } from '@/lib/cuenta-corriente';
import ElegirTitular from './ElegirTitular';

export default function PreguntaCuentaCorriente() {
  const idReserva = useHotelStore(s => s.preguntaCuentaCorriente);
  const reservas = useHotelStore(s => s.reservas);
  const pagos = useHotelStore(s => s.pagos);
  const planActual = useHotelStore(s => s.planActual);
  const planes = useHotelStore(s => s.planes);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const cerrar = useHotelStore(s => s.cerrarPreguntaCuentaCorriente);
  const marcarEnCuentaCorriente = useHotelStore(s => s.marcarEnCuentaCorriente);

  const reserva = idReserva ? reservas.find(r => r.id === idReserva) : undefined;
  const pagado = reserva ? pagos.filter(p => p.idReserva === reserva.id).reduce((s, p) => s + p.monto, 0) : 0;
  const saldo = reserva?.total != null ? reserva.total - pagado : 0;

  // Solo si el hotel tiene cuenta corriente en su plan. Sin Comprobantes
  // nadie en el hotel podría ver ni cobrar la deuda: anotarla sería
  // esconderla.
  const tieneCuentaCorriente = moduloDisponible('comprobantes', planActual, planes);

  const corresponde = !!reserva
    && tieneCuentaCorriente
    && reserva.estado === 'Check-Out realizado'
    && reserva.total != null
    && saldo > 0
    && !reserva.cuentaCorriente;

  // Si ya no corresponde (el plan no lo tiene, alguien ya la derivó desde
  // otra máquina y llegó con el sync...), se limpia el pedido.
  useEffect(() => {
    if (idReserva && !corresponde) cerrar();
  }, [idReserva, corresponde, cerrar]);

  if (!corresponde || !reserva) return null;

  // key: cada reserva arranca de cero. Lo elegido para la anterior no se
  // arrastra a la siguiente.
  return (
    <DialogoPregunta
      key={reserva.id}
      reserva={reserva}
      saldo={saldo}
      manejaCuenta={manejaCuentaCorriente(usuarioActual)}
      cerrar={cerrar}
      marcarEnCuentaCorriente={marcarEnCuentaCorriente}
    />
  );
}

function DialogoPregunta({ reserva, saldo, manejaCuenta, cerrar, marcarEnCuentaCorriente }: {
  reserva: Reserva;
  saldo: number;
  manejaCuenta: boolean;
  cerrar: () => void;
  marcarEnCuentaCorriente: (idReserva: string, cuenta: { titularId: string; titular: string; monto: number }) => void;
}) {
  const [elegido, setElegido] = useState<DbTitular | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pasar = async () => {
    if (!elegido) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await api.cuentaCorriente.derivar(reserva.id, elegido.id);
      // Lo que se anotó lo dice el servidor, no la cuenta de acá.
      const monto = aPesos(r.cargo.monto);
      marcarEnCuentaCorriente(reserva.id, { titularId: r.cargo.titular.id, titular: r.cargo.titular.nombre, monto });
      notifySuccess('Saldo pasado a cuenta corriente', `${formatMoney(monto)} a la cuenta de ${r.cargo.titular.nombre}`);
      if (r.superaLimite) {
        notifyWarning('Pasó su límite de crédito', `${r.cargo.titular.nombre} ya debe más de lo que tiene permitido.`);
      }
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo pasar a cuenta corriente.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={abierto => { if (!abierto && !guardando) cerrar(); }}>
      <DialogContent size="medio">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Quedó saldo sin pagar
          </DialogTitle>
          <DialogDescription>
            {reserva.huesped} — Hab. {reserva.habitacion} se fue debiendo{' '}
            <span className="font-semibold text-foreground">{formatMoney(saldo)}</span>.
            ¿Lo pasás a una cuenta corriente? Se anota completo y se cobra después.
          </DialogDescription>
        </DialogHeader>

        <ElegirTitular
          elegido={elegido}
          onElegir={setElegido}
          clienteId={reserva.idCliente || undefined}
          nombreSugerido={reserva.huesped}
          manejaCuenta={manejaCuenta}
        />

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={cerrar} disabled={guardando}>
            No, queda pendiente
          </Button>
          <Button onClick={pasar} disabled={!elegido || guardando}>
            {guardando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {elegido ? `Pasar a ${elegido.nombre}` : 'Elegí una cuenta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

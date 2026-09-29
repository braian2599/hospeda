'use client';

// "Quedó saldo: ¿a nombre de quién queda la deuda?" — del propio huésped
// (su cuenta, con su DNI) o de una empresa.
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
import { Loader2, BookOpen, User, Building2, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useHotelStore } from '@/lib/store';
import { api, type DbTitular } from '@/lib/api-client';
import type { Reserva } from '@/lib/types';
import { moduloDisponible } from '@/lib/plan-config';
import { formatMoney, numeroDeReserva } from '@/lib/format';
import { notifySuccess, notifyWarning } from '@/lib/notify';
import { manejaCuentaCorriente, aPesos, formatearDocumento } from '@/lib/cuenta-corriente';
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
    // Solo reservas sin ningún pago: quien pagó una parte paga el resto
    // (decisión del dueño, 29/09). Misma regla que la API.
    && pagado === 0
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
  // A nombre de quién queda la deuda (decisión del dueño, 29/09): del propio
  // huésped o de una empresa. No hay "queda pendiente": una reserva cerrada
  // sin ningún pago solo se salda por cuenta corriente.
  const [destino, setDestino] = useState<'huesped' | 'empresa' | null>(null);
  const [empresa, setEmpresa] = useState<DbTitular | null>(null);
  const [cuentaDelHuesped, setCuentaDelHuesped] = useState<DbTitular | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si el huésped ya tiene cuenta, se avisa que la deuda se suma ahí.
  useEffect(() => {
    if (!reserva.idCliente) return;
    let cancelado = false;
    api.cuentaCorriente.buscar({ clienteId: reserva.idCliente })
      .then(r => { if (!cancelado) setCuentaDelHuesped(r.titulares[0] ?? null); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, [reserva.idCliente]);

  const numero = numeroDeReserva(reserva);
  const noches = Math.max(1, Math.round((Date.parse(reserva.checkout) - Date.parse(reserva.checkin)) / 86_400_000));
  const dni = reserva.dni ? formatearDocumento(reserva.dni) : '';

  const pasar = async () => {
    if (destino === 'empresa' && !empresa) return;
    setGuardando(true);
    setError(null);
    try {
      const r = await api.cuentaCorriente.derivar(
        reserva.id,
        destino === 'empresa' && empresa ? { titularId: empresa.id } : { aNombreDelHuesped: true },
      );
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

  const textoBoton = destino === 'huesped'
    ? `Pasar ${formatMoney(saldo)} a ${reserva.huesped}`
    : destino === 'empresa'
      ? (empresa ? `Pasar ${formatMoney(saldo)} a ${empresa.nombre}` : 'Elegí la empresa')
      : 'Elegí a nombre de quién';

  return (
    <Dialog open onOpenChange={abierto => { if (!abierto && !guardando) cerrar(); }}>
      <DialogContent size="medio">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Quedó saldo sin pagar
          </DialogTitle>
          <DialogDescription>
            {reserva.huesped} — Hab. {reserva.habitacion}{numero ? ` — reserva ${numero}` : ''} se fue debiendo{' '}
            <span className="font-semibold text-foreground">{formatMoney(saldo)}</span>.{' '}
            {destino === 'empresa' ? 'Elegí la empresa:' : '¿A nombre de quién queda la deuda?'}
          </DialogDescription>
        </DialogHeader>

        {destino !== 'empresa' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="A nombre de quién queda la deuda">
            <button
              type="button"
              role="radio"
              aria-checked={destino === 'huesped'}
              onClick={() => setDestino('huesped')}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                destino === 'huesped' ? 'border-primary bg-[#0F766E0F]' : 'border-border hover:bg-[color:var(--muted-a40)]'
              }`}
            >
              <span className="w-10 h-10 rounded-lg bg-[#0F766E1A] flex items-center justify-center shrink-0"><User className="w-5 h-5 text-primary" /></span>
              <span className="min-w-0">
                <span className="block font-semibold text-[15px]">A nombre de {reserva.huesped}</span>
                <span className="block text-[13px] text-muted-foreground mt-0.5">
                  {cuentaDelHuesped ? 'Se suma a su cuenta corriente' : 'Queda en su cuenta corriente'}
                  {dni ? <>, identificado con su <span className="font-semibold text-foreground">DNI {dni}</span></> : ''}. No hace falta CUIT.
                </span>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => setDestino('empresa')}
              className="flex items-start gap-3 rounded-xl border-2 border-border p-4 text-left transition-colors hover:bg-[color:var(--muted-a40)]"
            >
              <span className="w-10 h-10 rounded-lg bg-[#0F766E1A] flex items-center justify-center shrink-0"><Building2 className="w-5 h-5 text-primary" /></span>
              <span className="min-w-0">
                <span className="block font-semibold text-[15px]">A una empresa</span>
                <span className="block text-[13px] text-muted-foreground mt-0.5">La deuda pasa a la cuenta de la empresa, con todos los datos de la reserva.</span>
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <ElegirTitular
              elegido={empresa}
              onElegir={setEmpresa}
              manejaCuenta={manejaCuenta}
              soloEmpresas
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 rounded-lg border p-3 text-sm">
              <p><span className="block text-[11.5px] text-muted-foreground">Reserva</span><span className="font-semibold">{numero || '—'}</span></p>
              <p><span className="block text-[11.5px] text-muted-foreground">Huésped</span><span className="font-semibold">{reserva.huesped}</span></p>
              <p><span className="block text-[11.5px] text-muted-foreground">Habitación</span><span className="font-semibold">{reserva.habitacion}</span></p>
              <p>
                <span className="block text-[11.5px] text-muted-foreground">Estadía</span>
                <span className="font-semibold">{fechaCorta(reserva.checkin)} → {fechaCorta(reserva.checkout)} · {noches} {noches === 1 ? 'noche' : 'noches'}</span>
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <DialogFooter className="gap-2">
          {destino === 'empresa' && (
            <Button variant="ghost" onClick={() => { setDestino(null); setEmpresa(null); setError(null); }} disabled={guardando} className="sm:mr-auto">
              <ArrowLeft className="w-4 h-4 mr-1" /> Volver
            </Button>
          )}
          <Button onClick={pasar} disabled={!destino || (destino === 'empresa' && !empresa) || guardando}>
            {guardando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {textoBoton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "2026-09-27" → "27/09". */
function fechaCorta(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

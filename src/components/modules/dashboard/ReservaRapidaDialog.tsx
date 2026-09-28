'use client';

// Reserva rápida: se abre al tocar un día libre del calendario del Dashboard.
// Pide solo lo obligatorio (mismas reglas que el formulario de Reservas) y
// muestra al costado un "ticket" con todo lo que se está cargando y cobrando,
// para corroborarlo de un vistazo. Lo que no entra acá (dos habitaciones,
// acompañante sin cargo, etc.) sigue en "Formulario completo", que abre
// Reservas con todo lo ya escrito.
//
// La cuenta del total es la de Reservas: tarifa según adultos (niños aparte
// solo si la tarifa los cobra aparte) y el recargo de las cuotas sumado.

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Lock, Minus, Plus, X } from 'lucide-react';
import { useHotelStore, type NuevaReservaPrellenada } from '@/lib/store';
import { formatMoney } from '@/lib/format';
import { notifySuccess } from '@/lib/notify';
import { modulosVisiblesPara } from '@/lib/plan-config';
import { calcularDesgloseTarifa, getPromocionesEfectivas } from '@/lib/tarifa-calc';
import { sumarDiasFecha } from '@/lib/gantt-mover';
import { esCompartida, lugaresPara } from '@/lib/ocupacion';
import type { Cliente } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface ReservaRapidaDatos {
  habitacion: string;
  checkin: string;
  /** Cuántas noches seguidas está libre desde la entrada (tope del selector). */
  maxNoches: number;
}

type Cobro = 'ninguno' | 'parcial' | 'total';

/** La seña mínima, igual que la que sugiere Reservas. */
const SENA_MINIMA = 0.3;

function fechaCorta(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function Contador({ valor, min, max, onChange, etiqueta }: {
  valor: number; min: number; max: number; onChange: (v: number) => void; etiqueta: string;
}) {
  return (
    <div className="flex items-stretch h-9 rounded-md border border-input bg-background overflow-hidden">
      <button type="button" className="w-8 grid place-items-center hover:bg-muted disabled:opacity-40" onClick={() => onChange(Math.max(min, valor - 1))} disabled={valor <= min} aria-label={`${etiqueta}: uno menos`}>
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="flex-1 grid place-items-center text-sm font-semibold tabular-nums" aria-live="polite" aria-label={etiqueta}>{valor}</span>
      <button type="button" className="w-8 grid place-items-center hover:bg-muted disabled:opacity-40" onClick={() => onChange(Math.min(max, valor + 1))} disabled={valor >= max} aria-label={`${etiqueta}: uno más`}>
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Campo({ etiqueta, obligatorio, children, className }: { etiqueta: string; obligatorio?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1 min-w-0', className)}>
      <span className="text-[11.5px] text-muted-foreground">{etiqueta}{obligatorio && <b className="text-destructive font-semibold"> *</b>}</span>
      {children}
    </label>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-muted-foreground after:content-[''] after:flex-1 after:h-px after:bg-border">
      {children}
    </div>
  );
}

export default function ReservaRapidaDialog({ datos, onClose }: { datos: ReservaRapidaDatos | null; onClose: () => void }) {
  return (
    <Dialog open={datos !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent size="grande" scrollBody={false} showCloseButton={false} className="p-0 gap-0 block overflow-y-auto">
        {/* key: cada día tocado arranca un formulario limpio. */}
        {datos && <Formulario key={`${datos.habitacion}-${datos.checkin}`} datos={datos} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ datos, onClose }: { datos: ReservaRapidaDatos; onClose: () => void }) {
  const habitaciones = useHotelStore(s => s.habitaciones);
  const tarifas = useHotelStore(s => s.tarifas);
  const tiposTarifa = useHotelStore(s => s.tiposTarifa);
  const metodosPago = useHotelStore(s => s.metodosPago);
  const caja = useHotelStore(s => s.caja);
  const buscarCliente = useHotelStore(s => s.buscarCliente);
  const crearReserva = useHotelStore(s => s.crearReserva);
  const registrarPago = useHotelStore(s => s.registrarPago);
  const setModulo = useHotelStore(s => s.setModulo);
  const setNuevaReservaPrellenada = useHotelStore(s => s.setNuevaReservaPrellenada);
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const planActual = useHotelStore(s => s.planActual);
  const planes = useHotelStore(s => s.planes);

  const hab = habitaciones[datos.habitacion];
  const compartida = esCompartida(hab?.tipo);
  const buscarDisponibilidad = useHotelStore(s => s.buscarDisponibilidad);

  const [noches, setNoches] = useState(1);
  const [huesped, setHuesped] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [extra, setExtra] = useState({ email: '', nacionalidad: '', fechaNacimiento: '', domicilio: '' });
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [buscando, setBuscando] = useState<'huesped' | 'dni' | null>(null);
  const [masDatos, setMasDatos] = useState(false);
  const [tipoTarifa, setTipoTarifa] = useState(tiposTarifa[0] || 'normal');
  const [adultos, setAdultos] = useState(1);
  const [ninos, setNinos] = useState(0);
  const [camposTarifa, setCamposTarifa] = useState<Record<string, string>>({});
  const [cobro, setCobro] = useState<Cobro>('ninguno');
  const [metodoId, setMetodoId] = useState('');
  const [cuotas, setCuotas] = useState('1|0');
  const [monto, setMonto] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const huespedRef = useRef<HTMLDivElement>(null);

  const checkout = sumarDiasFecha(datos.checkin, noches);
  // Tope de personas: en una compartida, las camas libres de TODAS las noches
  // elegidas (cambia si se agregan noches); en el resto, la capacidad.
  const capacidad = useMemo(() => {
    if (!hab) return 1;
    if (!compartida) return hab.capacidad || 1;
    const libre = buscarDisponibilidad(datos.checkin, checkout).find(h => h.numero === datos.habitacion);
    return libre ? lugaresPara(libre) : 0;
  }, [hab, compartida, buscarDisponibilidad, datos.checkin, datos.habitacion, checkout]);
  const tarifa = tarifas[tipoTarifa];
  const promos = tarifa ? getPromocionesEfectivas(tarifa) : {};
  const ninosAparte = !!promos.ninosDiferenciado?.activo;
  const ninosCuenta = ninosAparte ? ninos : 0;
  const acompanante = promos.acompananteSinCargo?.activo && promos.acompananteSinCargo.habitacionAsignada
    ? promos.acompananteSinCargo : null;
  const camposPersonalizados = tarifa?.camposPersonalizados || [];
  const metodo = metodosPago.find(m => m.id === metodoId);
  const tieneCuotas = !!(metodo?.recargo && metodo.cuotas.length > 0);
  const recargoPct = cobro !== 'ninguno' && tieneCuotas ? parseFloat(cuotas.split('|')[1]) || 0 : 0;
  const cuotasNum = cobro !== 'ninguno' && tieneCuotas ? parseInt(cuotas.split('|')[0]) || 1 : 1;

  const desglose = useMemo(
    () => calcularDesgloseTarifa(tarifas, tipoTarifa, adultos + ninosCuenta, noches, { checkin: datos.checkin, ninos: ninosCuenta > 0 ? ninosCuenta : undefined }),
    [tarifas, tipoTarifa, adultos, ninosCuenta, noches, datos.checkin],
  );
  const subtotal = desglose?.total ?? 0;
  const recargo = recargoPct > 0 ? Math.round(subtotal * (recargoPct / 100)) : 0;
  const total = subtotal + recargo;
  const senaMinima = Math.ceil(total * SENA_MINIMA);
  const cobradoAhora = cobro === 'total' ? total : cobro === 'parcial' ? Math.min(total, parseFloat(monto) || 0) : 0;

  // Si al sumar noches quedan menos camas libres, las personas bajan solas.
  useEffect(() => {
    if (capacidad < 1) return;
    if (adultos > capacidad) setAdultos(capacidad);
    if (adultos + ninos > capacidad) setNinos(Math.max(0, capacidad - Math.min(adultos, capacidad)));
  }, [capacidad, adultos, ninos]);

  // Los avisos de lo que faltaba se van apenas se toca algo; si sigue
  // faltando, vuelven al tocar Crear.
  useEffect(() => {
    setErrores([]);
    setMarcados(new Set());
  }, [huesped, dni, telefono, camposTarifa, metodoId, monto, cobro, adultos, ninos, tipoTarifa]);

  // Al pasar a Seña, se propone el mínimo.
  useEffect(() => {
    if (cobro === 'parcial' && !monto && senaMinima > 0) setMonto(String(senaMinima));
  }, [cobro, monto, senaMinima]);

  const puedeCaja = useMemo(
    () => modulosVisiblesPara(usuarioActual, planActual, planes).includes('caja'),
    [usuarioActual, planActual, planes],
  );
  const cajaAbierta = caja.estado === 'abierta';

  // Clientes que ya vinieron: aparecen al escribir el nombre o el DNI.
  const sugerencias = useMemo(() => {
    if (!buscando || cliente) return [];
    const termino = (buscando === 'huesped' ? huesped : dni).trim();
    if (termino.length < 2) return [];
    return buscarCliente(termino).slice(0, 5);
  }, [buscando, huesped, dni, cliente, buscarCliente]);

  useEffect(() => {
    if (!buscando) return;
    const alTocar = (e: PointerEvent) => {
      if (huespedRef.current && !huespedRef.current.contains(e.target as Node)) setBuscando(null);
    };
    document.addEventListener('pointerdown', alTocar, true);
    return () => document.removeEventListener('pointerdown', alTocar, true);
  }, [buscando]);

  const elegirCliente = (c: Cliente) => {
    setCliente(c);
    setHuesped(c.nombre);
    setDni(c.dni);
    setTelefono(c.telefono || '');
    setExtra({ email: c.email || '', nacionalidad: c.nacionalidad || '', fechaNacimiento: c.fechaNacimiento || '', domicilio: c.domicilio || '' });
    setBuscando(null);
  };

  const cambiarCliente = () => {
    setCliente(null);
    setHuesped(''); setDni(''); setTelefono('');
    setExtra({ email: '', nacionalidad: '', fechaNacimiento: '', domicilio: '' });
  };

  const elegirMetodo = (id: string) => {
    setMetodoId(id);
    const m = metodosPago.find(x => x.id === id);
    setCuotas(m?.recargo && m.cuotas.length > 0 ? `${m.cuotas[0].cantidad}|${m.cuotas[0].porcentaje}` : '1|0');
  };

  const cambiarTarifa = (t: string) => {
    setTipoTarifa(t);
    setCamposTarifa({});
    setNinos(0);
  };

  /** Todo lo escrito, para seguir en el formulario completo. */
  const paraFormularioCompleto = (): NuevaReservaPrellenada => ({
    habitacion: datos.habitacion,
    checkin: datos.checkin,
    checkout,
    huesped, dni, telefono,
    ...extra,
    clienteId: cliente?.id,
    tipoTarifa,
    personas: adultos,
    ninos: ninosCuenta,
    datosAdicionales: camposTarifa,
    pagoTipo: cobro,
    pagoMonto: cobro === 'parcial' ? parseFloat(monto) || 0 : undefined,
    pagoMetodo: metodoId || undefined,
    pagoCuotas: cuotas,
  });

  const irAlFormularioCompleto = () => {
    setNuevaReservaPrellenada(paraFormularioCompleto());
    setModulo('reservas');
    onClose();
  };

  const crear = async () => {
    const errs: string[] = [];
    const faltan = new Set<string>();
    if (!huesped.trim()) { errs.push('Falta el nombre.'); faltan.add('huesped'); }
    if (!dni.trim()) { errs.push('Falta el DNI.'); faltan.add('dni'); }
    if (!telefono.trim()) { errs.push('Falta el teléfono.'); faltan.add('telefono'); }
    if (adultos + ninosCuenta > capacidad) {
      errs.push(compartida
        ? `La habitación ${datos.habitacion} tiene ${capacidad} ${capacidad === 1 ? 'cama libre' : 'camas libres'} esas noches.`
        : `La habitación ${datos.habitacion} es para ${capacidad} ${capacidad === 1 ? 'persona' : 'personas'}.`);
    }
    for (const c of camposPersonalizados) {
      if (c.requerido && !(camposTarifa[c.nombre] || '').trim()) { errs.push(`Falta "${c.nombre}".`); faltan.add(`campo:${c.nombre}`); }
    }
    if (!desglose) errs.push(`La tarifa "${tipoTarifa}" no tiene precios cargados.`);
    if (cobro !== 'ninguno' && !metodoId) { errs.push('Elegí la forma de pago.'); faltan.add('metodo'); }
    if (cobro === 'parcial' && cobradoAhora < senaMinima) { errs.push(`La seña mínima es ${formatMoney(senaMinima)}.`); faltan.add('monto'); }
    setMarcados(faltan);
    setErrores(errs);
    if (errs.length > 0 || !cajaAbierta || acompanante) return;

    setGuardando(true);
    try {
      const datosAdicionales = Object.keys(camposTarifa).length > 0 ? { ...camposTarifa } : undefined;
      const agencia = tipoTarifa === 'agencia' && datosAdicionales
        ? {
            nombre: datosAdicionales['Nombre de la Agencia'] || '',
            convenio: datosAdicionales['Nº de Convenio'] || undefined,
            vendedor: datosAdicionales['Vendedor / Agente'] || undefined,
          }
        : undefined;
      const reserva = await crearReserva({
        checkin: datos.checkin,
        checkout,
        habitacion: datos.habitacion,
        huesped: huesped.trim(),
        dni: dni.trim(),
        telefono: telefono.trim(),
        email: extra.email.trim(),
        domicilio: extra.domicilio.trim(),
        nacionalidad: extra.nacionalidad.trim(),
        fechaNacimiento: extra.fechaNacimiento.trim(),
        personas: adultos,
        ninos: ninosCuenta > 0 ? ninosCuenta : undefined,
        tipoTarifa,
        total,
        metodoPagoId: cobro !== 'ninguno' ? metodoId : undefined,
        cuotas: cuotasNum > 1 ? cuotasNum : undefined,
        recargoPorcentaje: recargoPct > 0 ? recargoPct : undefined,
        agencia,
        datosAdicionales,
      });
      if (!reserva) {
        toast.error('No se pudo crear la reserva', { description: 'La habitación ya no está libre esas noches, la caja se cerró o hubo un error de conexión.' });
        return;
      }
      if (cobradoAhora > 0) {
        const pago = await registrarPago(reserva.id, cobradoAhora, metodoId, cobro === 'parcial' ? 'Pago parcial' : 'Pago total');
        if (!pago) {
          toast.error('Se creó la reserva, pero no se registró el cobro', { description: 'Cobralo desde Comprobantes → Cobros pendientes.' });
          onClose();
          return;
        }
      }
      notifySuccess('Reserva guardada', `${huesped.trim()} - Hab. ${datos.habitacion}`);
      onClose();
    } finally {
      setGuardando(false);
    }
  };

  const err = (k: string) => marcados.has(k) ? 'border-destructive focus-visible:ring-destructive/40' : '';

  return (
    <div className="grid md:grid-cols-[1fr_300px]">
      {/* ── Formulario ── */}
      <div className="min-w-0 p-5 pb-4 flex flex-col gap-3.5">
        <div className="flex items-center gap-3 pr-2">
          <DialogTitle className="text-[17px]">Nueva reserva</DialogTitle>
          <DialogDescription className="ml-auto text-xs">
            Campos con <b className="text-destructive">*</b> obligatorios
          </DialogDescription>
        </div>

        {!cajaAbierta && (
          <div className="flex items-center gap-3 text-[13px] rounded-lg px-3 py-2 bg-[#EF444426] text-destructive">
            La caja está cerrada: hay que abrirla para crear reservas.
            {puedeCaja && (
              <Button type="button" size="sm" variant="outline" className="ml-auto h-7" onClick={() => { setModulo('caja'); onClose(); }}>
                Abrir caja
              </Button>
            )}
          </div>
        )}

        {/* Huésped */}
        <section className="flex flex-col gap-2" ref={huespedRef}>
          <Titulo>Huésped</Titulo>
          {cliente ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-[#0F766E55] bg-[#0F766E14] px-3 py-2 text-[13px] min-h-9">
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0F766E1F] text-primary">Cliente</span>
              <span className="truncate"><b>{cliente.nombre}</b> · DNI {cliente.dni}{cliente.telefono && ` · ${cliente.telefono}`}</span>
              <button type="button" className="ml-auto text-xs text-muted-foreground underline underline-offset-2" onClick={cambiarCliente}>Cambiar</button>
            </div>
          ) : (
            <div className="relative">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Campo etiqueta="Nombre y apellido" obligatorio>
                  <Input value={huesped} onChange={e => { setHuesped(e.target.value); setBuscando('huesped'); }} onFocus={() => setBuscando('huesped')} placeholder="Si ya vino, aparece al escribir" autoComplete="off" className={err('huesped')} autoFocus />
                </Campo>
                <Campo etiqueta="DNI" obligatorio>
                  <Input value={dni} onChange={e => { setDni(e.target.value); setBuscando('dni'); }} onFocus={() => setBuscando('dni')} inputMode="numeric" autoComplete="off" className={err('dni')} />
                </Campo>
                <Campo etiqueta="Teléfono" obligatorio>
                  <Input value={telefono} onChange={e => setTelefono(e.target.value)} inputMode="tel" autoComplete="off" className={err('telefono')} />
                </Campo>
              </div>
              {sugerencias.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-lg border bg-popover shadow-lg overflow-hidden" role="listbox">
                  {sugerencias.map(c => (
                    <button key={c.id} type="button" role="option" aria-selected={false} onClick={() => elegirCliente(c)} className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-[13px] hover:bg-muted">
                      <span className="truncate">{c.nombre} <span className="text-muted-foreground">· DNI {c.dni}</span></span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {c.historialEstadias.length > 0 ? `${c.historialEstadias.length} ${c.historialEstadias.length === 1 ? 'estadía' : 'estadías'}` : 'cliente'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="relative">
            <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => setMasDatos(true)}>
              + Más datos (opcional){(extra.email || extra.nacionalidad || extra.fechaNacimiento || extra.domicilio) && ' · cargados'}
            </button>
            {masDatos && (
              <div className="absolute left-0 top-6 z-30 w-[min(440px,100%)] rounded-xl border bg-popover shadow-xl p-3 flex flex-col gap-2">
                <div className="flex items-center">
                  <p className="text-[13px] font-semibold">Más datos del huésped (opcional)</p>
                  <button type="button" className="ml-auto p-1 rounded hover:bg-muted" onClick={() => setMasDatos(false)} aria-label="Cerrar"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Campo etiqueta="Email"><Input type="email" value={extra.email} onChange={e => setExtra({ ...extra, email: e.target.value })} /></Campo>
                  <Campo etiqueta="Nacionalidad"><Input value={extra.nacionalidad} onChange={e => setExtra({ ...extra, nacionalidad: e.target.value })} /></Campo>
                  <Campo etiqueta="Fecha de nacimiento"><Input type="date" value={extra.fechaNacimiento} onChange={e => setExtra({ ...extra, fechaNacimiento: e.target.value })} /></Campo>
                  <Campo etiqueta="Domicilio"><Input value={extra.domicilio} onChange={e => setExtra({ ...extra, domicilio: e.target.value })} /></Campo>
                </div>
                <Button type="button" size="sm" className="self-end" onClick={() => setMasDatos(false)}>Listo</Button>
              </div>
            )}
          </div>
        </section>

        {/* Tarifa */}
        <section className="flex flex-col gap-2">
          <Titulo>Tarifa</Titulo>
          <div className="grid grid-cols-2 sm:grid-cols-[1.6fr_1fr_1fr] gap-2">
            <Campo etiqueta="Tarifa" className="col-span-2 sm:col-span-1">
              <Select value={tipoTarifa} onValueChange={cambiarTarifa}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tiposTarifa.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </Campo>
            <Campo etiqueta="Adultos"><Contador valor={adultos} min={1} max={Math.max(1, capacidad)} onChange={setAdultos} etiqueta="Adultos" /></Campo>
            {ninosAparte && (
              <Campo etiqueta="Niños"><Contador valor={ninos} min={0} max={Math.max(0, capacidad - adultos)} onChange={setNinos} etiqueta="Niños" /></Campo>
            )}
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            {compartida
              ? `Compartida: ${capacidad} ${capacidad === 1 ? 'cama libre' : 'camas libres'} esas noches (cada persona ocupa una cama).`
              : `Habitación ${datos.habitacion}: hasta ${capacidad} ${capacidad === 1 ? 'persona' : 'personas'}.`}
          </p>
          {camposPersonalizados.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {camposPersonalizados.map(c => (
                <Campo key={c.nombre} etiqueta={c.nombre} obligatorio={c.requerido}>
                  <Input
                    type={c.tipo === 'numero' ? 'number' : 'text'}
                    value={camposTarifa[c.nombre] || ''}
                    onChange={e => setCamposTarifa({ ...camposTarifa, [c.nombre]: e.target.value })}
                    className={err(`campo:${c.nombre}`)}
                  />
                </Campo>
              ))}
            </div>
          )}
          {acompanante && (
            <p className="text-[12px] rounded-lg px-3 py-2 bg-[#D9770626] text-warning">
              Esta tarifa incluye {acompanante.etiqueta?.toLowerCase() || 'acompañante'} sin cargo en otra habitación: seguí en &quot;Formulario completo&quot;.
            </p>
          )}
        </section>

        {/* Cobro */}
        <section className="flex flex-col gap-2">
          <Titulo>Cobro</Titulo>
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg border bg-background h-9" role="group" aria-label="Cobro">
            {([['ninguno', 'Sin cobro ahora'], ['parcial', 'Seña'], ['total', 'Total']] as [Cobro, string][]).map(([v, t]) => (
              <button
                key={v}
                type="button"
                onClick={() => { setCobro(v); setMonto(''); }}
                aria-pressed={cobro === v}
                className={cn('rounded-md text-[12.5px] font-medium transition-colors', cobro === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
              >
                {t}
              </button>
            ))}
          </div>
          {cobro !== 'ninguno' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Campo etiqueta="Forma de pago" obligatorio>
                <Select value={metodoId} onValueChange={elegirMetodo}>
                  <SelectTrigger className={cn('h-9', err('metodo'))}><SelectValue placeholder="Elegir…" /></SelectTrigger>
                  <SelectContent>
                    {metodosPago.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Campo>
              {tieneCuotas && metodo && (
                <Campo etiqueta="Cuotas">
                  <Select value={cuotas} onValueChange={setCuotas}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {metodo.cuotas.map(c => (
                        <SelectItem key={`${c.cantidad}|${c.porcentaje}`} value={`${c.cantidad}|${c.porcentaje}`}>
                          {c.cantidad} {c.cantidad === 1 ? 'cuota' : 'cuotas'}{c.porcentaje > 0 ? ` (+${c.porcentaje}%)` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
              )}
              {cobro === 'parcial' && (
                <Campo etiqueta="Monto de la seña" obligatorio>
                  <Input type="number" min={senaMinima} max={total} value={monto} onChange={e => setMonto(e.target.value)} className={err('monto')} />
                </Campo>
              )}
            </div>
          )}
          <p className="text-[11.5px] text-muted-foreground">
            {cobro === 'parcial' ? `Mínimo 30%: ${formatMoney(senaMinima)}.` : cobro === 'total' ? 'Se cobra todo ahora.' : 'La reserva queda con todo el saldo pendiente.'}
          </p>
        </section>

        {errores.length > 0 && (
          <p className="text-[12px] text-destructive" role="alert">{errores.join(' ')}</p>
        )}
      </div>

      {/* ── Ticket ── */}
      <aside className="bg-muted/40 border-t md:border-t-0 md:border-l p-4 flex flex-col gap-2.5 md:rounded-r-lg">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold">Hab. {datos.habitacion}</span>
          {hab && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#0F766E1F] text-primary">{hab.tipo}</span>}
          <button type="button" onClick={onClose} className="ml-auto p-1 rounded-full hover:bg-muted text-muted-foreground" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <FilaTicket etiqueta="Entrada" valor={fechaCorta(datos.checkin)} />
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-muted-foreground">Noches</span>
          <div className="w-[118px]"><Contador valor={noches} min={1} max={Math.max(1, datos.maxNoches)} onChange={setNoches} etiqueta="Noches" /></div>
        </div>
        <FilaTicket etiqueta="Salida" valor={fechaCorta(checkout)} />
        <p className="text-[11px] text-muted-foreground -mt-1">
          {datos.maxNoches >= 30 ? 'Libre por 30 noches o más.' : `Libre hasta el ${fechaCorta(sumarDiasFecha(datos.checkin, datos.maxNoches))}.`}
        </p>

        <div className="h-px bg-border my-0.5" />
        <FilaTicket etiqueta="Huésped" valor={huesped.trim() || '—'} />
        <FilaTicket etiqueta="Personas" valor={`${adultos} ${adultos === 1 ? 'adulto' : 'adultos'}${ninosCuenta > 0 ? ` + ${ninosCuenta} ${ninosCuenta === 1 ? 'niño' : 'niños'}` : ''}`} />
        <FilaTicket etiqueta="Tarifa" valor={tipoTarifa.charAt(0).toUpperCase() + tipoTarifa.slice(1)} />
        {cobro !== 'ninguno' && (
          <FilaTicket etiqueta="Forma de pago" valor={metodo ? `${metodo.nombre}${cuotasNum > 1 ? ` · ${cuotasNum} cuotas` : ''}` : '—'} />
        )}

        <div className="h-px bg-border my-0.5" />
        {desglose ? (
          <div className="text-[11.5px] text-muted-foreground tabular-nums space-y-0.5">
            <p>{desglose.nochesCobrables} {desglose.nochesCobrables === 1 ? 'noche' : 'noches'} × {formatMoney(desglose.modoCobro === 'porCama' ? desglose.precioUnitario * desglose.adultos : desglose.precioUnitario)}{desglose.modoCobro === 'porCama' ? ` (${desglose.adultos} × ${formatMoney(desglose.precioUnitario)})` : ''}</p>
            {desglose.nochesGratis > 0 && <p>{desglose.nochesGratis} {desglose.nochesGratis === 1 ? 'noche' : 'noches'} de cortesía</p>}
            {desglose.totalNinos > 0 && <p>Niños: {formatMoney(desglose.totalNinos)}</p>}
            {recargo > 0 && <p>Recargo {recargoPct}%: {formatMoney(recargo)}</p>}
          </div>
        ) : (
          <p className="text-[11.5px] text-destructive">La tarifa &quot;{tipoTarifa}&quot; no tiene precios cargados.</p>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-[13px]">Total</span>
          <strong className="text-[22px] text-primary tabular-nums">{formatMoney(total)}</strong>
        </div>
        <FilaTicket etiqueta="Cobrado ahora" valor={formatMoney(cobradoAhora)} />
        <FilaTicket etiqueta="Saldo" valor={formatMoney(Math.max(0, total - cobradoAhora))} fuerte />

        <div className="flex-1" />
        <Button type="button" className="w-full h-11 text-[14px] font-semibold mt-2" onClick={crear} disabled={guardando || !cajaAbierta || !!acompanante}>
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : !cajaAbierta ? <Lock className="w-4 h-4" /> : null}
          {guardando ? 'Guardando…' : 'Crear reserva'}
        </Button>
        <div className="flex items-center justify-between">
          <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={irAlFormularioCompleto}>Formulario completo</button>
          <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={onClose}>Cancelar</button>
        </div>
      </aside>
    </div>
  );
}

function FilaTicket({ etiqueta, valor, fuerte }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="text-muted-foreground shrink-0">{etiqueta}</span>
      <span className={cn('text-right truncate tabular-nums', fuerte ? 'font-bold' : 'font-semibold')}>{valor}</span>
    </div>
  );
}

'use client';

// El estado de cuenta de un titular: qué se le anotó, qué pagó, y cuánto
// debe. Desde acá se cobra, se anula un cobro mal cargado, se anula un pase
// a cuenta corriente hecho por error y se editan sus datos. Solo para quien
// maneja la cuenta corriente (la API lo exige).

import { Fragment, useCallback, useEffect, useState } from 'react';
import { Building2, User, Loader2, Wallet, Pencil, Undo2, AlertTriangle, Phone, Mail, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useHotelStore } from '@/lib/store';
import { api, type DbEstadoDeCuenta } from '@/lib/api-client';
import { formatMoney, formatFechaHora, numeroDeReserva } from '@/lib/format';
import { notifySuccess } from '@/lib/notify';
import { aPesos, aCentavos, formatearDocumento } from '@/lib/cuenta-corriente';
import FormTitular from './FormTitular';

interface Props {
  titularId: string | null;
  onCerrar: () => void;
  /** Algo cambió (un cobro, una anulación, los datos): la lista se actualiza. */
  onCambio: () => void;
}

export default function EstadoDeCuenta({ titularId, onCerrar, onCambio }: Props) {
  return (
    <Dialog open={!!titularId} onOpenChange={abierto => { if (!abierto) onCerrar(); }}>
      <DialogContent size="trabajo">
        {/* key: cada titular arranca de cero, sin arrastrar el formulario del anterior. */}
        {titularId && <Contenido key={titularId} titularId={titularId} onCambio={onCambio} />}
      </DialogContent>
    </Dialog>
  );
}

type Vista = 'cuenta' | 'cobrar' | 'editar';

function Contenido({ titularId, onCambio }: { titularId: string; onCambio: () => void }) {
  const syncFromServer = useHotelStore(s => s.syncFromServer);
  const [datos, setDatos] = useState<DbEstadoDeCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('cuenta');
  const [anulando, setAnulando] = useState<{ id: string; monto: number; metodo: string } | null>(null);
  const [anulandoCargo, setAnulandoCargo] = useState<{ reservaId: string; monto: number; concepto: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // Los cargos con el detalle de su reserva abierto.
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set());
  const alternar = (id: string) => setAbiertos(prev => {
    const nuevo = new Set(prev);
    if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
    return nuevo;
  });

  const cargar = useCallback(async () => {
    try {
      setDatos(await api.cuentaCorriente.estadoDeCuenta(titularId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo traer el estado de cuenta.');
    }
  }, [titularId]);

  useEffect(() => { void cargar(); }, [cargar]);

  // Después de cobrar o anular: el estado de cuenta, la lista, y la caja (el
  // cobro dejó —o sacó— un ingreso en el turno).
  const refrescarTodo = async () => {
    await cargar();
    onCambio();
    void syncFromServer();
  };

  const anular = async () => {
    if (!anulando) return;
    setTrabajando(true);
    try {
      await api.cuentaCorriente.anularCobro(titularId, anulando.id);
      notifySuccess('Cobro anulado', `${formatMoney(aPesos(anulando.monto))} (${anulando.metodo}). Salió también de la caja.`);
      setAnulando(null);
      await refrescarTodo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anular el cobro.');
      setAnulando(null);
    } finally {
      setTrabajando(false);
    }
  };

  const anularCargo = async () => {
    if (!anulandoCargo) return;
    setTrabajando(true);
    try {
      await api.cuentaCorriente.anularCargo(anulandoCargo.reservaId);
      notifySuccess('Pase anulado', `${formatMoney(aPesos(anulandoCargo.monto))} salieron de la cuenta. La reserva volvió a tener su saldo pendiente.`);
      setAnulandoCargo(null);
      await refrescarTodo();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo anular el pase.');
      setAnulandoCargo(null);
    } finally {
      setTrabajando(false);
    }
  };

  if (!datos) {
    return (
      <div className="py-10 flex flex-col items-center gap-2 text-sm text-muted-foreground">
        {error ? <p className="text-destructive">{error}</p> : <><Loader2 className="w-5 h-5 animate-spin" /> Trayendo el estado de cuenta…</>}
      </div>
    );
  }

  const t = datos.titular;
  const saldo = aPesos(t.saldo ?? 0);
  const pagosPorId = new Map(datos.pagos.map(p => [p.id, p]));
  const cargosPorId = new Map(datos.cargos.map(c => [c.id, c]));

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 flex-wrap">
          {t.tipo === 'empresa' ? <Building2 className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-primary" />}
          {t.nombre}
          {!t.activo && <Badge variant="secondary">Desactivado</Badge>}
        </DialogTitle>
      </DialogHeader>

      {vista === 'editar' ? (
        <FormTitular
          titular={t}
          manejaCuenta
          onGuardado={async () => { setVista('cuenta'); await cargar(); onCambio(); }}
          onCancelar={() => setVista('cuenta')}
        />
      ) : (
        <div className="space-y-4">
          {/* Datos y saldo */}
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <p><span className="text-muted-foreground">{t.cuit ? 'CUIT' : 'DNI'}: </span><span className="font-mono">{t.identificacion.replace(/^(CUIT|DNI) /, '')}</span></p>
              <p><span className="text-muted-foreground">IVA: </span>{t.cuit ? (t.condicionIva ?? 'Sin dato') : 'Consumidor Final (sin CUIT)'}</p>
              {t.domicilioFiscal && <p className="flex items-center gap-1.5 sm:col-span-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{t.domicilioFiscal}</p>}
              {(t.contactoNombre || t.contactoTelefono) && (
                <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{[t.contactoNombre, t.contactoTelefono].filter(Boolean).join(' · ')}</p>
              )}
              {t.contactoEmail && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{t.contactoEmail}</p>}
              <p><span className="text-muted-foreground">Límite: </span>{t.limiteCredito != null ? formatMoney(aPesos(t.limiteCredito)) : 'Sin límite'}</p>
            </div>
            <div className={`rounded-xl border-2 px-5 py-3 text-center ${saldo > 0 ? 'border-[#EF444466] bg-[#EF444414]' : 'border-border bg-[color:var(--muted-a40)]'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${saldo > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>Debe</p>
              <p className={`text-2xl font-bold ${saldo > 0 ? 'text-destructive' : ''}`}>{formatMoney(saldo)}</p>
              {t.superaLimite && (
                <p className="text-xs text-warning flex items-center justify-center gap-1 mt-0.5"><AlertTriangle className="w-3 h-3" />Pasó su límite</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setVista(vista === 'cobrar' ? 'cuenta' : 'cobrar')} disabled={saldo <= 0}>
              <Wallet className="w-4 h-4 mr-1.5" /> Registrar un cobro
            </Button>
            <Button variant="outline" onClick={() => setVista('editar')}>
              <Pencil className="w-4 h-4 mr-1.5" /> Editar datos
            </Button>
          </div>

          {vista === 'cobrar' && (
            <FormCobro
              titularId={titularId}
              saldo={saldo}
              onCancelar={() => setVista('cuenta')}
              onCobrado={async () => { setVista('cuenta'); await refrescarTodo(); }}
            />
          )}

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          {/* Movimientos, como el resumen de una tarjeta */}
          {datos.movimientos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Todavía no tiene movimientos.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F1F5F94D]">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="text-right">Se le anotó</TableHead>
                    <TableHead className="text-right">Pagó</TableHead>
                    <TableHead className="text-right">Debía</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.movimientos.map(m => {
                    const pago = m.tipo === 'pago' ? pagosPorId.get(m.id) : undefined;
                    const cargo = m.tipo === 'cargo' ? cargosPorId.get(m.id) : undefined;
                    const abierto = !!cargo && abiertos.has(cargo.id);
                    return (
                      <Fragment key={`${m.tipo}-${m.id}`}>
                      <TableRow className={abierto ? 'bg-[#0F766E0F]' : undefined}>
                        <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(m.fecha)}</TableCell>
                        <TableCell className="text-sm">
                          {m.detalle}
                          {cargo && (
                            <button
                              type="button"
                              onClick={() => alternar(cargo.id)}
                              aria-expanded={abierto}
                              className="ml-2 inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
                            >
                              {abierto ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              {abierto ? 'Ocultar' : 'Ver reserva'}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{m.importe > 0 ? formatMoney(aPesos(m.importe)) : ''}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-primary">{m.importe < 0 ? formatMoney(aPesos(-m.importe)) : ''}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">{formatMoney(aPesos(m.saldo))}</TableCell>
                        <TableCell className="text-right">
                          {cargo && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive disabled:text-muted-foreground"
                              disabled={!cargo.anulable}
                              title={cargo.motivoNoAnulable ?? 'Sacar este pase de la cuenta: la reserva vuelve a tener su saldo.'}
                              onClick={() => setAnulandoCargo({ reservaId: cargo.reserva.id, monto: cargo.monto, concepto: cargo.concepto })}
                            >
                              <Undo2 className="w-3.5 h-3.5 mr-1" /> Anular
                            </Button>
                          )}
                          {pago?.anulable && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={() => setAnulando({ id: pago.id, monto: pago.monto, metodo: pago.metodo })}
                            >
                              <Undo2 className="w-3.5 h-3.5 mr-1" /> Anular
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {cargo && abierto && (
                        <TableRow className="bg-[#0F766E0F] hover:bg-[#0F766E0F]">
                          <TableCell colSpan={6} className="pt-1 pb-3">
                            <DetalleReserva cargo={cargo} />
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Un cobro se puede anular mientras la caja en que entró siga abierta. Anularlo lo saca también de la caja.
            Un pase a cuenta corriente se puede anular si la reserva no está facturada y la cuenta todavía debe ese cargo entero.
          </p>
        </div>
      )}

      <AlertDialog open={!!anulandoCargo} onOpenChange={abierto => { if (!abierto && !trabajando) setAnulandoCargo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este pase a cuenta corriente?</AlertDialogTitle>
            <AlertDialogDescription>
              {anulandoCargo && `${anulandoCargo.concepto}: ${formatMoney(aPesos(anulandoCargo.monto))} salen de la cuenta de ${t.nombre.replace(/\.$/, '')}. La reserva vuelve a tener ese saldo pendiente: después se cobra o se pasa a la cuenta correcta. La caja no cambia.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trabajando}>No</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); void anularCargo(); }} disabled={trabajando} className="bg-destructive hover:bg-[color:var(--destructive-a90)]">
              {trabajando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Sí, anular el pase
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!anulando} onOpenChange={abierto => { if (!abierto && !trabajando) setAnulando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este cobro?</AlertDialogTitle>
            <AlertDialogDescription>
              {anulando && `${formatMoney(aPesos(anulando.monto))} (${anulando.metodo}). La deuda vuelve a subir y el ingreso sale de la caja.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={trabajando}>No</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); void anular(); }} disabled={trabajando} className="bg-destructive hover:bg-[color:var(--destructive-a90)]">
              {trabajando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Sí, anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function FormCobro({ titularId, saldo, onCancelar, onCobrado }: {
  titularId: string;
  /** En pesos. */
  saldo: number;
  onCancelar: () => void;
  onCobrado: () => void;
}) {
  const metodosPago = useHotelStore(s => s.metodosPago);
  const cajaAbierta = useHotelStore(s => s.caja.estado === 'abierta');
  // Por defecto, todo lo que debe: es lo más común. Si paga una parte, se cambia.
  const [monto, setMonto] = useState(String(saldo));
  const [metodo, setMetodo] = useState(metodosPago[0]?.id ?? '');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoNum = Number(monto.replace(',', '.'));
  const montoValido = Number.isFinite(montoNum) && montoNum > 0;
  const excede = montoValido && montoNum > saldo;

  const cobrar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const r = await api.cuentaCorriente.cobrar(titularId, { monto: aCentavos(montoNum), metodo, nota: nota.trim() || undefined });
      notifySuccess('Cobro registrado', `${formatMoney(montoNum)}. ${r.saldo > 0 ? `Queda debiendo ${formatMoney(aPesos(r.saldo))}.` : 'Quedó al día.'}`);
      onCobrado();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el cobro.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-3 bg-[color:var(--muted-a20)]">
      {!cajaAbierta && (
        <p className="text-sm text-warning flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> La caja está cerrada. Abrila para registrar un cobro: la plata entra en el turno.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cobro-monto">Monto</Label>
          <Input id="cobro-monto" value={monto} onChange={e => setMonto(e.target.value)} inputMode="decimal" />
          {excede && <p className="text-xs text-destructive">Es más de lo que debe ({formatMoney(saldo)}).</p>}
        </div>
        <div className="grid gap-1.5">
          <Label>Forma de pago</Label>
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger><SelectValue placeholder="Elegí cómo pagó" /></SelectTrigger>
            <SelectContent>
              {metodosPago.map(m => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cobro-nota">Nota (opcional)</Label>
        <Textarea id="cobro-nota" value={nota} onChange={e => setNota(e.target.value)} rows={2} placeholder="Nº de transferencia, cheque, qué facturas cubre…" maxLength={300} />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancelar} disabled={guardando}>Cancelar</Button>
        <Button onClick={cobrar} disabled={!cajaAbierta || !montoValido || excede || !metodo || guardando}>
          {guardando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
          Cobrar {montoValido ? formatMoney(montoNum) : ''}
        </Button>
      </div>
    </div>
  );
}

/** Todos los datos de la reserva de un cargo: de qué estadía es la deuda. */
function DetalleReserva({ cargo }: { cargo: DbEstadoDeCuenta['cargos'][number] }) {
  const r = cargo.reserva;
  const dato = (etiqueta: string, valor: React.ReactNode) => (
    <div>
      <span className="block text-[11.5px] text-muted-foreground">{etiqueta}</span>
      <span className="font-semibold text-sm">{valor}</span>
    </div>
  );
  const fecha = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-x-5 gap-y-2.5">
        {dato('Reserva', numeroDeReserva({ numero: r.numero ?? undefined }) || '—')}
        {dato('Huésped', r.huesped)}
        {dato('DNI', r.dni ? <span className="font-mono">{formatearDocumento(r.dni)}</span> : '—')}
        {dato('Habitación', r.habitacion)}
        {dato('Personas', `${r.personas}${(r.ninos ?? 0) > 0 ? ` + ${r.ninos} ${r.ninos === 1 ? 'niño' : 'niños'}` : ''}`)}
        {dato('Entrada', fecha(r.checkin))}
        {dato('Salida', fecha(r.checkout))}
        {dato('Noches', r.noches)}
        {dato('Total de la reserva', r.total != null ? formatMoney(aPesos(r.total)) : '—')}
        {dato('Factura', r.facturada
          ? <Badge className="bg-[#8B5CF626] text-chart-5 border-0">Facturada</Badge>
          : <Badge className="bg-[#D9770618] text-[#B45309] border-0">Sin facturar</Badge>)}
      </div>
      <p className="text-xs text-muted-foreground">Pasada a la cuenta por {cargo.empleadoNombre} el {formatFechaHora(cargo.fecha)}.</p>
    </div>
  );
}

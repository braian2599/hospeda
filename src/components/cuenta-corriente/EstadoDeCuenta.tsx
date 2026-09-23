'use client';

// El estado de cuenta de un titular: qué se le anotó, qué pagó, y cuánto
// debe. Desde acá se cobra, se anula un cobro mal cargado y se editan sus
// datos. Solo para quien maneja la cuenta corriente (la API lo exige).

import { useCallback, useEffect, useState } from 'react';
import { Building2, User, Loader2, Wallet, Pencil, Undo2, AlertTriangle, Phone, Mail, MapPin } from 'lucide-react';
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
import { formatMoney, formatFechaHora } from '@/lib/format';
import { notifySuccess } from '@/lib/notify';
import { aPesos, aCentavos } from '@/lib/cuenta-corriente';
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
  const [trabajando, setTrabajando] = useState(false);

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
              <p><span className="text-muted-foreground">CUIT: </span><span className="font-mono">{t.cuitFormateado}</span></p>
              <p><span className="text-muted-foreground">IVA: </span>{t.condicionIva ?? 'Sin dato'}</p>
              {t.domicilioFiscal && <p className="flex items-center gap-1.5 sm:col-span-2"><MapPin className="w-3.5 h-3.5 text-muted-foreground" />{t.domicilioFiscal}</p>}
              {(t.contactoNombre || t.contactoTelefono) && (
                <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-muted-foreground" />{[t.contactoNombre, t.contactoTelefono].filter(Boolean).join(' · ')}</p>
              )}
              {t.contactoEmail && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-muted-foreground" />{t.contactoEmail}</p>}
              <p><span className="text-muted-foreground">Límite: </span>{t.limiteCredito != null ? formatMoney(aPesos(t.limiteCredito)) : 'Sin límite'}</p>
            </div>
            <div className={`rounded-xl border-2 px-5 py-3 text-center ${saldo > 0 ? 'border-[#EF444466] bg-[#EF444414]' : 'border-border bg-muted/40'}`}>
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
                    return (
                      <TableRow key={`${m.tipo}-${m.id}`}>
                        <TableCell className="text-xs whitespace-nowrap">{formatFechaHora(m.fecha)}</TableCell>
                        <TableCell className="text-sm">{m.detalle}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{m.importe > 0 ? formatMoney(aPesos(m.importe)) : ''}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-primary">{m.importe < 0 ? formatMoney(aPesos(-m.importe)) : ''}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">{formatMoney(aPesos(m.saldo))}</TableCell>
                        <TableCell className="text-right">
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Un cobro se puede anular mientras la caja en que entró siga abierta. Anularlo lo saca también de la caja.
          </p>
        </div>
      )}

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
            <AlertDialogAction onClick={e => { e.preventDefault(); void anular(); }} disabled={trabajando} className="bg-destructive hover:bg-destructive/90">
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
    <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
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

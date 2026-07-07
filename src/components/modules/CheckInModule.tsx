'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import type { Reserva, Acompanante } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  LogIn, LogOut, KeyRound, UserPlus, Trash2, Users, AlertCircle, CreditCard, BedDouble,
} from 'lucide-react';
import { toast } from 'sonner';

const formatFecha = (f: string) => {
  if (!f) return '—';
  const d = new Date(f + 'T12:00:00');
  return d.toLocaleDateString('es-AR');
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

const estadoPagoBadge: Record<string, string> = {
  Pendiente: 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/50',
  Parcial: 'bg-orange-100 dark:bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-700/50',
  Pagado: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/50',
};

export default function CheckInModule() {
  const {
    reservas, habitaciones, realizarCheckIn, realizarCheckOut,
    calcularTotalReserva, calcularTotalPagado, nochesEntre,
  } = useHotelStore();

  const pendientesCheckIn = reservas.filter(r => r.estado === 'Confirmada');
  const pendientesCheckOut = reservas.filter(r => r.estado === 'Check-In realizado');

  // Modal state
  const [modalTipo, setModalTipo] = useState<'checkin' | 'checkout' | null>(null);
  const [selReserva, setSelReserva] = useState<Reserva | null>(null);

  // Check-in form
  const [docVerificado, setDocVerificado] = useState(false);
  const [firmaConformidad, setFirmaConformidad] = useState(false);
  const [llave, setLlave] = useState('');
  const [emergenciaNombre, setEmergenciaNombre] = useState('');
  const [emergenciaTelefono, setEmergenciaTelefono] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [acompanantes, setAcompanantes] = useState<Acompanante[]>([
    { nombre: '', dni: '', celular: '' },
  ]);

  const openCheckIn = (r: Reserva) => {
    setSelReserva(r);
    setDocVerificado(false);
    setFirmaConformidad(false);
    setLlave('');
    setEmergenciaNombre(r.contactoEmergencia?.nombre || '');
    setEmergenciaTelefono(r.contactoEmergencia?.telefono || '');
    setObservaciones(r.observacionesHuesped || '');
    setAcompanantes(r.acompanantes?.length ? [...r.acompanantes] : [{ nombre: '', dni: '', celular: '' }]);
    setModalTipo('checkin');
  };

  const openCheckOut = (r: Reserva) => {
    setSelReserva(r);
    setModalTipo('checkout');
  };

  const closeModal = () => {
    setModalTipo(null);
    setSelReserva(null);
  };

  const handleConfirmCheckIn = () => {
    if (!selReserva || !llave.trim()) return;
    const datos: Parameters<typeof realizarCheckIn>[1] = {};
    if (docVerificado) datos.documentoVerificado = true;
    if (firmaConformidad) datos.firmaConformidad = true;
    datos.llaveEntregada = llave.trim();
    if (emergenciaNombre.trim() || emergenciaTelefono.trim()) {
      datos.contactoEmergencia = { nombre: emergenciaNombre.trim(), telefono: emergenciaTelefono.trim() };
    }
    if (observaciones.trim()) datos.observacionesHuesped = observaciones.trim();
    const validAcomp = acompanantes.filter(a => a.nombre.trim());
    if (validAcomp.length > 0) datos.acompanantes = validAcomp;
    realizarCheckIn(selReserva.id, datos);
    toast.success('Check-in realizado', { description: `${selReserva.huesped} - Hab. ${selReserva.habitacion}` });
    closeModal();
  };

  const handleConfirmCheckOut = () => {
    if (!selReserva) return;
    realizarCheckOut(selReserva.id);
    toast.success('Check-out realizado', { description: `${selReserva.huesped} - Hab. ${selReserva.habitacion}` });
    closeModal();
  };

  const addAcompanante = () => {
    setAcompanantes(prev => [...prev, { nombre: '', dni: '', celular: '' }]);
  };

  const removeAcompanante = (idx: number) => {
    setAcompanantes(prev => prev.filter((_, i) => i !== idx));
  };

  const updateAcompanante = (idx: number, field: keyof Acompanante, value: string) => {
    setAcompanantes(prev => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"><LogIn className="w-5 h-5 text-emerald-500" /></div> Check-In / Check-Out
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pendientes Check-In */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LogIn className="w-5 h-5 text-emerald-600" />
              Check-Ins Pendientes
              <Badge variant="secondary" className="ml-auto">{pendientesCheckIn.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendientesCheckIn.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay check-ins pendientes.</p>
            ) : (
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                {pendientesCheckIn.map(r => (
                  <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{r.huesped}</span>
                        <Badge className={estadoPagoBadge[r.estadoPago] || ''}>{r.estadoPago}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1"><BedDouble className="w-3 h-3" /> Hab. {r.habitacion}</span>
                        <span>{formatFecha(r.checkin)} → {formatFecha(r.checkout)}</span>
                        <span>{nochesEntre(r.checkin, r.checkout)} noche{s(nochesEntre(r.checkin, r.checkout))}</span>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => openCheckIn(r)}>
                      <KeyRound className="w-3.5 h-3.5 mr-1" />Check-In
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pendientes Check-Out */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LogOut className="w-5 h-5 text-amber-600" />
              Check-Outs Pendientes
              <Badge variant="secondary" className="ml-auto">{pendientesCheckOut.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendientesCheckOut.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No hay check-outs pendientes.</p>
            ) : (
              <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                {pendientesCheckOut.map(r => (
                  <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{r.huesped}</span>
                        <Badge className={estadoPagoBadge[r.estadoPago] || ''}>{r.estadoPago}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1"><BedDouble className="w-3 h-3" /> Hab. {r.habitacion}</span>
                        <span>{formatFecha(r.checkin)} → {formatFecha(r.checkout)}</span>
                        <span>{nochesEntre(r.checkin, r.checkout)} noche{s(nochesEntre(r.checkin, r.checkout))}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => openCheckOut(r)}>
                      <LogOut className="w-3.5 h-3.5 mr-1" />Check-Out
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* =================== MODAL CHECK-IN =================== */}
      <Dialog open={modalTipo === 'checkin'} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          {selReserva && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5" />
                  Check-In — {selReserva.huesped}
                </DialogTitle>
              </DialogHeader>

              {/* Estado de cuenta */}
              <CheckInAccountStatus reserva={selReserva} />

              <Separator />

              {/* Requerimientos */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Requisitos
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="docVerificado"
                      checked={docVerificado}
                      onCheckedChange={(v) => setDocVerificado(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="docVerificado" className="text-sm cursor-pointer">
                      Documento verificado
                    </Label>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="firmaConformidad"
                      checked={firmaConformidad}
                      onCheckedChange={(v) => setFirmaConformidad(v === true)}
                      className="mt-0.5"
                    />
                    <Label htmlFor="firmaConformidad" className="text-sm cursor-pointer">
                      Conformidad del huésped
                    </Label>
                  </div>
                </div>

                {/* Llave */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="llave">Nº de Llave *</Label>
                    <Input
                      id="llave"
                      value={llave}
                      onChange={e => setLlave(e.target.value)}
                      placeholder="Ej: L-01"
                    />
                  </div>
                </div>

                {/* Contacto de emergencia */}
                <div>
                  <h4 className="font-semibold text-sm mb-2">Contacto de emergencia</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Nombre</Label>
                      <Input
                        value={emergenciaNombre}
                        onChange={e => setEmergenciaNombre(e.target.value)}
                        placeholder="Nombre del contacto"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Teléfono</Label>
                      <Input
                        value={emergenciaTelefono}
                        onChange={e => setEmergenciaTelefono(e.target.value)}
                        placeholder="Teléfono del contacto"
                      />
                    </div>
                  </div>
                </div>

                {/* Observaciones */}
                <div className="grid gap-2">
                  <Label>Observaciones del huésped</Label>
                  <Textarea
                    value={observaciones}
                    onChange={e => setObservaciones(e.target.value)}
                    placeholder="Notas u observaciones..."
                    rows={2}
                  />
                </div>

                {/* Acompañantes */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Acompañantes
                    </h4>
                    <Button type="button" size="sm" variant="outline" onClick={addAcompanante}>
                      <UserPlus className="w-3.5 h-3.5 mr-1" />Agregar
                    </Button>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {acompanantes.map((ac, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <Input
                            placeholder="Nombre"
                            value={ac.nombre}
                            onChange={e => updateAcompanante(idx, 'nombre', e.target.value)}
                          />
                          <Input
                            placeholder="DNI"
                            value={ac.dni}
                            onChange={e => updateAcompanante(idx, 'dni', e.target.value)}
                          />
                          <Input
                            placeholder="Celular"
                            value={ac.celular}
                            onChange={e => updateAcompanante(idx, 'celular', e.target.value)}
                          />
                        </div>
                        {acompanantes.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                            onClick={() => removeAcompanante(idx)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                <Button
                  onClick={handleConfirmCheckIn}
                  disabled={!llave.trim()}
                >
                  <KeyRound className="w-4 h-4 mr-1" />Confirmar Check-In
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* =================== MODAL CHECK-OUT =================== */}
      <Dialog open={modalTipo === 'checkout'} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {selReserva && (() => {
            const total = calcularTotalReserva(selReserva.id);
            const pagado = calcularTotalPagado(selReserva.id);
            const saldo = total - pagado;
            const noches = nochesEntre(selReserva.checkin, selReserva.checkout);
            const hab = habitaciones[selReserva.habitacion];

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <LogOut className="w-5 h-5" />
                    Check-Out — {selReserva.huesped}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Habitación</span>
                      <p className="font-medium">{selReserva.habitacion} — {hab?.tipo || '—'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tarifa</span>
                      <p className="font-medium">{selReserva.tipoTarifa || 'Normal'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-in</span>
                      <p className="font-medium">{formatFecha(selReserva.checkin)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Check-out</span>
                      <p className="font-medium">{formatFecha(selReserva.checkout)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Noches</span>
                      <p className="font-medium">{noches} noche{s(noches)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Personas</span>
                      <p className="font-medium">{selReserva.personas}</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Resumen financiero */}
                  <div className="rounded-lg border p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold">{formatMoney(total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pagado</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(pagado)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Saldo</span>
                      <span className={saldo > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                        {formatMoney(saldo)}
                      </span>
                    </div>
                  </div>

                  {saldo > 0 && (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                      <CreditCard className="w-4 h-4" />
                      <span>El huésped tiene un saldo pendiente de {formatMoney(saldo)}.</span>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                  <Button variant="destructive" onClick={handleConfirmCheckOut}>
                    <LogOut className="w-4 h-4 mr-1" />Confirmar Check-Out
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =================== SUB-COMPONENTS =================== */

function CheckInAccountStatus({ reserva }: { reserva: Reserva }) {
  const { calcularTotalReserva, calcularTotalPagado, nochesEntre } = useHotelStore();
  const total = calcularTotalReserva(reserva.id);
  const pagado = calcularTotalPagado(reserva.id);
  const saldo = total - pagado;
  const noches = nochesEntre(reserva.checkin, reserva.checkout);

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <CreditCard className="w-4 h-4" />
        Estado de cuenta
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground text-xs block">Total</span>
          <span className="font-bold text-base">{formatMoney(total)}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Pagado</span>
          <span className="font-bold text-base text-emerald-600 dark:text-emerald-400">{formatMoney(pagado)}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Saldo</span>
          <span className={`font-bold text-base ${saldo > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {formatMoney(saldo)}
          </span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {reserva.personas} persona{s(reserva.personas)} · {noches} noche{s(noches)} · {reserva.tipoTarifa || 'Normal'}
      </div>
    </div>
  );
}

function s(n: number) {
  return n !== 1 ? 's' : '';
}
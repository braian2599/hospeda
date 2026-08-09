'use client';

import { useState } from 'react';
import { useHotelStore } from '@/lib/store';
import type { Reserva, Acompanante, Menor } from '@/lib/types';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  LogIn, LogOut, KeyRound, UserPlus, Trash2, Users, AlertCircle, CreditCard, BedDouble, Baby,
} from 'lucide-react';
import ModuleHeader from '@/components/layout/ModuleHeader';
import { toast } from 'sonner';
import { notifySuccess } from '@/lib/notify';

const formatFecha = (f: string) => {
  if (!f) return '—';
  const d = new Date(f + 'T12:00:00');
  return d.toLocaleDateString('es-AR');
};

const formatMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

const estadoPagoBadge: Record<string, string> = {
  Pendiente: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
  Parcial: 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]',
  Pagado: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]',
};

const PARENTESCO_OPTIONS = [
  'Hijo/a', 'Hijo/astra', 'Nieto/a', 'Sobrino/a', 'Primo/a', 'Otro',
];

interface MenorForm {
  nombre: string;
  documento: string;
  edad: string;
  parentesco: string;
}

function emptyMenorForm(): MenorForm {
  return { nombre: '', documento: '', edad: '', parentesco: 'Hijo/a' };
}

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
  const [dialogKey, setDialogKey] = useState(0);

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

  // Menores form state
  const [menoresForms, setMenoresForms] = useState<MenorForm[]>([]);
  const [menoresErrors, setMenoresErrors] = useState<string[]>([]);

  const openCheckIn = (r: Reserva) => {
    setSelReserva(r);
    setDocVerificado(false);
    setFirmaConformidad(false);
    setLlave('');
    setEmergenciaNombre(r.contactoEmergencia?.nombre || '');
    setEmergenciaTelefono(r.contactoEmergencia?.telefono || '');
    setObservaciones(r.observacionesHuesped || '');
    setAcompanantes(r.acompanantes?.length ? [...r.acompanantes] : [{ nombre: '', dni: '', celular: '' }]);

    // Si ya tiene menores registrados (check-in previo), precargar
    if (r.menores && r.menores.length > 0) {
      setMenoresForms(r.menores.map(m => ({
        nombre: m.nombre,
        documento: m.documento,
        edad: String(m.edad),
        parentesco: m.parentesco,
      })));
    } else if ((r.ninos || 0) > 0) {
      // Generar formularios vacíos según la cantidad de menores declarados
      const forms: MenorForm[] = [];
      for (let i = 0; i < r.ninos!; i++) {
        forms.push(emptyMenorForm());
      }
      setMenoresForms(forms);
    } else {
      setMenoresForms([]);
    }
    setMenoresErrors([]);

    setModalTipo('checkin');
  };

  const openCheckOut = (r: Reserva) => {
    setSelReserva(r);
    setModalTipo('checkout');
  };

  const closeModal = () => {
    setModalTipo(null);
    setSelReserva(null);
    setDialogKey(prev => prev + 1);
  };

  const validateMenores = (): boolean => {
    const errs: string[] = [];
    for (let i = 0; i < menoresForms.length; i++) {
      const m = menoresForms[i];
      if (!m.nombre.trim()) errs.push(`Menor ${i + 1}: nombre obligatorio`);
      if (!m.documento.trim()) errs.push(`Menor ${i + 1}: documento obligatorio`);
      const edad = parseInt(m.edad);
      if (isNaN(edad) || edad < 0 || edad > 17) errs.push(`Menor ${i + 1}: edad debe ser entre 0 y 17`);
      if (!m.parentesco.trim()) errs.push(`Menor ${i + 1}: parentesco obligatorio`);
    }
    setMenoresErrors(errs);
    return errs.length === 0;
  };

  const [checkLoading, setCheckLoading] = useState(false);

  const handleConfirmCheckIn = async () => {
    if (!selReserva || !llave.trim()) return;

    // Validar menores si la reserva tiene ninos > 0
    const cantNinos = selReserva.ninos || 0;
    if (cantNinos > 0) {
      if (menoresForms.length !== cantNinos) {
        toast.error(`Se requieren datos de ${cantNinos} menor${cantNinos > 1 ? 'es' : ''}`);
        return;
      }
      if (!validateMenores()) {
        toast.error('Completá todos los datos obligatorios de los menores');
        return;
      }
    }

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

    // Pasar menores al store
    if (cantNinos > 0 && menoresForms.length > 0) {
      datos.menores = menoresForms.map(m => ({
        nombre: m.nombre.trim(),
        documento: m.documento.trim(),
        edad: parseInt(m.edad) || 0,
        parentesco: m.parentesco.trim(),
      }));
    }

    try {
      setCheckLoading(true);
      const resultado = await realizarCheckIn(selReserva.id, datos);
      if (resultado) {
        closeModal();
        const desc = `${selReserva.huesped} - Hab. ${selReserva.habitacion}${cantNinos > 0 ? ` (${cantNinos} menor${cantNinos > 1 ? 'es' : ''} registrados)` : ''}`;
        notifySuccess('Check-in realizado', desc);
      } else {
        toast.error('No se pudo realizar el check-in', { description: 'La reserva ya no está en estado Confirmada, faltan datos de menores, o hubo un error de conexión.' });
      }
    } catch (err) {
      console.error('Error en check-in:', err);
      toast.error('Error al realizar check-in');
    } finally {
      setCheckLoading(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!selReserva) return;
    try {
      setCheckLoading(true);
      const resultado = await realizarCheckOut(selReserva.id);
      if (resultado) {
        closeModal();
        notifySuccess('Check-out realizado', `${selReserva.huesped} - Hab. ${selReserva.habitacion}`);
      } else {
        toast.error('No se pudo realizar el check-out', { description: 'La reserva ya no está en estado Check-In realizado o hubo un error de conexión.' });
      }
    } catch (err) {
      console.error('Error en check-out:', err);
      toast.error('Error al realizar check-out');
    } finally {
      setCheckLoading(false);
    }
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

  const updateMenor = (idx: number, field: keyof MenorForm, value: string) => {
    setMenoresForms(prev => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  };

  // Determinar si la reserva seleccionada requiere datos de menores
  const requiereMenores = selReserva && (selReserva.ninos || 0) > 0;
  const menoresCompletos = requiereMenores && menoresForms.length === (selReserva?.ninos || 0)
    && menoresForms.every(m => m.nombre.trim() && m.documento.trim() && m.edad.trim() && m.parentesco.trim());

  const puedeConfirmarCheckIn = llave.trim() && (!requiereMenores || menoresCompletos);

  return (
    <div className="space-y-6">
      <ModuleHeader icon={LogIn} title="Check-In / Check-Out" subtitle="Gestioná ingresos y egresos de huéspedes" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pendientes Check-In */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <LogIn className="w-5 h-5 text-[#166534]" />
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
                        {(r.ninos || 0) > 0 && (
                          <Badge variant="outline" className="bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]">
                            <Baby className="w-3 h-3 mr-1" />{r.ninos} menor{(r.ninos || 0) > 1 ? 'es' : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="flex items-center gap-1"><BedDouble className="w-3 h-3" /> Hab. {r.habitacion}</span>
                        <span>{formatFecha(r.checkin)} → {formatFecha(r.checkout)}</span>
                        <span>{nochesEntre(r.checkin, r.checkout)} noche{s(nochesEntre(r.checkin, r.checkout))}</span>
                        <span>{r.personas} adulto{s(r.personas)}{(r.ninos || 0) > 0 ? ` + ${r.ninos} niño${(r.ninos || 0) > 1 ? 's' : ''}` : ''}</span>
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
              <LogOut className="w-5 h-5 text-[#92400E]" />
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
                        {r.menores && r.menores.length > 0 && (
                          <Badge variant="outline" className="bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]">
                            <Baby className="w-3 h-3 mr-1" />{r.menores.length} menor{r.menores.length > 1 ? 'es' : ''}
                          </Badge>
                        )}
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
      <Dialog key={`checkin-${dialogKey}`} open={modalTipo === 'checkin'} onOpenChange={closeModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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

              {/* ═══════════ DATOS DE MENORES (OBLIGATORIO si ninos > 0) ═══════════ */}
              {requiereMenores && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Baby className="w-5 h-5 text-[#5B21B6]" />
                    <h4 className="font-semibold text-sm">
                      Datos de menores ({selReserva.ninos}) — <span className="text-[#EF4444]">Obligatorio</span>
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    La reserva registra {selReserva.ninos} menor{selReserva.ninos! > 1 ? 'es' : ''}.
                    Debes completar los datos de cada uno para poder realizar el check-in.
                  </p>

                  {menoresErrors.length > 0 && (
                    <div className="rounded-lg border border-[#FECACA] bg-[#FEE2E2] p-3 space-y-1">
                      {menoresErrors.map((err, i) => (
                        <p key={i} className="text-xs text-[#991B1B]">{err}</p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-4">
                    {menoresForms.map((menor, idx) => (
                      <div key={idx} className="rounded-lg border p-4 space-y-3 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold flex items-center gap-1.5">
                            <Baby className="w-4 h-4 text-[#7C3AED]" />
                            Menor {idx + 1}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label htmlFor={`menor-nombre-${idx}`}>Nombre completo *</Label>
                            <Input
                              id={`menor-nombre-${idx}`}
                              value={menor.nombre}
                              onChange={e => updateMenor(idx, 'nombre', e.target.value)}
                              placeholder="Nombre del menor"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`menor-doc-${idx}`}>Documento / DNI *</Label>
                            <Input
                              id={`menor-doc-${idx}`}
                              value={menor.documento}
                              onChange={e => updateMenor(idx, 'documento', e.target.value)}
                              placeholder="Documento del menor"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`menor-edad-${idx}`}>Edad (años) *</Label>
                            <Input
                              id={`menor-edad-${idx}`}
                              type="number"
                              min="0"
                              max="17"
                              value={menor.edad}
                              onChange={e => updateMenor(idx, 'edad', e.target.value)}
                              placeholder="Ej: 8"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`menor-parentesco-${idx}`}>Parentesco *</Label>
                            <Select
                              value={menor.parentesco}
                              onValueChange={v => updateMenor(idx, 'parentesco', v)}
                            >
                              <SelectTrigger id={`menor-parentesco-${idx}`}>
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {PARENTESCO_OPTIONS.map(p => (
                                  <SelectItem key={p} value={p}>{p}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />
                </div>
              )}

              {/* Requerimientos */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#F59E0B]" />
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
                  disabled={!puedeConfirmarCheckIn || checkLoading}
                >
                  <KeyRound className="w-4 h-4 mr-1" />Confirmar Check-In
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* =================== MODAL CHECK-OUT =================== */}
      <Dialog key={`checkout-${dialogKey}`} open={modalTipo === 'checkout'} onOpenChange={closeModal}>
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
                      <span className="text-muted-foreground">Ocupación</span>
                      <p className="font-medium">
                        {selReserva.personas} adulto{s(selReserva.personas)}
                        {selReserva.ninos ? ` + ${selReserva.ninos} niño${selReserva.ninos > 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                    {/* Mostrar datos de menores si los hay */}
                    {selReserva.menores && selReserva.menores.length > 0 && (
                      <div className="sm:col-span-2">
                        <span className="text-muted-foreground">Menores registrados</span>
                        <div className="mt-1 space-y-1">
                          {selReserva.menores.map((m, i) => (
                            <p key={m.id || i} className="text-sm font-medium">
                              {m.nombre} — DNI: {m.documento} — {m.edad} años ({m.parentesco})
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
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
                      <span className="font-semibold text-[#166534]">{formatMoney(pagado)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Saldo</span>
                      <span className={saldo > 0 ? 'text-[#991B1B]' : 'text-[#166534]'}>
                        {formatMoney(saldo)}
                      </span>
                    </div>
                  </div>

                  {saldo > 0 && (
                    <div className="flex items-center gap-2 text-[#92400E] text-sm">
                      <CreditCard className="w-4 h-4" />
                      <span>El huésped tiene un saldo pendiente de {formatMoney(saldo)}.</span>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                  <Button variant="destructive" onClick={handleConfirmCheckOut} disabled={checkLoading}>
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
  const cantNinos = reserva.ninos || 0;

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
          <span className="font-bold text-base text-[#166534]">{formatMoney(pagado)}</span>
        </div>
        <div>
          <span className="text-muted-foreground text-xs block">Saldo</span>
          <span className={`font-bold text-base ${saldo > 0 ? 'text-[#991B1B]' : 'text-[#166534]'}`}>
            {formatMoney(saldo)}
          </span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {reserva.personas} adulto{s(reserva.personas)}
        {cantNinos > 0 ? <span className="text-[#5B21B6] font-medium"> + {cantNinos} niño{s(cantNinos)}</span> : null}
        {' · '}{noches} noche{s(noches)} · {reserva.tipoTarifa || 'Normal'}
      </div>
    </div>
  );
}

function s(n: number) {
  return n !== 1 ? 's' : '';
}

'use client';

// Pestaña "Tarifas" del módulo Tarifas.
//
// - La lista es una tabla (antes eran tarjetas muy cargadas), con filtros
//   Vigentes / Programadas / Vencidas / Desactivadas / Todas. Las vencidas no
//   se borran: hay reservas hechas con ellas.
// - La ventana de crear o editar tiene alto fijo y no hace scroll: un menú a
//   la izquierda con 3 secciones (Datos y vigencia, Precios por noche,
//   Promociones) y un resumen chico con dos ejemplos de precio.
// - Cada promoción tiene sus propios datos a pedir; los de "toda reserva"
//   están en Datos y vigencia (ver camposAPedir en src/lib/tarifa-calc.ts).
// - Las fechas siguen la regla de src/lib/tarifa-vigencia.ts.
// Sin íconos ni emojis (pedido del dueño).

import { useEffect, useMemo, useState } from 'react';
import { useHotelStore, type DatosTarifaCompleta } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatMoney, fechaArgentina } from '@/lib/format';
import { describeNochesCortesia } from '@/lib/tarifas-format';
import { calcularTotalSegunTarifa, getPromocionesEfectivas } from '@/lib/tarifa-calc';
import {
  estadoVigencia, describirVigencia, errorDeVigencia, fechaCorta, sumarDias, type EstadoVigencia,
} from '@/lib/tarifa-vigencia';
import { leerTarifasPublicas } from '@/lib/tarifas-publicas';
import type {
  CampoPersonalizado, ModoCobro, RangoPrecio, PromocionesTarifa, TarifaPrecios, ModalidadNochesCortesia,
} from '@/lib/types';

// ==================== TEXTOS Y AYUDAS ====================

const MODOS: { value: ModoCobro; label: string; ayuda: string }[] = [
  { value: 'porGrupo', label: 'Por grupo', ayuda: 'Un precio por noche para todo el grupo, según cuántas personas son.' },
  { value: 'porHabitacion', label: 'Por habitación', ayuda: 'Un precio fijo por habitación y por noche, sin importar cuántas personas duermen.' },
  { value: 'porCama', label: 'Por cama', ayuda: 'Cada persona paga un precio fijo por noche. Ideal para habitaciones compartidas.' },
];
const modoLabel = (m: ModoCobro) => MODOS.find(o => o.value === m)?.label || m;

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const RANGOS_INICIALES: RangoPrecio[] = [
  { minPersonas: 1, maxPersonas: 1, precio: 0 },
  { minPersonas: 2, maxPersonas: 2, precio: 0 },
  { minPersonas: 3, maxPersonas: 3, precio: 0 },
  { minPersonas: 4, maxPersonas: null, precio: 0 },
];

const hoyArg = () => fechaArgentina(new Date());

function personasDeRango(r: RangoPrecio): string {
  if (r.maxPersonas === null) return `${r.minPersonas} o más`;
  if (r.minPersonas === r.maxPersonas) return `${r.minPersonas}`;
  return `${r.minPersonas} a ${r.maxPersonas}`;
}

/** Nombres de las promociones prendidas, para la lista y la comparación. */
function promosPrendidas(t: TarifaPrecios): string[] {
  const p = getPromocionesEfectivas(t);
  const out: string[] = [];
  if (p.ninosDiferenciado?.activo) out.push('Niños');
  if (p.nochesCortesia?.activo) out.push('Noches de cortesía');
  if (p.acompananteSinCargo?.activo) out.push(p.acompananteSinCargo.etiqueta || 'Acompañante sin cargo');
  return out;
}

/** "$ 38.000 a $ 79.000" o un solo precio. */
function textoPrecios(t: TarifaPrecios): { precio: string; detalle: string } {
  const precios = (t.rangos || []).map(r => r.precio).filter(p => p > 0);
  if (precios.length === 0) return { precio: 'Sin precio', detalle: '' };
  const min = Math.min(...precios), max = Math.max(...precios);
  const precio = min === max ? formatMoney(min) : `${formatMoney(min)} a ${formatMoney(max)}`;
  if (t.modoCobro === 'porHabitacion') return { precio, detalle: 'por habitación' };
  if (t.modoCobro === 'porCama') return { precio, detalle: 'por persona' };
  const rangos = t.rangos || [];
  if (rangos.length === 1 && rangos[0].maxPersonas === null) return { precio, detalle: 'cualquier cantidad de personas' };
  const ultimo = rangos[rangos.length - 1];
  const desde = rangos[0]?.minPersonas ?? 1;
  const hasta = ultimo?.maxPersonas === null ? `${ultimo.minPersonas} o más` : `${ultimo?.maxPersonas ?? desde}`;
  return { precio, detalle: `${desde} a ${hasta} personas` };
}

// ==================== FORMULARIO ====================

interface FormTarifa {
  nombre: string;
  activa: boolean;
  vigenciaDesde: string; // '' = sin límite
  vigenciaHasta: string;
  modoCobro: ModoCobro;
  rangos: RangoPrecio[];
  camposPersonalizados: CampoPersonalizado[];
  promociones: PromocionesTarifa;
  mostrarEnWeb: boolean;
  promoDescripcion: string;
}

function formNuevo(): FormTarifa {
  return {
    nombre: '', activa: true, vigenciaDesde: '', vigenciaHasta: '',
    modoCobro: 'porGrupo', rangos: RANGOS_INICIALES.map(r => ({ ...r })),
    camposPersonalizados: [], promociones: {}, mostrarEnWeb: false, promoDescripcion: '',
  };
}

function formDeTarifa(nombre: string, t: TarifaPrecios): FormTarifa {
  // getPromocionesEfectivas pasa el "chofer de cortesía" viejo al formato nuevo.
  const promos: PromocionesTarifa = JSON.parse(JSON.stringify(getPromocionesEfectivas(t)));
  if (promos.acompananteSinCargo && promos.acompananteSinCargo.cantidad == null) promos.acompananteSinCargo.cantidad = 1;
  return {
    nombre,
    activa: t.activa !== false,
    vigenciaDesde: t.vigenciaDesde || '',
    vigenciaHasta: t.vigenciaHasta || '',
    modoCobro: t.modoCobro || 'porGrupo',
    rangos: t.rangos?.length ? t.rangos.map(r => ({ ...r })) : RANGOS_INICIALES.map(r => ({ ...r })),
    camposPersonalizados: (t.camposPersonalizados || []).map(c => ({ ...c })),
    promociones: promos,
    mostrarEnWeb: !!t.mostrarEnWeb,
    promoDescripcion: t.promoDescripcion || '',
  };
}

/** Lo que se manda a guardar. Limpia lo que no corresponde (datos de promociones apagadas quedan guardados igual: si se vuelve a prender, vuelven). */
function aDatos(f: FormTarifa): DatosTarifaCompleta {
  const limpiar = (cs: CampoPersonalizado[] | undefined) => (cs || []).map(c => ({ ...c, nombre: c.nombre.trim() }));
  const p = f.promociones;
  const promociones: PromocionesTarifa = {};
  if (p.ninosDiferenciado) promociones.ninosDiferenciado = { ...p.ninosDiferenciado, camposPersonalizados: limpiar(p.ninosDiferenciado.camposPersonalizados) };
  if (p.nochesCortesia) promociones.nochesCortesia = { ...p.nochesCortesia, camposPersonalizados: limpiar(p.nochesCortesia.camposPersonalizados) };
  if (p.acompananteSinCargo) {
    promociones.acompananteSinCargo = {
      ...p.acompananteSinCargo,
      etiqueta: p.acompananteSinCargo.etiqueta.trim() || 'Acompañante sin cargo',
      camposPersonalizados: limpiar(p.acompananteSinCargo.camposPersonalizados),
    };
  }
  return {
    nombre: f.nombre.trim(),
    modoCobro: f.modoCobro,
    rangos: f.rangos,
    camposPersonalizados: limpiar(f.camposPersonalizados),
    promociones,
    vigenciaDesde: f.vigenciaDesde || null,
    vigenciaHasta: f.vigenciaHasta || null,
    activa: f.activa,
    mostrarEnWeb: f.mostrarEnWeb,
    promoDescripcion: f.promoDescripcion.trim() || null,
  };
}

type Seccion = 'datos' | 'precios' | 'promos';
const SECCIONES: Seccion[] = ['datos', 'precios', 'promos'];

function erroresDe(f: FormTarifa, otrosNombres: string[], numerosHabitacion: string[]): Record<Seccion, string | null> {
  // Datos y vigencia
  let datos: string | null = null;
  const nombre = f.nombre.trim();
  if (!nombre) datos = 'Falta el nombre';
  else if (otrosNombres.some(n => n.toLowerCase() === nombre.toLowerCase())) datos = 'Ya existe una tarifa con ese nombre';
  else datos = errorDeVigencia(f.vigenciaDesde || null, f.vigenciaHasta || null);

  // Precios
  let precios: string | null = null;
  if (f.rangos.length === 0) precios = 'Agregá al menos un precio';
  else if (f.rangos.some(r => !(r.precio > 0))) precios = 'Completá todos los precios';
  else if (f.modoCobro === 'porGrupo') {
    for (let i = 0; i < f.rangos.length; i++) {
      const r = f.rangos[i];
      if (!(r.minPersonas >= 1) || (r.maxPersonas !== null && r.maxPersonas < r.minPersonas)) { precios = `Revisá las personas de la fila ${i + 1}`; break; }
      const sig = f.rangos[i + 1];
      if (sig && (r.maxPersonas === null || sig.minPersonas <= r.maxPersonas)) { precios = `Las filas ${i + 1} y ${i + 2} se pisan`; break; }
    }
  }

  // Promociones y datos a pedir
  let promos: string | null = null;
  const p = f.promociones;
  const nc = p.nochesCortesia;
  if (nc?.activo) {
    const m = nc.modalidad;
    if (m.tipo === 'cadaX' && !(m.cada >= 2)) promos = 'Noches de cortesía: "cada cuántas noches" tiene que ser 2 o más';
    if (m.tipo === 'aPartirDe' && !(m.minNoches >= 2 && m.nochesGratis >= 1 && m.nochesGratis < m.minNoches)) promos = 'Noches de cortesía: las noches gratis tienen que ser menos que las noches mínimas';
  }
  if (!promos && p.ninosDiferenciado?.activo && !(p.ninosDiferenciado.precioNino >= 0)) promos = 'Precio para niños: revisá el precio';
  const acom = p.acompananteSinCargo;
  if (!promos && acom?.activo && acom.habitacionAsignada && !numerosHabitacion.includes(acom.habitacionAsignada)) {
    promos = `Acompañante: la habitación ${acom.habitacionAsignada} ya no existe`;
  }
  // Los datos se guardan por nombre en la reserva: no puede haber dos iguales.
  const listas: { donde: Seccion; campos: CampoPersonalizado[] }[] = [
    { donde: 'datos', campos: f.camposPersonalizados },
    { donde: 'promos', campos: p.ninosDiferenciado?.camposPersonalizados || [] },
    { donde: 'promos', campos: p.nochesCortesia?.camposPersonalizados || [] },
    { donde: 'promos', campos: acom?.camposPersonalizados || [] },
  ];
  const vistos = new Set<string>();
  for (const l of listas) {
    for (const c of l.campos) {
      const n = c.nombre.trim().toLowerCase();
      const error = !n ? 'Hay un dato a pedir sin nombre' : vistos.has(n) ? `El dato "${c.nombre.trim()}" está repetido` : null;
      if (error) {
        if (l.donde === 'datos' && !datos) datos = error;
        if (l.donde === 'promos' && !promos) promos = error;
      }
      vistos.add(n);
    }
  }
  return { datos, precios, promos };
}

// ==================== PIEZAS DEL FORMULARIO ====================

function Campo({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label className="text-[11.5px] text-muted-foreground font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function NumeroInput({ value, onChange, className, placeholder, min = 0 }: {
  value: number | null | undefined; onChange: (v: number | null) => void; className?: string; placeholder?: string; min?: number;
}) {
  return (
    <Input
      type="number" min={min} inputMode="numeric"
      className={cn('h-8 text-right tabular-nums', className)}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}

/** Lista editable de datos a pedir (nombre, tipo, obligatorio). */
function EditorDatos({ titulo, vacio, campos, onChange }: {
  titulo: string; vacio: string; campos: CampoPersonalizado[]; onChange: (c: CampoPersonalizado[]) => void;
}) {
  const cambiar = (i: number, c: CampoPersonalizado) => onChange(campos.map((x, j) => (j === i ? c : x)));
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2.5 space-y-1.5">
      <p className="text-[12.5px] font-semibold">{titulo}</p>
      {campos.length === 0 && <p className="text-xs text-muted-foreground">{vacio}</p>}
      {campos.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="h-8 w-44" placeholder="Ej.: Patente del auto" value={c.nombre} onChange={e => cambiar(i, { ...c, nombre: e.target.value })} />
          <Select value={c.tipo} onValueChange={v => cambiar(i, { ...c, tipo: v as CampoPersonalizado['tipo'] })}>
            <SelectTrigger className="h-8 w-28" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="texto">Texto</SelectItem>
              <SelectItem value="numero">Número</SelectItem>
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
            <Switch checked={c.requerido} onCheckedChange={v => cambiar(i, { ...c, requerido: v })} />
            Obligatorio
          </label>
          <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-destructive px-1" onClick={() => onChange(campos.filter((_, j) => j !== i))}>
            Quitar
          </button>
        </div>
      ))}
      <button type="button" className="text-[12.5px] font-semibold text-primary hover:underline" onClick={() => onChange([...campos, { nombre: '', tipo: 'texto', requerido: true }])}>
        Agregar dato
      </button>
    </div>
  );
}

/** Fila desplegable de una promoción (cabecera con llave y resumen). */
function FilaPromo({ titulo, resumen, prendida, onPrender, abierta, onAbrir, children }: {
  titulo: string; resumen: string; prendida?: boolean; onPrender?: (v: boolean) => void;
  abierta: boolean; onAbrir: () => void; children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-lg border', abierta && 'border-[#0F766E55]')}>
      <div className="flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none" onClick={onAbrir}>
        {onPrender ? (
          <span onClick={e => e.stopPropagation()} className="flex">
            <Switch checked={!!prendida} onCheckedChange={v => { onPrender(v); if (v && !abierta) onAbrir(); }} aria-label={`Prender ${titulo}`} />
          </span>
        ) : <span className="w-8" />}
        <span className="text-[13px] font-semibold">{titulo}</span>
        <span className="ml-auto text-xs text-muted-foreground truncate">{resumen}</span>
      </div>
      {abierta && <div className="px-3 pb-3 pt-0.5 space-y-2.5">{children}</div>}
    </div>
  );
}

// ==================== VENTANA DE CREAR O EDITAR ====================

function VentanaTarifa({ abierta, onCerrar, original, inicial }: {
  abierta: boolean;
  onCerrar: () => void;
  /** Nombre de la tarifa que se edita, o null si es nueva. */
  original: string | null;
  inicial: FormTarifa;
}) {
  const tiposTarifa = useHotelStore(s => s.tiposTarifa);
  const habitaciones = useHotelStore(s => s.habitaciones);
  const guardarTarifaCompleta = useHotelStore(s => s.guardarTarifaCompleta);

  const [form, setForm] = useState<FormTarifa>(inicial);
  const [seccion, setSeccion] = useState<Seccion>('datos');
  const [promoAbierta, setPromoAbierta] = useState<'ninos' | 'noches' | 'acomp' | 'web' | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [intentoGuardar, setIntentoGuardar] = useState(false);

  const numeros = useMemo(() => Object.keys(habitaciones).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })), [habitaciones]);
  const otrosNombres = tiposTarifa.filter(t => t !== original);
  const errores = erroresDe(form, otrosNombres, numeros);
  const esNueva = original === null;
  const p = form.promociones;
  const set = (patch: Partial<FormTarifa>) => setForm(prev => ({ ...prev, ...patch }));
  const setPromo = (patch: Partial<PromocionesTarifa>) => setForm(prev => ({ ...prev, promociones: { ...prev.promociones, ...patch } }));

  // Resumen: dos ejemplos de precio con lo que está cargado ahora.
  const hoy = hoyArg();
  const ejemplos = useMemo(() => {
    const t: Record<string, TarifaPrecios> = { x: { modoCobro: form.modoCobro, rangos: form.rangos, promociones: form.promociones } };
    const casos = form.modoCobro === 'porHabitacion'
      ? [{ etiqueta: '3 noches', personas: 2, noches: 3 }, { etiqueta: '7 noches', personas: 2, noches: 7 }]
      : [{ etiqueta: '2 pers., 3 noches', personas: 2, noches: 3 }, { etiqueta: '4 pers., 7 noches', personas: 4, noches: 7 }];
    return casos.map(c => ({ ...c, total: calcularTotalSegunTarifa(t, 'x', c.personas, c.noches, { checkin: hoy }) }));
  }, [form.modoCobro, form.rangos, form.promociones, hoy]);

  const prendidas = [p.ninosDiferenciado?.activo, p.nochesCortesia?.activo, p.acompananteSinCargo?.activo].filter(Boolean).length;
  const sub: Record<Seccion, string> = {
    datos: errores.datos || (form.activa ? describirVigencia({ vigenciaDesde: form.vigenciaDesde || null, vigenciaHasta: form.vigenciaHasta || null }) : 'Desactivada'),
    precios: errores.precios || (form.modoCobro === 'porGrupo' ? `Por grupo, ${form.rangos.length} precio${form.rangos.length !== 1 ? 's' : ''}` : modoLabel(form.modoCobro)),
    promos: errores.promos || `${prendidas} de 3 prendidas`,
  };
  const titulos: Record<Seccion, string> = { datos: 'Datos y vigencia', precios: 'Precios por noche', promos: 'Promociones' };

  const guardar = async () => {
    setIntentoGuardar(true);
    const conError = SECCIONES.find(s => errores[s]);
    if (conError) {
      setSeccion(conError);
      toast.warning(errores[conError]!);
      return;
    }
    setGuardando(true);
    const error = await guardarTarifaCompleta(original ?? 'nueva', aDatos(form));
    setGuardando(false);
    if (error) { toast.error(error); return; }
    toast.success(esNueva ? `Tarifa "${form.nombre.trim()}" creada.` : 'Cambios guardados.');
    onCerrar();
  };

  const idx = SECCIONES.indexOf(seccion);

  // ---- secciones ----
  const rangos = form.rangos;
  const cambiarRango = (i: number, r: RangoPrecio) => set({ rangos: rangos.map((x, j) => (j === i ? r : x)) });
  const agregarRango = () => {
    const ult = rangos[rangos.length - 1];
    const nuevos = rangos.map(r => ({ ...r }));
    let min = 1;
    if (ult) {
      if (ult.maxPersonas === null) nuevos[nuevos.length - 1].maxPersonas = ult.minPersonas;
      min = (nuevos[nuevos.length - 1].maxPersonas ?? ult.minPersonas) + 1;
    }
    set({ rangos: [...nuevos, { minPersonas: min, maxPersonas: null, precio: 0 }] });
  };
  const cambiarModo = (m: ModoCobro) => {
    if (m === form.modoCobro) return;
    if (m === 'porGrupo') {
      const base = rangos[0]?.precio || 0;
      set({ modoCobro: m, rangos: RANGOS_INICIALES.map((r, i) => ({ ...r, precio: i === 0 ? base : 0 })) });
    } else {
      // Habitación o cama: un solo precio.
      set({ modoCobro: m, rangos: [{ minPersonas: 1, maxPersonas: null, precio: rangos[0]?.precio || 0 }] });
    }
  };

  const ninos = p.ninosDiferenciado;
  const noches = p.nochesCortesia;
  const acom = p.acompananteSinCargo;
  const modalidad = noches?.modalidad;

  const seccionDatos = (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <Campo label="Nombre">
          <Input className="h-8 w-72" value={form.nombre} onChange={e => set({ nombre: e.target.value })} placeholder="Ej.: Temporada alta" autoFocus={esNueva} />
        </Campo>
        <Campo label="Estado">
          <label className="flex items-center gap-2 h-8 text-[13px]">
            <Switch checked={form.activa} onCheckedChange={v => set({ activa: v })} />
            {form.activa ? 'Activa' : 'Desactivada'}
          </label>
        </Campo>
      </div>
      <div className="border-t pt-3">
        <p className="text-[13.5px] font-bold">Vigencia</p>
        <p className="text-xs text-muted-foreground leading-snug">
          Vacío = sin límite. Se usa en las estadías cuyo día de salida cae dentro de estas fechas, y cobra la estadía entera.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Campo label="Vale desde">
          <Input type="date" className="h-8 w-40" value={form.vigenciaDesde} onChange={e => set({ vigenciaDesde: e.target.value })} />
        </Campo>
        <Campo label="Hasta (incluye la salida)">
          <Input type="date" className="h-8 w-40" value={form.vigenciaHasta} onChange={e => set({ vigenciaHasta: e.target.value })} />
        </Campo>
      </div>
      <EditorDatos
        titulo="Datos a pedir en toda reserva"
        vacio="No pide datos extra. Ejemplo: la patente del auto."
        campos={form.camposPersonalizados}
        onChange={c => set({ camposPersonalizados: c })}
      />
    </div>
  );

  const seccionPrecios = (
    <div className="space-y-3">
      <Campo label="Cómo se cobra">
        <div className="inline-flex self-start rounded-lg border overflow-hidden">
          {MODOS.map(m => (
            <button
              key={m.value} type="button" onClick={() => cambiarModo(m.value)}
              className={cn('px-3 py-1.5 text-[12.5px] font-semibold border-r last:border-r-0', form.modoCobro === m.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}
            >
              {m.label}
            </button>
          ))}
        </div>
      </Campo>
      <p className="text-xs text-muted-foreground -mt-1.5">{MODOS.find(m => m.value === form.modoCobro)?.ayuda}</p>
      {form.modoCobro === 'porGrupo' ? (
        <div>
          <table className="text-[13px]">
            <thead>
              <tr className="text-left text-[11.5px] text-muted-foreground">
                <th className="font-semibold px-1 pb-1">Personas desde</th>
                <th className="font-semibold px-1 pb-1">Hasta</th>
                <th className="font-semibold px-1 pb-1">Precio por noche</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rangos.map((r, i) => (
                <tr key={i}>
                  <td className="px-1 py-0.5"><NumeroInput className="w-20" min={1} value={r.minPersonas} onChange={v => cambiarRango(i, { ...r, minPersonas: v ?? 0 })} /></td>
                  <td className="px-1 py-0.5"><NumeroInput className="w-20" min={1} value={r.maxPersonas} placeholder="o más" onChange={v => cambiarRango(i, { ...r, maxPersonas: v })} /></td>
                  <td className="px-1 py-0.5"><NumeroInput className="w-36" value={r.precio || null} placeholder="$" onChange={v => cambiarRango(i, { ...r, precio: v ?? 0 })} /></td>
                  <td className="px-1">
                    {rangos.length > 1 && (
                      <button type="button" className="text-xs text-muted-foreground hover:text-destructive" onClick={() => set({ rangos: rangos.filter((_, j) => j !== i) })}>Quitar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="mt-1.5 text-[12.5px] font-semibold text-primary hover:underline" onClick={agregarRango}>Agregar rango</button>
          <p className="text-xs text-muted-foreground mt-1">Dejá "Hasta" vacío en la última fila para "o más".</p>
        </div>
      ) : (
        <Campo label={form.modoCobro === 'porHabitacion' ? 'Precio por habitación y por noche' : 'Precio por persona y por noche'}>
          <NumeroInput className="w-36" value={rangos[0]?.precio || null} placeholder="$" onChange={v => set({ rangos: [{ minPersonas: 1, maxPersonas: null, precio: v ?? 0 }] })} />
        </Campo>
      )}
    </div>
  );

  const resumenNinos = ninos?.activo ? `${formatMoney(ninos.precioNino || 0)}${ninos.edadMaxima ? ` hasta ${ninos.edadMaxima} años` : ''}` : 'Apagada';
  const resumenNoches = noches?.activo && modalidad ? describeNochesCortesia(modalidad) : 'Apagada';
  const resumenAcom = acom?.activo ? `${acom.cantidad || 1} ${(acom.etiqueta || 'acompañante').toLowerCase()}` : 'Apagada';
  const abrir = (k: 'ninos' | 'noches' | 'acomp' | 'web') => setPromoAbierta(prev => (prev === k ? null : k));

  const seccionPromos = (
    <div className="space-y-2">
      <FilaPromo
        titulo="Precio para niños" resumen={resumenNinos} abierta={promoAbierta === 'ninos'} onAbrir={() => abrir('ninos')}
        prendida={ninos?.activo} onPrender={v => setPromo({ ninosDiferenciado: { precioNino: 0, ...ninos, activo: v } })}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Campo label="Precio por niño y por noche">
            <NumeroInput className="w-36" value={ninos?.precioNino ?? null} placeholder="$" onChange={v => setPromo({ ninosDiferenciado: { activo: true, ...ninos, precioNino: v ?? 0 } })} />
          </Campo>
          <Campo label="Edad máxima">
            <NumeroInput className="w-20" min={1} value={ninos?.edadMaxima ?? null} onChange={v => setPromo({ ninosDiferenciado: { activo: true, precioNino: 0, ...ninos, edadMaxima: v ?? undefined } })} />
          </Campo>
        </div>
        <EditorDatos titulo="Datos a pedir" vacio="Se piden solo si la reserva trae niños." campos={ninos?.camposPersonalizados || []}
          onChange={c => setPromo({ ninosDiferenciado: { activo: true, precioNino: 0, ...ninos, camposPersonalizados: c } })} />
      </FilaPromo>

      <FilaPromo
        titulo="Noches de cortesía" resumen={resumenNoches} abierta={promoAbierta === 'noches'} onAbrir={() => abrir('noches')}
        prendida={noches?.activo} onPrender={v => setPromo({ nochesCortesia: { modalidad: { tipo: 'cadaX', cada: 3 }, ...noches, activo: v } })}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Campo label="Cómo se regala">
            <Select
              value={modalidad?.tipo || 'cadaX'}
              onValueChange={v => {
                const m: ModalidadNochesCortesia = v === 'cadaX' ? { tipo: 'cadaX', cada: 3 } : v === 'aPartirDe' ? { tipo: 'aPartirDe', minNoches: 5, nochesGratis: 1 } : { tipo: 'diaSemana', dia: 3 };
                setPromo({ nochesCortesia: { activo: true, ...noches, modalidad: m } });
              }}
            >
              <SelectTrigger className="h-8 w-56" size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cadaX">Cada X noches, 1 gratis</SelectItem>
                <SelectItem value="aPartirDe">Desde X noches, Y gratis</SelectItem>
                <SelectItem value="diaSemana">Un día de la semana gratis</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          {modalidad?.tipo === 'cadaX' && (
            <Campo label="Cada cuántas noches">
              <NumeroInput className="w-20" min={2} value={modalidad.cada} onChange={v => setPromo({ nochesCortesia: { activo: true, ...noches, modalidad: { tipo: 'cadaX', cada: v ?? 0 } } })} />
            </Campo>
          )}
          {modalidad?.tipo === 'aPartirDe' && (
            <>
              <Campo label="Desde (noches)">
                <NumeroInput className="w-20" min={2} value={modalidad.minNoches} onChange={v => setPromo({ nochesCortesia: { activo: true, ...noches, modalidad: { ...modalidad, minNoches: v ?? 0 } } })} />
              </Campo>
              <Campo label="Noches gratis">
                <NumeroInput className="w-20" min={1} value={modalidad.nochesGratis} onChange={v => setPromo({ nochesCortesia: { activo: true, ...noches, modalidad: { ...modalidad, nochesGratis: v ?? 0 } } })} />
              </Campo>
            </>
          )}
          {modalidad?.tipo === 'diaSemana' && (
            <Campo label="Día gratis">
              <Select value={String(modalidad.dia)} onValueChange={v => setPromo({ nochesCortesia: { activo: true, ...noches, modalidad: { tipo: 'diaSemana', dia: Number(v) } } })}>
                <SelectTrigger className="h-8 w-36" size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>{DIAS_SEMANA.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Campo>
          )}
        </div>
        <EditorDatos titulo="Datos a pedir" vacio="Se piden solo si la estadía tiene alguna noche gratis." campos={noches?.camposPersonalizados || []}
          onChange={c => setPromo({ nochesCortesia: { activo: true, modalidad: { tipo: 'cadaX', cada: 3 }, ...noches, camposPersonalizados: c } })} />
      </FilaPromo>

      <FilaPromo
        titulo="Acompañante sin cargo" resumen={resumenAcom} abierta={promoAbierta === 'acomp'} onAbrir={() => abrir('acomp')}
        prendida={acom?.activo} onPrender={v => setPromo({ acompananteSinCargo: { etiqueta: 'Chofer de cortesía', cantidad: 1, ...acom, activo: v } })}
      >
        <div className="flex flex-wrap items-end gap-3">
          <Campo label="Nombre del beneficio">
            <Input className="h-8 w-48" value={acom?.etiqueta ?? ''} placeholder="Ej.: Chofer de cortesía" onChange={e => setPromo({ acompananteSinCargo: { activo: true, cantidad: 1, ...acom, etiqueta: e.target.value } })} />
          </Campo>
          <Campo label="Cantidad">
            <NumeroInput className="w-16" min={1} value={acom?.cantidad ?? 1} onChange={v => setPromo({ acompananteSinCargo: { activo: true, etiqueta: '', ...acom, cantidad: Math.max(1, v ?? 1) } })} />
          </Campo>
          <Campo label="Para grupos de (opcional)">
            <NumeroInput className="w-20" min={1} value={acom?.personasHospedan ?? null} onChange={v => setPromo({ acompananteSinCargo: { activo: true, etiqueta: '', cantidad: 1, ...acom, personasHospedan: v ?? undefined } })} />
          </Campo>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px]">
            <Switch
              checked={!!acom?.habitacionAsignada}
              onCheckedChange={v => setPromo({ acompananteSinCargo: { activo: true, etiqueta: '', cantidad: 1, ...acom, habitacionAsignada: v ? (acom?.habitacionAsignada || numeros[0] || undefined) : undefined } })}
            />
            Habitación gratis asignada
          </label>
          {acom?.habitacionAsignada && (
            <Select value={acom.habitacionAsignada} onValueChange={v => setPromo({ acompananteSinCargo: { ...acom, habitacionAsignada: v } })}>
              <SelectTrigger className="h-8 w-36" size="sm"><SelectValue /></SelectTrigger>
              <SelectContent>{numeros.map(n => <SelectItem key={n} value={n}>Hab. {n}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        <EditorDatos titulo="Datos a pedir" vacio="Se piden en toda reserva con esta tarifa, porque siempre lleva el acompañante." campos={acom?.camposPersonalizados || []}
          onChange={c => setPromo({ acompananteSinCargo: { activo: true, etiqueta: '', cantidad: 1, ...acom, camposPersonalizados: c } })} />
      </FilaPromo>

    </div>
  );

  return (
    <Dialog open={abierta} onOpenChange={v => { if (!v && !guardando) onCerrar(); }}>
      <DialogContent size="medio" scrollBody={false} className="p-0 gap-0 flex flex-col h-[min(560px,92vh)]">
        <DialogHeader className="px-5 py-3.5 border-b">
          <DialogTitle className="text-base">{esNueva ? 'Nueva tarifa' : `Editar tarifa: ${original}`}</DialogTitle>
          <DialogDescription className="sr-only">Datos, precios y promociones de la tarifa</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col sm:grid sm:grid-cols-[212px_1fr]">
          <nav className="bg-muted/40 border-b sm:border-b-0 sm:border-r p-2 flex sm:flex-col gap-0.5 overflow-x-auto shrink-0">
            {SECCIONES.map(s => {
              const conError = intentoGuardar && !!errores[s];
              return (
                <button
                  key={s} type="button" onClick={() => setSeccion(s)}
                  className={cn('text-left rounded-md px-2.5 py-2 flex flex-col gap-0.5 shrink-0', seccion === s ? 'bg-background shadow-sm' : 'hover:bg-background/60')}
                >
                  <span className={cn('text-[13px] font-semibold', seccion === s && 'text-primary', conError && 'text-destructive')}>{titulos[s]}</span>
                  <span className={cn('text-[11.5px]', conError ? 'text-destructive' : 'text-muted-foreground')}>{sub[s]}</span>
                </button>
              );
            })}
            <div className="hidden sm:block mt-auto rounded-lg border border-[#0F766E33] bg-[#0F766E0F] px-2.5 py-2 text-[11.5px]">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-primary mb-1">Resumen</p>
              {ejemplos.map(e => (
                <div key={e.etiqueta} className="flex justify-between gap-2">
                  <span className="text-muted-foreground whitespace-nowrap">{e.etiqueta}</span>
                  <b className="whitespace-nowrap tabular-nums">{e.total > 0 ? formatMoney(e.total) : '—'}</b>
                </div>
              ))}
            </div>
          </nav>
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {seccion === 'datos' && seccionDatos}
            {seccion === 'precios' && seccionPrecios}
            {seccion === 'promos' && seccionPromos}
          </div>
        </div>
        <DialogFooter className="px-5 py-2.5 border-t flex-row sm:justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          {esNueva ? (
            <div className="flex gap-2">
              {idx > 0 && <Button variant="outline" size="sm" onClick={() => setSeccion(SECCIONES[idx - 1])}>Anterior</Button>}
              {idx < SECCIONES.length - 1
                ? <Button size="sm" onClick={() => setSeccion(SECCIONES[idx + 1])}>Siguiente</Button>
                : <Button size="sm" onClick={guardar} disabled={guardando}>{guardando ? 'Creando…' : 'Crear tarifa'}</Button>}
            </div>
          ) : (
            <Button size="sm" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== DUPLICAR ====================

function VentanaDuplicar({ original, onCerrar, onDuplicada }: {
  original: string | null;
  onCerrar: () => void;
  onDuplicada: (nombre: string) => void;
}) {
  const tarifas = useHotelStore(s => s.tarifas);
  const tiposTarifa = useHotelStore(s => s.tiposTarifa);
  const guardarTarifaCompleta = useHotelStore(s => s.guardarTarifaCompleta);
  const t = original ? tarifas[original] : undefined;

  // Si tenía fechas, se proponen las mismas un año después (la temporada siguiente).
  const masUnAnio = (s: string | null | undefined) => {
    if (!s) return '';
    const [a, m, d] = s.split('-');
    const prop = `${Number(a) + 1}-${m}-${d}`;
    return m === '02' && d === '29' ? sumarDias(`${Number(a) + 1}-03-01`, -1) : prop;
  };
  const [nombre, setNombre] = useState(original ? `${original} (copia)` : '');
  const [desde, setDesde] = useState(masUnAnio(t?.vigenciaDesde));
  const [hasta, setHasta] = useState(masUnAnio(t?.vigenciaHasta));
  const [guardando, setGuardando] = useState(false);

  if (!original || !t) return null;
  const promos = promosPrendidas(t);
  const cantDatos = (t.camposPersonalizados?.length || 0);

  const duplicar = async () => {
    const n = nombre.trim();
    if (!n) { toast.warning('Falta el nombre.'); return; }
    if (tiposTarifa.some(x => x.toLowerCase() === n.toLowerCase())) { toast.warning('Ya existe una tarifa con ese nombre.'); return; }
    const errorFechas = errorDeVigencia(desde || null, hasta || null);
    if (errorFechas) { toast.warning(errorFechas); return; }
    const datos = aDatos({ ...formDeTarifa(n, t), vigenciaDesde: desde, vigenciaHasta: hasta, activa: true, mostrarEnWeb: false });
    setGuardando(true);
    const error = await guardarTarifaCompleta('nueva', datos);
    setGuardando(false);
    if (error) { toast.error(error); return; }
    toast.success(`Tarifa "${n}" creada.`);
    onDuplicada(n);
  };

  return (
    <Dialog open onOpenChange={v => { if (!v && !guardando) onCerrar(); }}>
      <DialogContent size="chico">
        <DialogHeader>
          <DialogTitle>Duplicar tarifa: {original}</DialogTitle>
          <DialogDescription>Copia precios, promociones y datos a pedir. Elegí el nombre y las fechas de la copia.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Campo label="Nombre de la copia"><Input className="h-9" value={nombre} onChange={e => setNombre(e.target.value)} /></Campo>
          <div className="flex flex-wrap gap-3">
            <Campo label="Vale desde"><Input type="date" className="h-9 w-44" value={desde} onChange={e => setDesde(e.target.value)} /></Campo>
            <Campo label="Hasta (incluye la salida)"><Input type="date" className="h-9 w-44" value={hasta} onChange={e => setHasta(e.target.value)} /></Campo>
          </div>
          <p className="text-xs text-muted-foreground">
            Se copian {t.rangos.length} precio{t.rangos.length !== 1 ? 's' : ''}
            {promos.length > 0 ? `, ${promos.length} ${promos.length === 1 ? 'promoción' : 'promociones'}` : ''}
            {cantDatos > 0 ? ` y ${cantDatos} dato${cantDatos !== 1 ? 's' : ''} a pedir` : ''}. La copia no se muestra en la web hasta que la prendas.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
          <Button onClick={duplicar} disabled={guardando}>{guardando ? 'Duplicando…' : 'Duplicar y revisar precios'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== COMPARAR ====================

function VentanaComparar({ nombres, onCerrar }: { nombres: string[]; onCerrar: () => void }) {
  const tarifas = useHotelStore(s => s.tarifas);
  const lista = nombres.map(n => ({ n, t: tarifas[n] })).filter(x => !!x.t);
  const filas: { label: string; valor: (t: TarifaPrecios) => string }[] = [
    { label: 'Vigencia', valor: t => describirVigencia(t) },
    { label: 'Estado', valor: t => (t.activa === false ? 'Desactivada' : 'Activa') },
    { label: 'Cómo se cobra', valor: t => modoLabel(t.modoCobro || 'porGrupo') },
    { label: 'Precios', valor: t => (t.modoCobro === 'porGrupo' ? t.rangos.map(r => `${personasDeRango(r)}: ${formatMoney(r.precio)}`).join('\n') : formatMoney(t.rangos[0]?.precio || 0)) },
    { label: 'Niños', valor: t => { const x = getPromocionesEfectivas(t).ninosDiferenciado; return x?.activo ? `${formatMoney(x.precioNino || 0)} por noche` : '—'; } },
    { label: 'Noches de cortesía', valor: t => { const x = getPromocionesEfectivas(t).nochesCortesia; return x?.activo ? describeNochesCortesia(x.modalidad) : '—'; } },
    { label: 'Acompañante sin cargo', valor: t => { const x = getPromocionesEfectivas(t).acompananteSinCargo; return x?.activo ? `${x.cantidad || 1} ${x.etiqueta || ''}`.trim() : '—'; } },
    { label: 'Datos a pedir', valor: t => (t.camposPersonalizados || []).map(c => c.nombre).join(', ') || '—' },
  ];
  return (
    <Dialog open onOpenChange={v => { if (!v) onCerrar(); }}>
      <DialogContent size="grande">
        <DialogHeader>
          <DialogTitle>Comparar tarifas</DialogTitle>
          <DialogDescription>Las filas con diferencias están resaltadas.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44" />
                {lista.map(x => <TableHead key={x.n} className="font-bold text-foreground">{x.n}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(f => {
                const valores = lista.map(x => f.valor(x.t));
                const distinto = new Set(valores).size > 1;
                return (
                  <TableRow key={f.label} className={distinto ? 'bg-[#0F766E0D]' : ''}>
                    <TableCell className="text-xs text-muted-foreground font-semibold">{f.label}</TableCell>
                    {valores.map((v, i) => <TableCell key={i} className="text-[13px] whitespace-pre-line align-top">{v}</TableCell>)}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <DialogFooter><Button variant="outline" onClick={onCerrar}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================== CSV ====================

function exportarCSV(nombre: string, t: TarifaPrecios) {
  const promos = getPromocionesEfectivas(t);
  const filas: (string | number)[][] = [['Campo', 'Valor'], ['Nombre', nombre]];
  filas.push(['Vigencia', describirVigencia(t)]);
  filas.push(['Estado', t.activa === false ? 'Desactivada' : 'Activa']);
  filas.push(['Cómo se cobra', modoLabel(t.modoCobro || 'porGrupo')]);
  for (const r of t.rangos || []) filas.push([t.modoCobro === 'porGrupo' ? `Precio ${personasDeRango(r)} personas` : 'Precio por noche', r.precio]);
  if (promos.ninosDiferenciado?.activo) filas.push(['Precio para niños', promos.ninosDiferenciado.precioNino || 0]);
  if (promos.nochesCortesia?.activo) filas.push(['Noches de cortesía', describeNochesCortesia(promos.nochesCortesia.modalidad)]);
  if (promos.acompananteSinCargo?.activo) filas.push(['Acompañante sin cargo', `${promos.acompananteSinCargo.cantidad || 1} ${promos.acompananteSinCargo.etiqueta || ''}`.trim()]);
  for (const c of t.camposPersonalizados || []) filas.push(['Dato a pedir', `${c.nombre}${c.requerido ? ' (obligatorio)' : ''}`]);
  const csv = filas.map(f => f.map(c => { const s = String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `tarifa_${nombre.toLowerCase().replace(/\s+/g, '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==================== LISTA ====================

type Filtro = EstadoVigencia | 'desactivadas' | 'todas';

function etiquetaVigencia(t: TarifaPrecios, hoy: string): { texto: string; clase: string; detalle: string } {
  const estado = estadoVigencia(t, hoy);
  if (estado === 'vencida') return { texto: `Venció el ${fechaCorta(t.vigenciaHasta!)}`, clase: 'bg-muted text-muted-foreground', detalle: '' };
  if (estado === 'programada') return { texto: `Desde ${fechaCorta(t.vigenciaDesde!)}`, clase: 'bg-[#0284C714] text-info', detalle: t.vigenciaHasta ? `Hasta ${fechaCorta(t.vigenciaHasta)}` : 'Sin vencimiento' };
  if (t.vigenciaHasta) {
    const dias = Math.round((Date.parse(`${t.vigenciaHasta}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86400000);
    return {
      texto: `Hasta ${fechaCorta(t.vigenciaHasta)}`,
      clase: dias <= 30 ? 'bg-[#D977061A] text-warning' : 'bg-[#0596691A] text-success',
      detalle: dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`,
    };
  }
  return { texto: 'Sin vencimiento', clase: 'bg-[#0596691A] text-success', detalle: t.vigenciaDesde ? `Desde ${fechaCorta(t.vigenciaDesde)}` : '' };
}

export default function TarifasTab() {
  const tarifas = useHotelStore(s => s.tarifas);
  const tiposTarifa = useHotelStore(s => s.tiposTarifa);
  const reservas = useHotelStore(s => s.reservas);
  const tarifaIds = useHotelStore(s => s._tarifaIds);
  const guardarTarifaCompleta = useHotelStore(s => s.guardarTarifaCompleta);
  const eliminarTipoTarifa = useHotelStore(s => s.eliminarTipoTarifa);

  const [filtro, setFiltro] = useState<Filtro>('vigente');
  const [busqueda, setBusqueda] = useState('');
  const [comparar, setComparar] = useState<string[]>([]);
  const [verComparacion, setVerComparacion] = useState(false);
  const [ventana, setVentana] = useState<{ original: string | null; inicial: FormTarifa; clave: number } | null>(null);
  const [duplicando, setDuplicando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [enLaWeb, setEnLaWeb] = useState<Record<string, string[]> | null>(null);

  // En qué tipos de habitación cobra la web cada tarifa (Configuración →
  // Landing → Precios). Solo el dueño puede leer esa configuración: si no
  // se puede, la lista no muestra esa línea.
  useEffect(() => {
    let cancelado = false;
    fetch('/api/configuracion/hotel')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelado || !d) return;
        const mapa = leerTarifasPublicas(d.tarifasPublicas);
        const porId: Record<string, string[]> = {};
        for (const [tipo, ids] of Object.entries(mapa)) for (const id of ids) (porId[id] ||= []).push(tipo);
        setEnLaWeb(porId);
      })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);

  const hoy = hoyArg();
  const filas = tiposTarifa.map(n => ({ n, t: tarifas[n] })).filter(x => !!x.t);
  const categoria = (t: TarifaPrecios): Exclude<Filtro, 'todas'> => {
    const e = estadoVigencia(t, hoy);
    if (e === 'vencida') return 'vencida';
    return t.activa === false ? 'desactivadas' : e;
  };
  const cuenta = (f: Filtro) => (f === 'todas' ? filas.length : filas.filter(x => categoria(x.t) === f).length);
  const visibles = filas
    .filter(x => filtro === 'todas' || categoria(x.t) === filtro)
    .filter(x => !busqueda.trim() || x.n.toLowerCase().includes(busqueda.trim().toLowerCase()));

  const filtros: { f: Filtro; label: string }[] = [
    { f: 'vigente', label: 'Vigentes' },
    { f: 'programada', label: 'Programadas' },
    { f: 'vencida', label: 'Vencidas' },
    ...(cuenta('desactivadas') > 0 ? [{ f: 'desactivadas' as Filtro, label: 'Desactivadas' }] : []),
    { f: 'todas', label: 'Todas' },
  ];

  const abrirNueva = () => setVentana({ original: null, inicial: formNuevo(), clave: Date.now() });
  const abrirEditar = (n: string) => setVentana({ original: n, inicial: formDeTarifa(n, tarifas[n]), clave: Date.now() });

  const cambiarActiva = async (n: string) => {
    const t = tarifas[n];
    const error = await guardarTarifaCompleta(n, aDatos({ ...formDeTarifa(n, t), activa: t.activa === false }));
    if (error) toast.error(error);
    else toast.success(t.activa === false ? `"${n}" activada.` : `"${n}" desactivada: ya no se puede elegir en reservas nuevas.`);
  };

  const pedirBorrar = (n: string) => {
    const activas = reservas.filter(r => r.tipoTarifa === n && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado')).length;
    if (activas > 0) {
      toast.warning(`No se puede eliminar "${n}": hay ${activas} reserva${activas !== 1 ? 's' : ''} activa${activas !== 1 ? 's' : ''} con esta tarifa. Podés desactivarla.`);
      return;
    }
    setBorrando(n);
  };
  const borrar = async () => {
    const n = borrando!;
    const ok = await eliminarTipoTarifa(n);
    setBorrando(null);
    setComparar(prev => prev.filter(x => x !== n));
    if (ok) toast.success(`Tarifa "${n}" eliminada.`);
    else toast.error('No se pudo eliminar la tarifa. Verificá que no tenga reservas activas.');
  };

  const toggleComparar = (n: string) => setComparar(prev => {
    if (prev.includes(n)) return prev.filter(x => x !== n);
    if (prev.length >= 3) { toast.warning('Podés comparar hasta 3 tarifas a la vez.'); return prev; }
    return [...prev, n];
  });

  return (
    <div className="space-y-4">
      <Card className="py-0 gap-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b">
          {filtros.map(({ f, label }) => (
            <button
              key={f} type="button" onClick={() => setFiltro(f)}
              className={cn('rounded-full border px-3 py-1 text-[13px]', filtro === f ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted')}
            >
              {label} <span className="font-semibold opacity-80">{cuenta(f)}</span>
            </button>
          ))}
          <Input className="h-8 w-full sm:w-56 sm:ml-auto" placeholder="Buscar tarifa" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <Button variant="outline" size="sm" disabled={comparar.length < 2} onClick={() => setVerComparacion(true)}>
            Comparar{comparar.length > 0 ? ` (${comparar.length})` : ''}
          </Button>
          <Button size="sm" onClick={abrirNueva}>Nueva tarifa</Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-9" />
                <TableHead>Tarifa</TableHead>
                <TableHead>Cómo se cobra</TableHead>
                <TableHead className="text-right">Precio por noche</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Promociones</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                    {filas.length === 0 ? 'Todavía no hay tarifas. Creá la primera con "Nueva tarifa".'
                      : busqueda.trim() ? 'Ninguna tarifa coincide con la búsqueda.'
                      : `No hay tarifas ${filtros.find(x => x.f === filtro)?.label.toLowerCase()}.`}
                  </TableCell>
                </TableRow>
              ) : visibles.map(({ n, t }) => {
                const vig = etiquetaVigencia(t, hoy);
                const precios = textoPrecios(t);
                const promos = promosPrendidas(t);
                const tipos = enLaWeb ? enLaWeb[tarifaIds[n]] : undefined;
                return (
                  <TableRow key={n} className={cn('cursor-pointer', t.activa === false && 'text-muted-foreground')} onClick={() => abrirEditar(n)}>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Checkbox checked={comparar.includes(n)} onCheckedChange={() => toggleComparar(n)} aria-label={`Comparar ${n}`} />
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">{n}</div>
                      {enLaWeb && (
                        <div className="text-xs text-muted-foreground">{tipos?.length ? `En la web: ${tipos.join(', ')}` : 'Solo desde el panel'}</div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{modoLabel(t.modoCobro || 'porGrupo')}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-semibold whitespace-nowrap tabular-nums">{precios.precio}</div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{precios.detalle}</div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap', vig.clase)}>{vig.texto}</span>
                      {vig.detalle && <div className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">{vig.detalle}</div>}
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {promos.length > 0 ? promos.join(', ') : <span className="text-muted-foreground">Ninguna</span>}
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-xs font-semibold', t.activa === false ? 'bg-muted text-muted-foreground' : 'bg-[#0596691A] text-success')}>
                        {t.activa === false ? 'Desactivada' : 'Activa'}
                      </span>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()} className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 px-2 font-bold tracking-widest text-muted-foreground" aria-label={`Acciones de ${n}`}>···</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => abrirEditar(n)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setDuplicando(n)}>Duplicar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { exportarCSV(n, t); toast.success(`Tarifa "${n}" exportada.`); }}>Exportar CSV</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => cambiarActiva(n)}>{t.activa === false ? 'Activar' : 'Desactivar'}</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => pedirBorrar(n)}>Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
      {filtro === 'vencida' && visibles.length > 0 && (
        <p className="text-xs text-muted-foreground">Las vencidas no se borran: hay reservas hechas con ellas. Podés duplicarlas para la temporada siguiente.</p>
      )}

      {ventana && (
        <VentanaTarifa key={ventana.clave} abierta original={ventana.original} inicial={ventana.inicial} onCerrar={() => setVentana(null)} />
      )}
      {duplicando && (
        <VentanaDuplicar
          key={duplicando}
          original={duplicando}
          onCerrar={() => setDuplicando(null)}
          onDuplicada={n => {
            setDuplicando(null);
            // Abre la copia para revisar precios. Se lee del store recién
            // actualizado (la copia ya está guardada).
            const t = useHotelStore.getState().tarifas[n];
            if (t) setVentana({ original: n, inicial: formDeTarifa(n, t), clave: Date.now() });
          }}
        />
      )}
      {verComparacion && <VentanaComparar nombres={comparar} onCerrar={() => setVerComparacion(false)} />}
      <Dialog open={borrando !== null} onOpenChange={v => { if (!v) setBorrando(null); }}>
        <DialogContent size="chico">
          <DialogHeader>
            <DialogTitle>Eliminar tarifa</DialogTitle>
            <DialogDescription>¿Eliminar la tarifa &quot;{borrando}&quot;? No se puede deshacer. Si solo querés que no se use más, desactivala.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBorrando(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={borrar}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

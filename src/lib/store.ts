import { create } from 'zustand';
import type {
  Habitacion, Cliente, Reserva, Pago, Gasto,
  AuditoriaEntry, CajaState, TarifaPrecios, MetodoPago,
  HistorialMantenimientoEntry, UsuarioSesion, ModuloId,
  HabitacionDisponible, MovimientoCaja, CierreCaja, Estadia,
  EstadoReserva, EstadoHabitacion, TurnoCaja,
  ModoCobro, RangoPrecio, CampoPersonalizado,
  PromocionesTarifa,
} from './types';
import { type PlanTipo, type PlanInfo, modulosEfectivos as calcModulosEfectivos, PLANES } from './plan-config';
import { api } from './api-client';
import { useNotificationStore } from './notification-store';


// ==================== NOTIFICATION HELPER ====================

function pushNotif(type: 'success' | 'info' | 'warning', title: string, message: string) {
  try {
    useNotificationStore.getState().addNotification({ type, title, message });
  } catch { /* store may not be ready during SSR */ }
}

// ==================== LOCAL DATE HELPER ====================

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ==================== API ↔ STORE MAPPERS ====================

function mapDbReservaToStore(r: any, totalOverride?: number): Reserva {
  // Map API estado to store estado
  let estado: EstadoReserva = 'Confirmada';
  if (r.estado === 'CheckIn_realizado') estado = 'Check-In realizado';
  else if (r.estado === 'Checkout_realizado') estado = 'Check-Out realizado';
  else if (r.estado === 'Cancelada') estado = 'Cancelada';

  return {
    id: r.id,
    idCliente: r.clienteId || '',
    huesped: r.huesped, dni: r.dni,
    telefono: r.telefono || '', email: r.email || '',
    domicilio: r.domicilio || '', habitacion: r.habitacion,
    checkin: r.checkin?.split('T')[0] || r.checkin,
    checkout: r.checkout?.split('T')[0] || r.checkout,
    personas: r.personas, estadoPago: (r.estadoPago || 'Pendiente') as Reserva['estadoPago'],
    notas: r.notas || '', estado,
    tipoTarifa: r.tipoTarifa || undefined,
    metodoPagoId: r.metodoPagoId || undefined,
    cuotas: r.cuotas || undefined, recargoPorcentaje: r.recargoPorcentaje || undefined,
    total: totalOverride !== undefined ? totalOverride : (r.total != null ? r.total / 100 : undefined),
    ninos: r.ninos || undefined,
    agencia: (r.agenciaNombre ? { nombre: r.agenciaNombre, convenio: r.agenciaConvenio, vendedor: undefined } : undefined) as any,
    contactoEmergencia: (r.contactoEmergenciaNombre ? { nombre: r.contactoEmergenciaNombre, telefono: r.contactoEmergenciaTel || '' } : undefined) as any,
    observacionesHuesped: r.observacionesHuesped || undefined,
    llaveEntregada: (r as any).llaveEntregada || undefined,
    documentoVerificado: (r as any).documentoVerificado || undefined,
    firmaConformidad: (r as any).firmaConformidad || undefined,
    acompanantes: (r.acompanantes || []).map((a: any) => ({ nombre: a.nombre, dni: a.dni, celular: a.celular || '' })),
    menores: (r.menores || []).map((m: any) => ({ id: m.id, nombre: m.nombre, documento: m.documento, edad: m.edad, parentesco: m.parentesco })),
    horaCheckin: r.horaCheckin || undefined,
    horaCheckout: r.horaCheckout || undefined,
    datosAdicionales: (r.datosAdicionales as Record<string, string>) || undefined,
  };
}

function mapDbCajaToStore(dbCaja: any): CajaState {
  const turno = dbCaja.turnoActual;
  if (!turno) {
    // Build historial from past turns
    const historial: TurnoCaja[] = (dbCaja.historial || []).map((t: any) => ({
      apertura: { montoInicial: t.montoInicial / 100, empleado: t.empleadoNombre, fecha: t.fechaApertura },
      cierre: t.fechaCierre ? { empleado: t.empleadoNombre, fecha: t.fechaCierre, saldoEsperado: (t.saldoEsperado || 0) / 100, saldoContado: (t.saldoContado || 0) / 100, diferencia: (t.diferencia || 0) / 100, billetes: t.billetes || {}, totalOtrosMetodos: (t.totalOtrosMetodos || 0) / 100 } : null as any,
      movimientos: (t.movimientos || []).map((m: any) => ({ id: m.id, tipo: m.tipo as 'ingreso' | 'egreso', monto: m.monto / 100, descripcion: m.descripcion, metodo: m.metodo, empleado: m.empleadoNombre, fecha: m.fecha, gastoId: m.gastoId || null })),
    }));
    return { estado: 'cerrada', apertura: null, movimientos: [], historial };
  }

  const movimientos: MovimientoCaja[] = (turno.movimientos || []).map((m: any) => ({
    id: m.id, tipo: m.tipo as 'ingreso' | 'egreso', monto: m.monto / 100,
    descripcion: m.descripcion, metodo: m.metodo, empleado: m.empleadoNombre, fecha: m.fecha,
    gastoId: m.gastoId || null,
  }));

  return {
    estado: 'abierta',
    apertura: { montoInicial: turno.montoInicial / 100, empleado: turno.empleadoNombre, fecha: turno.fechaApertura },
    movimientos,
    historial: (dbCaja.historial || []).map((t: any) => ({
      apertura: { montoInicial: t.montoInicial / 100, empleado: t.empleadoNombre, fecha: t.fechaApertura },
      cierre: { empleado: t.empleadoNombre, fecha: t.fechaCierre || '', saldoEsperado: (t.saldoEsperado || 0) / 100, saldoContado: (t.saldoContado || 0) / 100, diferencia: (t.diferencia || 0) / 100, billetes: t.billetes || {}, totalOtrosMetodos: (t.totalOtrosMetodos || 0) / 100 },
      movimientos: (t.movimientos || []).map((m: any) => ({ id: m.id, tipo: m.tipo as 'ingreso' | 'egreso', monto: m.monto / 100, descripcion: m.descripcion, metodo: m.metodo, empleado: m.empleadoNombre, fecha: m.fecha, gastoId: m.gastoId || null })),
    })),
  };
}

// ==================== DEFAULT DATA ====================

const defaultHabitaciones: Record<string, Habitacion> = {};

const defaultReservas: Reserva[] = [];

const defaultClientes: Cliente[] = [];

const defaultPagos: Pago[] = [];

// Los usuarios se gestionan directamente via api.usuarios (UsuariosModule), no en el store

const defaultGastos: Gasto[] = [];

const defaultTarifas: Record<string, TarifaPrecios> = {
  compartida: { modoCobro: 'porGrupo', rangos: [{ minPersonas: 1, maxPersonas: 1, precio: 0 }, { minPersonas: 2, maxPersonas: 2, precio: 0 }, { minPersonas: 3, maxPersonas: 3, precio: 0 }, { minPersonas: 4, maxPersonas: 4, precio: 0 }], camposPersonalizados: [] },
};

const defaultMetodosPago: MetodoPago[] = [
  { id: 'efectivo', nombre: 'Efectivo', tipo: 'efectivo', recargo: false, cuotas: [] },
  { id: 'tarjeta', nombre: 'Tarjeta de Crédito', tipo: 'tarjeta', recargo: true, cuotas: [{ cantidad: 1, porcentaje: 0 }, { cantidad: 2, porcentaje: 3 }, { cantidad: 3, porcentaje: 5 }, { cantidad: 5, porcentaje: 10 }, { cantidad: 9, porcentaje: 15 }, { cantidad: 12, porcentaje: 20 }] },
  { id: 'transferencia', nombre: 'Transferencia', tipo: 'transferencia', recargo: false, cuotas: [] },
  { id: 'mercadopago', nombre: 'Mercado Pago', tipo: 'otro', recargo: false, cuotas: [] },
  { id: 'pix', nombre: 'Pix', tipo: 'otro', recargo: false, cuotas: [] },
  { id: 'paypal', nombre: 'PayPal', tipo: 'otro', recargo: false, cuotas: [] },
];

const defaultCategoriasGastos: string[] = ['Sueldos', 'Servicios', 'Mantenimiento', 'Desayuno', 'Productos de Limpieza', 'Otros'];

// ==================== HELPER ====================

function generarId(): string {
  return crypto.randomUUID();
}

function nochesEntre(checkin: string, checkout: string): number {
  const fechaIn = new Date(checkin + 'T12:00:00');
  const fechaOut = new Date(checkout + 'T12:00:00');
  return Math.max(1, Math.ceil((fechaOut.getTime() - fechaIn.getTime()) / (1000 * 60 * 60 * 24)));
}

// ==================== TARIFA HELPERS ====================

/** Busca el rango que corresponde a la cantidad de personas dada. */
function encontrarRango(rangos: RangoPrecio[], personas: number): RangoPrecio | undefined {
  // Buscar rango donde minPersonas <= personas <= maxPersonas
  for (const r of rangos) {
    if (personas >= r.minPersonas && (r.maxPersonas === null || personas <= r.maxPersonas)) {
      return r;
    }
  }
  // Fallback: usar el último rango (el que tiene maxPersonas null, o el de mayor cobertura)
  return rangos.length > 0 ? rangos[rangos.length - 1] : undefined;
}

/**
 * Convierte datos de tarifa desde la BD (puede ser formato viejo o nuevo) a RangoPrecio[].
 * Formato viejo: { "1": 35000, "2": 30000, ... }
 * Formato nuevo: { "rangos": [{ minPersonas, maxPersonas, precio }] }
 */
function normalizarRangos(preciosDb: any): RangoPrecio[] {
  if (!preciosDb) return [];
  // Nuevo formato: tiene la propiedad "rangos" como array
  if (preciosDb.rangos && Array.isArray(preciosDb.rangos)) {
    return preciosDb.rangos.map((r: any) => ({
      minPersonas: Number(r.minPersonas) || 1,
      maxPersonas: r.maxPersonas != null ? Number(r.maxPersonas) : null,
      precio: Number(r.precio) || 0,
    }));
  }
  // Formato viejo: keys numéricos { "1": 35000, "2": 30000, ... }
  const keys = Object.keys(preciosDb).filter(k => !isNaN(Number(k)) && Number(k) >= 1);
  if (keys.length > 0) {
    return keys.map(k => ({
      minPersonas: Number(k),
      maxPersonas: Number(k),
      precio: Number(preciosDb[k]) || 0,
    }));
  }
  return [];
}

/**
 * Calcula las noches de cortesía según la modalidad.
 * Devuelve la cantidad de noches a descontar.
 */
function calcularNochesGratis(promociones: PromocionesTarifa, noches: number, checkin?: string): number {
  const nc = promociones.nochesCortesia;
  if (!nc?.activo || !nc.modalidad) return 0;

  const mod = nc.modalidad;
  if (mod.tipo === 'cadaX') {
    const cada = mod.cada || 999;
    if (noches < cada) return 0;
    return Math.floor(noches / cada);
  }
  if (mod.tipo === 'aPartirDe') {
    if (noches < mod.minNoches) return 0;
    return mod.nochesGratis || 0;
  }
  if (mod.tipo === 'diaSemana' && checkin) {
    // Contar cuántas noches de la estadía caen en el día de la semana elegido
    const fechaInicio = new Date(checkin + 'T12:00:00');
    let count = 0;
    for (let i = 0; i < noches; i++) {
      const d = new Date(fechaInicio);
      d.setDate(d.getDate() + i);
      if (d.getDay() === mod.dia) count++;
    }
    return count;
  }
  return 0;
}

/**
 * Obtiene las promociones efectivas de una tarifa, migrando datos viejos (choferCortesia) si es necesario.
 */
function getPromocionesEfectivas(tarifa: TarifaPrecios): PromocionesTarifa {
  // Si tiene promociones nuevas, usar esas
  if (tarifa.promociones) return tarifa.promociones;
  // Migración: si tiene choferCortesia viejo, convertir a nuevo formato
  if (tarifa.choferCortesia) {
    return {
      acompananteSinCargo: {
        activo: true,
        etiqueta: 'Chofer de cortesía',
        habitacionAsignada: tarifa.habitacionChofer || undefined,
      },
    };
  }
  return {};
}

export interface CalcTarifaOptions {
  ninos?: number;
  checkin?: string;
}

function calcularTotalSegunTarifa(
  tarifas: Record<string, TarifaPrecios>,
  tipoTarifa: string,
  personas: number,
  noches: number,
  options?: CalcTarifaOptions
): number {
  // Buscar la tarifa (fallback a 'normal')
  const tarifa = tarifas[tipoTarifa] || tarifas['normal'];
  if (!tarifa || !tarifa.rangos || tarifa.rangos.length === 0) return 0;

  const promociones = getPromocionesEfectivas(tarifa);
  const modo: ModoCobro = tarifa.modoCobro || 'porGrupo';

  // ─── Noches de cortesía ───
  const nochesGratis = calcularNochesGratis(promociones, noches, options?.checkin);
  const nochesCobrables = Math.max(0, noches - nochesGratis);

  // ─── Niños diferenciado ───
  const ninosDif = promociones.ninosDiferenciado;
  const cantNinos = (options?.ninos && ninosDif?.activo) ? options.ninos : 0;
  const adultos = Math.max(1, personas - cantNinos);

  // ─── Acompañante sin cargo (no descuenta: el acompañante va a otra habitación) ───
  // Ya NO se resta 1 adulto. Todos los adultos de esta reserva pagan.
  // El acompañante se gestiona como una reserva separada con total=0.

  // ─── Cálculo por modo ───
  if (modo === 'porCama') {
    // Modo porCama: el precio del rango es por persona por noche
    const rango = encontrarRango(tarifa.rangos, adultos);
    const precioCama = rango?.precio || tarifa.rangos[0]?.precio || 0;
    let total = nochesCobrables * adultos * precioCama;
    // Sumar niños
    if (cantNinos > 0 && ninosDif?.activo) {
      total += cantNinos * (ninosDif.precioNino || 0) * nochesCobrables;
    }
    return total;
  }

  if (modo === 'porHabitacion') {
    const precio = tarifa.rangos[0]?.precio || 0;
    let total = nochesCobrables * precio;
    // Sumar niños si aplica
    if (cantNinos > 0 && ninosDif?.activo) {
      total += cantNinos * (ninosDif.precioNino || 0) * nochesCobrables;
    }
    return total;
  }

  const rango = encontrarRango(tarifa.rangos, adultos);
  if (!rango) return 0;

  if (modo === 'porPersona') {
    let total = nochesCobrables * adultos * rango.precio;
    // Sumar niños
    if (cantNinos > 0 && ninosDif?.activo) {
      total += cantNinos * (ninosDif.precioNino || 0) * nochesCobrables;
    }
    return total;
  }

  // porGrupo (default): el precio es el total del grupo
  let total = nochesCobrables * rango.precio;
  // Sumar niños
  if (cantNinos > 0 && ninosDif?.activo) {
    total += cantNinos * (ninosDif.precioNino || 0) * nochesCobrables;
  }
  return total;
}

// ==================== STORE INTERFACE ====================

interface HotelStore {
  // Data
  habitaciones: Record<string, Habitacion>;
  reservas: Reserva[];
  clientes: Cliente[];
  pagos: Pago[];
  // usuarios: gestionado por api.usuarios en UsuariosModule, no se almacena en el store
  gastos: Gasto[];
  auditoria: AuditoriaEntry[];
  caja: CajaState;
  historialMantenimiento: HistorialMantenimientoEntry[];
  mantenimientoPendientes: Record<string, string>; // habitacion -> reportId
  tarifas: Record<string, TarifaPrecios>;
  tiposTarifa: string[];
  metodosPago: MetodoPago[];
  categoriasGastos: string[];
  // Internal ID maps (populated by syncFromServer, not persisted)
  _categoriaGastoIds: Record<string, string>; // nombre → DB id
  _tarifaIds: Record<string, string>; // nombre → DB id
  _synced: boolean; // true después del primer syncFromServer exitoso

  // UI State
  usuarioActual: UsuarioSesion | null;
  moduloActivo: ModuloId;
  sidebarOpen: boolean;
  perfilOpen: boolean;
  sidebarFixed: boolean;
  startModule: string;
  setModulo: (modulo: ModuloId) => void;
  setSidebarOpen: (open: boolean) => void;
  setPerfilOpen: (open: boolean) => void;
  setUsuarioActual: (u: UsuarioSesion) => void;

  // Plan / Suscripción
  planActual: PlanTipo;
  fechaInicioTrial: string | null;
  fechaVencimientoTrial: string | null;
  moduloBloqueado: ModuloId | null;
  planes: Record<string, PlanInfo>;
  setModuloBloqueado: (m: ModuloId | null) => void;
  setPlanActual: (p: PlanTipo) => void;
  setPlans: (p: Record<string, PlanInfo>) => void;
  setSidebarFixed: (v: boolean) => void;
  setStartModule: (m: string) => void;

  // Auth
  loginFromSession: (sessionData: Record<string, any>) => Promise<boolean>;
  logout: () => void;

  // Auditoria
  _registrarAuditoria: (tipo: string, detalle: string) => void;

  // Habitaciones
  agregarHabitacion: (numero: string, tipo: string, capacidad: number, camasMatrimoniales: number, camasSimples: number) => Promise<boolean>;
  editarHabitacion: (numeroOriginal: string, numeroNuevo: string, tipo: string, capacidad: number, camasMatrimoniales: number, camasSimples: number) => Promise<boolean>;
  eliminarHabitacion: (numero: string) => Promise<boolean>;

  // Clientes
  agregarCliente: (datos: { nombre: string; dni: string; telefono?: string; email?: string; preferencias?: string }) => Promise<Cliente | null>;
  actualizarCliente: (id: string, datos: Partial<Cliente>) => Promise<boolean>;
  eliminarCliente: (id: string) => Promise<boolean>;
  buscarCliente: (termino: string) => Cliente[];

  // Reservas
  crearReserva: (datos: Partial<Reserva> & { checkin: string; checkout: string; habitacion: string; huesped: string; dni: string; personas: number }) => Promise<Reserva | null>;
  modificarReserva: (id: string, datos: Partial<Reserva>) => Promise<boolean>;
  cancelarReserva: (id: string) => Promise<boolean>;
  buscarDisponibilidad: (desde: string, hasta: string) => HabitacionDisponible[];
  calcularTotalReserva: (idReserva: string) => number;
  calcularTotalPagado: (idReserva: string) => number;
  nochesEntre: (checkin: string, checkout: string) => number;
  calcularTotalSegunTarifa: (tipoTarifa: string, personas: number, noches: number, options?: CalcTarifaOptions) => number;

  // Check-in/Check-out
  realizarCheckIn: (idReserva: string, datos: { contactoEmergencia?: { nombre: string; telefono: string }; observacionesHuesped?: string; llaveEntregada?: string; documentoVerificado?: boolean; firmaConformidad?: boolean; acompanantes?: { nombre: string; dni: string; celular: string }[]; menores?: { nombre: string; documento: string; edad: number; parentesco: string }[] }) => Promise<boolean>;
  realizarCheckOut: (idReserva: string) => Promise<{ noches: number; total: number } | null>;

  // Pagos
  registrarPago: (idReserva: string, monto: number, metodo: string, nota?: string) => Promise<Pago | null>;

  // Limpieza
  marcarComoLimpia: (numero: string) => Promise<void>;
  reportarMantenimiento: (numero: string, descripcion: string) => Promise<void>;
  resolverMantenimiento: (numero: string, reparacion: string, monto: number, sacarDeCaja?: boolean) => Promise<void>;

  // Caja
  abrirCaja: (montoInicial: number) => Promise<boolean>;
  registrarMovimientoCaja: (tipo: 'ingreso' | 'egreso', monto: number, descripcion: string, metodo: string, categoriaGastoNombre?: string) => Promise<boolean>;
  cerrarCaja: (billetes: Record<number, number>, totalOtros: number) => Promise<CierreCaja | null>;
  saldoActualCaja: () => number;
  editarMovimientoCaja: (movimientoId: string, data: { monto?: number; descripcion?: string }) => Promise<boolean>;
  eliminarMovimientoCaja: (movimientoId: string) => Promise<boolean>;

  // Gastos
  agregarGasto: (datos: { tipo: string; descripcion: string; monto: number; fecha?: string }) => Promise<Gasto | null>;
  eliminarGasto: (id: string) => Promise<boolean>;

  // Usuarios: las operaciones crear/actualizar/eliminar se hacen directamente
  // con api.usuarios en el componente UsuariosModule (no pasan por el store).

  // Tarifas
  actualizarPrecioTarifa: (tipo: string, personas: number, precio: number) => Promise<boolean>;
  guardarTarifaCompleta: (tipoOriginal: string, datos: { nombre: string; modoCobro: ModoCobro; rangos: RangoPrecio[]; camposPersonalizados: CampoPersonalizado[]; promociones?: PromocionesTarifa }) => Promise<boolean>;
  agregarTipoTarifa: (tipo: string) => Promise<boolean>;
  eliminarTipoTarifa: (tipo: string) => Promise<boolean>;
  agregarMetodoPago: (metodo: MetodoPago) => Promise<boolean>;
  editarMetodoPago: (idOriginal: string, metodo: MetodoPago) => Promise<boolean>;
  eliminarMetodoPago: (id: string) => Promise<boolean>;
  agregarCategoriaGasto: (categoria: string) => Promise<boolean>;
  editarCategoriaGasto: (nombreOriginal: string, nombreNuevo: string) => Promise<boolean>;
  eliminarCategoriaGasto: (categoria: string) => Promise<boolean>;
  // Sync
  syncFromServer: () => Promise<void>;

  // Reset
  resetData: () => void;
}

// ==================== STORE ====================

export const useHotelStore = create<HotelStore>()(
    (set, get) => ({
      // Default data
      habitaciones: defaultHabitaciones,
      reservas: defaultReservas,
      clientes: defaultClientes,
      pagos: defaultPagos,
      // usuarios: no se almacena en el store
      gastos: defaultGastos,
      auditoria: [],
      caja: { estado: 'cerrada', apertura: null, movimientos: [], historial: [] },
      historialMantenimiento: [],
      mantenimientoPendientes: {},
      tarifas: defaultTarifas,
      tiposTarifa: ['compartida'],
      metodosPago: defaultMetodosPago,
      categoriasGastos: defaultCategoriasGastos,
      _categoriaGastoIds: {},
      _tarifaIds: {},
      _synced: false,

      // UI
      usuarioActual: null,
      moduloActivo: 'dashboard',
      sidebarOpen: false,
      perfilOpen: false,
      sidebarFixed: false,
      startModule: 'dashboard',

      // Plan / Suscripción
      planActual: 'trial' as PlanTipo,
      fechaInicioTrial: null,
      fechaVencimientoTrial: null,
      moduloBloqueado: null,
      planes: PLANES as Record<string, PlanInfo>,
      setModuloBloqueado: (m) => set({ moduloBloqueado: m }),
      setPlanActual: (p) => set({ planActual: p }),
      setPlans: (p) => set({ planes: p as Record<string, PlanInfo> }),
      setSidebarFixed: (v) => set({ sidebarFixed: v }),
      setStartModule: (m) => set({ startModule: m }),

      setModulo: (modulo) => {
        const { planActual, usuarioActual, sidebarOpen, planes } = get();
        // Owner y admin tienen acceso a todo
        const isFullAccess = usuarioActual?.rol === 'owner' || usuarioActual?.rol === 'admin';
        // Configuracion es owner/admin-only, no depende del plan
        if ((modulo as string) !== 'configuracion' && usuarioActual && !isFullAccess) {
          const efectivos = calcModulosEfectivos(usuarioActual.permisos, planActual, planes);
          if (!efectivos.includes(modulo)) {
            set({ moduloBloqueado: modulo, sidebarOpen: false });
            return;
          }
        }
        set({ moduloActivo: modulo as any, moduloBloqueado: null, sidebarOpen: false });
      },
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setPerfilOpen: (open) => set({ perfilOpen: open }),
      setUsuarioActual: (u) => set({ usuarioActual: u }),

      // Auth
      loginFromSession: async (sessionData: Record<string, any>) => {
        const sesion: UsuarioSesion = {
          id: sessionData.id,
          tenantUserId: sessionData.tenantUserId,
          nombre: sessionData.nombre,
          nombreCompleto: sessionData.nombreCompleto,
          permisos: sessionData.permisos || [],
          rol: sessionData.rol,
          tenantId: sessionData.tenantId,
          tenantNombre: sessionData.tenantNombre,
          email: sessionData.email,
        };
        // Apply start module preference (from store, in memory only)
        const isFullAccess = sesion.rol === 'owner' || sesion.rol === 'admin';
        const storedStart = get().startModule || 'dashboard';
        const startModule = (storedStart !== 'dashboard' && (isFullAccess || sesion.permisos.includes(storedStart)))
          ? storedStart
          : 'dashboard';
        // Siempre sincronizar con el valor fresco del servidor
        // para evitar desincronización (ej: super-admin extendió el trial)
        if (sessionData.fechaInicioTrial) {
          set({ fechaInicioTrial: sessionData.fechaInicioTrial });
        }
        if (sessionData.subscriptionVencimiento) {
          set({ fechaVencimientoTrial: sessionData.subscriptionVencimiento });
        }
        if (sessionData.planActual) {
          set({ planActual: sessionData.planActual });
        }
        set({ usuarioActual: sesion, moduloActivo: startModule as any, moduloBloqueado: null });
        get()._registrarAuditoria('Login', `Inicio de sesión: ${sesion.nombreCompleto || sesion.nombre}`);
        // NOTA: syncFromServer debe llamarse DESPUÉS de actualizar el JWT,
        // no aquí, para evitar race condition con las API routes.
        return true;
      },

      logout: () => {
        const { usuarioActual } = get();
        if (usuarioActual) {
          get()._registrarAuditoria('Logout', `Cierre de sesión: ${usuarioActual.nombre}`);
        }
        set({ usuarioActual: null, moduloActivo: 'dashboard' });
      },

      // Auditoria
      _registrarAuditoria: (tipo, detalle) => {
        const { usuarioActual, auditoria } = get();
        const empleado = usuarioActual?.nombreCompleto || usuarioActual?.nombre || 'Sistema';
        const entry: AuditoriaEntry = {
          id: generarId(),
          tipo,
          detalle,
          empleado,
          fecha: new Date().toISOString(),
        };
        set({ auditoria: [entry, ...auditoria] });
        // Auditoría: fire-and-forget aceptable (no es dato de negocio, no requiere rollback)
        // Si falla, solo se pierde el log, no afecta la operación principal.
        if (usuarioActual?.tenantId) {
          fetch('/api/auditoria', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, detalle, empleado, tenantId: usuarioActual.tenantId }),
          }).catch((err) => {
            console.warn('[auditoria] No se pudo persistir entrada:', err);
          });
        }
      },
      // ===== HABITACIONES =====
      agregarHabitacion: async (numero, tipo, capacidad, camasMatrimoniales, camasSimples) => {
        const { habitaciones } = get();
        if (habitaciones[numero]) return false;
        const prevHabitaciones = habitaciones;
        set({
          habitaciones: {
            ...habitaciones,
            [numero]: { numero, tipo, capacidad: parseInt(String(capacidad)), camasMatrimoniales: parseInt(String(camasMatrimoniales)) || 0, camasSimples: parseInt(String(camasSimples)) || 0, estado: 'Disponible' },
          },
        });
        get()._registrarAuditoria('Habitación', `Creación: habitación ${numero} (${tipo})`);
        try {
          await api.habitaciones.create({ numero, tipo, capacidad: parseInt(String(capacidad)), camasMatrimoniales: parseInt(String(camasMatrimoniales)) || 0, camasSimples: parseInt(String(camasSimples)) || 0 });
        } catch (err) {
          console.error('[agregarHabitacion] API error, rolling back:', err);
          set({ habitaciones: prevHabitaciones });
          return false;
        }
        return true;
      },

      editarHabitacion: async (numeroOriginal, numeroNuevo, tipo, capacidad, camasMatrimoniales, camasSimples) => {
        const { habitaciones, reservas, historialMantenimiento, mantenimientoPendientes } = get();
        const hab = habitaciones[numeroOriginal];
        if (!hab) return false;

        const nuevaCapacidad = parseInt(String(capacidad));
        const reservasAfectadas = reservas.filter(
          r => r.habitacion === numeroOriginal && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado') && r.personas > nuevaCapacidad
        );
        if (reservasAfectadas.length > 0) return false;

        const datosNuevos: Habitacion = { ...hab, tipo, capacidad: nuevaCapacidad, camasMatrimoniales: parseInt(String(camasMatrimoniales)) || 0, camasSimples: parseInt(String(camasSimples)) || 0 };

        // Save state for rollback
        const prevState = { habitaciones, reservas, historialMantenimiento, mantenimientoPendientes };

        if (numeroOriginal !== numeroNuevo) {
          if (habitaciones[numeroNuevo] && numeroNuevo !== numeroOriginal) return false;
          const newHabs = { ...habitaciones };
          delete newHabs[numeroOriginal];
          newHabs[numeroNuevo] = datosNuevos;
          newHabs[numeroNuevo].numero = numeroNuevo;
          const updatedReservas = reservas.map(r => r.habitacion === numeroOriginal ? { ...r, habitacion: numeroNuevo } : r);
          const updatedHist = historialMantenimiento.map(h => h.habitacion === numeroOriginal ? { ...h, habitacion: numeroNuevo } : h);
          const updatedPend = mantenimientoPendientes;
          const newPendientes: Record<string, string> = {};
          for (const [k, v] of Object.entries(updatedPend)) {
            newPendientes[k === numeroOriginal ? numeroNuevo : k] = v;
          }
          set({ habitaciones: newHabs, reservas: updatedReservas, historialMantenimiento: updatedHist, mantenimientoPendientes: newPendientes });
        } else {
          set({ habitaciones: { ...habitaciones, [numeroOriginal]: datosNuevos } });
        }
        get()._registrarAuditoria('Habitación', `Edición: ${numeroOriginal}${numeroOriginal !== numeroNuevo ? ` → ${numeroNuevo}` : ''}`);
        try {
          await api.habitaciones.update(numeroOriginal, { numero: numeroNuevo, tipo, capacidad: nuevaCapacidad, camasMatrimoniales: parseInt(String(camasMatrimoniales)) || 0, camasSimples: parseInt(String(camasSimples)) || 0 });
        } catch (err) {
          console.error('[editarHabitacion] API error, rolling back:', err);
          set(prevState);
          return false;
        }
        return true;
      },

      eliminarHabitacion: async (numero) => {
        const { habitaciones, reservas } = get();
        const hab = habitaciones[numero];
        if (!hab || hab.estado === 'Ocupada') return false;
        const reservasActivas = reservas.filter(r => r.habitacion === numero && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'));
        if (reservasActivas.length > 0) return false;

        const prevHabitaciones = habitaciones;
        const prevReservas = reservas;
        const newHabs = { ...habitaciones };
        delete newHabs[numero];
        const updatedReservas = reservas.map(r => r.habitacion === numero && !['Cancelada', 'Check-Out realizado', 'Check-In realizado', 'Confirmada'].includes(r.estado) ? { ...r, estado: 'Cancelada' as const } : r);
        set({ habitaciones: newHabs, reservas: updatedReservas });
        get()._registrarAuditoria('Habitación', `Eliminación: habitación ${numero}`);
        try {
          await api.habitaciones.delete(numero);
        } catch (err) {
          console.error('[eliminarHabitacion] API error, rolling back:', err);
          set({ habitaciones: prevHabitaciones, reservas: prevReservas });
          return false;
        }
        return true;
      },

      // ===== CLIENTES =====
      agregarCliente: async (datos) => {
        const { clientes } = get();
        const prevClientes = clientes;
        const nuevo: Cliente = { id: generarId(), ...datos, telefono: datos.telefono || '', email: datos.email || '', preferencias: datos.preferencias || '', historialEstadias: [], fechaCreacion: todayLocal() };
        set({ clientes: [...clientes, nuevo] });
        get()._registrarAuditoria('Cliente', `Creación: ${datos.nombre} (DNI: ${datos.dni})`);
        try {
          const dbCliente = await api.clientes.create({ nombre: datos.nombre, dni: datos.dni, telefono: datos.telefono || '', email: datos.email, preferencias: datos.preferencias });
          // Replace temp ID with real DB ID
          set({ clientes: get().clientes.map(c => c.id === nuevo.id ? { ...c, id: dbCliente.id } : c) });
          nuevo.id = dbCliente.id;
        } catch (err) {
          console.error('[agregarCliente] API error, rolling back:', err);
          set({ clientes: prevClientes });
          return null;
        }
        return nuevo;
      },

      actualizarCliente: async (id, datos) => {
        const { clientes } = get();
        const prevClientes = clientes;
        const cliente = clientes.find(c => c.id === id);
        if (!cliente) return false;
        set({ clientes: clientes.map(c => c.id === id ? { ...c, ...datos } : c) });
        if (cliente) {
          get()._registrarAuditoria('Cliente', `Edición: ${cliente.nombre} (DNI: ${cliente.dni})`);
          try {
            await api.clientes.update(id, datos as any);
          } catch (err) {
            console.error('[actualizarCliente] API error, rolling back:', err);
            set({ clientes: prevClientes });
            return false;
          }
        }
        return true;
      },

      eliminarCliente: async (id) => {
        const { clientes, reservas } = get();
        const cliente = clientes.find(c => c.id === id);
        if (!cliente) return false;
        const reservasActivas = reservas.filter(r => r.idCliente === id && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'));
        if (reservasActivas.length > 0) return false;
        const prevClientes = clientes;
        set({ clientes: clientes.filter(c => c.id !== id) });
        get()._registrarAuditoria('Cliente', `Eliminación: ${cliente.nombre} (DNI: ${cliente.dni})`);
        try {
          await api.clientes.delete(id);
        } catch (err) {
          console.error('[eliminarCliente] API error, rolling back:', err);
          set({ clientes: prevClientes });
          return false;
        }
        return true;
      },

      buscarCliente: (termino) => {
        const term = termino.toLowerCase();
        return get().clientes.filter(c => c.nombre.toLowerCase().includes(term) || c.dni.includes(term) || c.email.toLowerCase().includes(term));
      },

      // ===== RESERVAS =====
      buscarDisponibilidad: (desde, hasta) => {
        const { habitaciones, reservas } = get();
        const fechaDesde = new Date(desde + 'T12:00:00');
        const fechaHasta = new Date(hasta + 'T12:00:00');
        const disponibles: HabitacionDisponible[] = [];

        for (const num in habitaciones) {
          const hab = habitaciones[num];
          if (hab.estado === 'Mantenimiento' || hab.estado === 'Fuera de servicio') continue;

          if (hab.tipo === 'Compartida') {
            const personasOcupadas = reservas
              .filter(r => r.habitacion === num && r.estado !== 'Cancelada' && r.estado !== 'Check-Out realizado')
              .filter(r => { const rD = new Date(r.checkin + 'T12:00:00'); const rH = new Date(r.checkout + 'T12:00:00'); return rD < fechaHasta && rH > fechaDesde; })
              .reduce((sum, r) => sum + (r.personas || 1), 0);
            const camasLibres = hab.capacidad - personasOcupadas;
            if (camasLibres > 0) disponibles.push({ numero: num, tipo: hab.tipo, capacidad: hab.capacidad, camasMatrimoniales: hab.camasMatrimoniales, camasSimples: hab.camasSimples, precioPorCama: hab.precioPorCama, camasLibres });
            continue;
          }

          const conflicto = reservas.some(r => {
            if (r.habitacion !== num || r.estado === 'Cancelada' || r.estado === 'Check-Out realizado') return false;
            const rD = new Date(r.checkin + 'T12:00:00'); const rH = new Date(r.checkout + 'T12:00:00');
            return rD < fechaHasta && rH > fechaDesde;
          });
          if (!conflicto) disponibles.push({ numero: num, tipo: hab.tipo, capacidad: hab.capacidad, camasMatrimoniales: hab.camasMatrimoniales, camasSimples: hab.camasSimples, precioPorCama: hab.precioPorCama });
        }
        return disponibles;
      },

      crearReserva: async (datos) => {
        const state = get();

        // Validar que la caja esté abierta antes de crear reserva
        if (state.caja.estado !== 'abierta') {
          return null;
        }

        const disponibles = state.buscarDisponibilidad(datos.checkin, datos.checkout);
        const habElegida = disponibles.find(h => h.numero === datos.habitacion);
        if (!habElegida) return null;

        const totalOcupantes = datos.personas + (datos.ninos || 0);
        // Para compartidas: validar contra camasLibres; para normales: contra capacidad
        if (habElegida.tipo === 'Compartida') {
          if (totalOcupantes > (habElegida.camasLibres || 0)) return null;
        } else {
          if (totalOcupantes > habElegida.capacidad) return null;
        }

        const noches = nochesEntre(datos.checkin, datos.checkout);

        // Usar el total calculado por la UI (que incluye niños, promociones, recargos) si está disponible.
        // Si no, recalcular en el store como fallback.
        const total = datos.total != null
          ? datos.total
          : calcularTotalSegunTarifa(state.tarifas, datos.tipoTarifa || 'normal', datos.personas, noches, { checkin: datos.checkin, ninos: datos.ninos });

        // Fix 6: crear/encontrar cliente ANTES de la reserva para vincular en BD
        let clienteRealId: string | undefined;
        try {
          try {
            const dbCliente = await api.clientes.create({ nombre: datos.huesped, dni: datos.dni, telefono: datos.telefono || '', email: datos.email });
            clienteRealId = dbCliente.id;
            const currentClientes = get().clientes;
            if (!currentClientes.find(c => c.id === dbCliente.id)) {
              set({ clientes: [...currentClientes, { id: dbCliente.id, nombre: dbCliente.nombre, dni: dbCliente.dni, telefono: dbCliente.telefono, email: dbCliente.email || '', preferencias: dbCliente.preferencias, historialEstadias: [], fechaCreacion: dbCliente.createdAt?.split('T')[0] || '' }] });
            }
          } catch (createErr: any) {
            if (createErr?.status === 409) {
              // Cliente ya existe — buscar por DNI en store local
              const existing = get().clientes.find(c => c.dni === datos.dni);
              clienteRealId = existing?.id;
            }
            // Si es otro error (no 409), no bloqueamos la reserva
          }
        } catch (clienteErr) {
          console.warn('[crearReserva] No se pudo vincular cliente:', clienteErr);
        }

        const tempId = generarId();
        const reserva: Reserva = {
          id: tempId, idCliente: clienteRealId || '', huesped: datos.huesped, dni: datos.dni,
          telefono: datos.telefono || '', email: datos.email || '', domicilio: datos.domicilio || '',
          habitacion: datos.habitacion, checkin: datos.checkin, checkout: datos.checkout,
          personas: datos.personas, estadoPago: datos.estadoPago || 'Pendiente', notas: datos.notas || '',
          estado: 'Confirmada', tipoTarifa: datos.tipoTarifa || 'normal',
          metodoPagoId: datos.metodoPagoId, cuotas: datos.cuotas,
          recargoPorcentaje: datos.recargoPorcentaje, agencia: datos.agencia, total,
          ninos: datos.ninos,
          acompanantes: datos.acompanantes || [],
        };

        const newReservas = [...state.reservas, reserva];
        const prevHabitaciones = state.habitaciones;
        const newHabitaciones = { ...prevHabitaciones };

        if (habElegida.tipo !== 'Compartida' && newHabitaciones[datos.habitacion]) {
          newHabitaciones[datos.habitacion] = { ...newHabitaciones[datos.habitacion], estado: 'Reservada' };
        }

        set({ reservas: newReservas, habitaciones: newHabitaciones });
        state._registrarAuditoria('Reserva', `Creación: ${datos.huesped} - Hab ${datos.habitacion} - Total: $${total}`);

        // Crear en BD — ahora con clienteId y datosAdicionales
        const apiPayload: any = {
          clienteId: clienteRealId || null,
          huesped: datos.huesped, dni: datos.dni, telefono: datos.telefono || '',
          email: datos.email || '', domicilio: datos.domicilio || '',
          habitacion: datos.habitacion, checkin: datos.checkin, checkout: datos.checkout,
          personas: datos.personas,
          ninos: datos.ninos || null,
          total: total != null ? Math.round(total * 100) : null,
          tipoTarifa: datos.tipoTarifa || 'normal',
          metodoPagoId: datos.metodoPagoId, cuotas: datos.cuotas,
          recargoPorcentaje: datos.recargoPorcentaje,
          notas: datos.notas || '', acompanantes: datos.acompanantes || [],
        };
        if (datos.datosAdicionales && Object.keys(datos.datosAdicionales as Record<string, string>).length > 0) {
          apiPayload.datosAdicionales = datos.datosAdicionales;
        }
        if (datos.agencia) { apiPayload.agenciaNombre = datos.agencia.nombre; apiPayload.agenciaConvenio = datos.agencia.convenio; apiPayload.agenciaVendedor = datos.agencia.vendedor; }
        if (datos.contactoEmergencia) { apiPayload.contactoEmergenciaNombre = datos.contactoEmergencia.nombre; apiPayload.contactoEmergenciaTel = datos.contactoEmergencia.telefono; }

        try {
          const dbReserva = await api.reservas.create(apiPayload);
          // Reemplazar el ID temporal con el ID real de la BD
          const currentReservas = get().reservas;
          const updatedId = dbReserva.id;
          set({
            reservas: currentReservas.map(r => r.id === tempId ? { ...r, id: updatedId } : r),
          });
          // Actualizar el ID local antes de retornar para que registrarPago pueda encontrar la reserva
          reserva.id = updatedId;
          pushNotif('success', 'Reserva creada', `${datos.huesped} — Hab. ${datos.habitacion}`);
        } catch (err) {
          const isAuth = err && typeof err === 'object' && 'status' in err && (err as any).status === 401;
          console.error('[crearReserva] Error al guardar en BD:', isAuth ? 'Error de autenticación (401)' : err);
          // Revertir en el store si falló la creación en BD
          const currentReservas = get().reservas;
          const currentHabs = get().habitaciones;
          set({
            reservas: currentReservas.filter(r => r.id !== tempId),
            habitaciones: habElegida.tipo === 'Compartida' ? currentHabs : {
              ...currentHabs,
              [datos.habitacion]: prevHabitaciones[datos.habitacion],
            },
          });
          // Re-lanzar errores de auth para que el componente muestre el mensaje adecuado
          if (isAuth) throw err;
          return null;
        }

        return reserva;
      },

      modificarReserva: async (id, datos) => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === id);
        if (!reserva) return false;

        if (datos.habitacion || datos.checkin || datos.checkout) {
          const checkin = datos.checkin || reserva.checkin;
          const checkout = datos.checkout || reserva.checkout;
          const habitacion = datos.habitacion || reserva.habitacion;
          const disponibles = state.buscarDisponibilidad(checkin, checkout);
          if (!disponibles.find(h => h.numero === habitacion)) return false;
        }

        const prevReservas = state.reservas;
        const prevHabitaciones = state.habitaciones;

        if (datos.habitacion && datos.habitacion !== reserva.habitacion) {
          const newHabs = { ...state.habitaciones };
          const habAnterior = newHabs[reserva.habitacion];
          if (habAnterior && habAnterior.tipo !== 'Compartida' && habAnterior.estado === 'Reservada') {
            newHabs[reserva.habitacion] = { ...habAnterior, estado: 'Disponible' };
          }
          if (newHabs[datos.habitacion] && newHabs[datos.habitacion].tipo !== 'Compartida') {
            newHabs[datos.habitacion] = { ...newHabs[datos.habitacion], estado: 'Reservada' };
          }
          set({ habitaciones: newHabs });
        }

        const updatedReservas = state.reservas.map(r => {
          if (r.id !== id) return r;
          const updated = { ...r, ...datos };
          // Si cambian campos que afectan el precio, recalcular total
          // (pero si datos.total viene de la UI con niños/promos, usar ese)
          if ((datos.checkin || datos.checkout || datos.personas || datos.tipoTarifa || datos.habitacion) && datos.total == null) {
            const hab = state.habitaciones[updated.habitacion || r.habitacion];
            const ninosCount = updated.ninos || r.ninos || 0;
            updated.total = calcularTotalSegunTarifa(state.tarifas, updated.tipoTarifa || 'normal', updated.personas || 1, nochesEntre(updated.checkin, updated.checkout), { checkin: updated.checkin, ninos: ninosCount > 0 ? ninosCount : undefined });
          }
          return updated;
        });
        set({ reservas: updatedReservas });
        state._registrarAuditoria('Reserva', `Modificación #${id}: ${reserva.huesped}`);
        const apiPayload: any = { ...datos };
        if (datos.habitacion) apiPayload.habitacion = datos.habitacion;
        if (datos.checkin) apiPayload.checkin = datos.checkin;
        if (datos.checkout) apiPayload.checkout = datos.checkout;
        if (datos.personas) apiPayload.personas = datos.personas;
        if (datos.ninos !== undefined) apiPayload.ninos = datos.ninos;
        if (datos.total !== undefined) apiPayload.total = Math.round(datos.total * 100);
        if (datos.tipoTarifa) apiPayload.tipoTarifa = datos.tipoTarifa;
        if (datos.datosAdicionales !== undefined) apiPayload.datosAdicionales = datos.datosAdicionales;
        try {
          await api.reservas.update(id, apiPayload as any);
        } catch (err) {
          console.error('[modificarReserva] API error, rolling back:', err);
          set({ reservas: prevReservas, habitaciones: prevHabitaciones });
          return false;
        }
        return true;
      },

      cancelarReserva: async (id) => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === id);
        if (!reserva || reserva.estado !== 'Confirmada') return false;

        const prevReservas = state.reservas;
        const prevHabitaciones = state.habitaciones;
        const newReservas = state.reservas.map(r => r.id === id ? { ...r, estado: 'Cancelada' as const } : r);
        const newHabs = { ...state.habitaciones };
        const hab = newHabs[reserva.habitacion];
        if (hab && hab.tipo !== 'Compartida' && hab.estado === 'Reservada') {
          newHabs[reserva.habitacion] = { ...hab, estado: 'Disponible' };
        }
        set({ reservas: newReservas, habitaciones: newHabs });
        state._registrarAuditoria('Reserva', `Cancelación #${id}: ${reserva.huesped} - Hab ${reserva.habitacion}`);

        try {
          await api.reservas.cancel(id);
        } catch (err) {
          console.error('[cancelarReserva] API error, rolling back:', err);
          set({ reservas: prevReservas, habitaciones: prevHabitaciones });
          return false;
        }
        return true;
      },

      calcularTotalReserva: (idReserva) => {
        const { reservas, tarifas, habitaciones } = get();
        const reserva = reservas.find(r => r.id === idReserva);
        if (!reserva) return 0;
        if (reserva.total !== undefined && reserva.total !== null) return reserva.total;
        const hab = habitaciones[reserva.habitacion];
        const ninosCount = reserva.ninos || 0;
        return calcularTotalSegunTarifa(tarifas, reserva.tipoTarifa || 'normal', reserva.personas || 1, nochesEntre(reserva.checkin, reserva.checkout), { checkin: reserva.checkin, ninos: ninosCount > 0 ? ninosCount : undefined });
      },

      calcularTotalPagado: (idReserva) => {
        return get().pagos.filter(p => p.idReserva === idReserva).reduce((sum, p) => sum + p.monto, 0);
      },

      nochesEntre: (checkin, checkout) => nochesEntre(checkin, checkout),

      calcularTotalSegunTarifa: (tipoTarifa, personas, noches, options) => {
        return calcularTotalSegunTarifa(get().tarifas, tipoTarifa, personas, noches, options);
      },

      // ===== CHECK-IN / CHECK-OUT =====
      realizarCheckIn: async (idReserva, datos) => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === idReserva);
        if (!reserva || reserva.estado !== 'Confirmada') return false;

        // 1) Actualizar estado local (optimista)
        const updatedReservas = state.reservas.map(r => {
          if (r.id !== idReserva) return r;
          return {
            ...r,
            ...datos,
            menores: datos.menores || r.menores,
            horaCheckin: new Date().toISOString(),
            estado: 'Check-In realizado' as const,
          };
        });

        const newHabs = { ...state.habitaciones };
        if (newHabs[reserva.habitacion]) {
          newHabs[reserva.habitacion] = { ...newHabs[reserva.habitacion], estado: 'Ocupada' };
        }

        set({ reservas: updatedReservas, habitaciones: newHabs });
        state._registrarAuditoria('Check-In', `Check-In: ${reserva.huesped} - Hab ${reserva.habitacion}`);

        // 2) Llamar a la API con todos los campos
        try {
          const checkinPayload: any = { horaCheckin: new Date().toISOString() };
          if (datos.contactoEmergencia) {
            checkinPayload.contactoEmergenciaNombre = datos.contactoEmergencia.nombre;
            checkinPayload.contactoEmergenciaTel = datos.contactoEmergencia.telefono;
          }
          if (datos.observacionesHuesped) checkinPayload.observacionesHuesped = datos.observacionesHuesped;
          if (datos.llaveEntregada) checkinPayload.llaveEntregada = datos.llaveEntregada;
          if (datos.documentoVerificado) checkinPayload.documentoVerificado = datos.documentoVerificado;
          if (datos.firmaConformidad) checkinPayload.firmaConformidad = datos.firmaConformidad;
          if (datos.acompanantes) checkinPayload.acompanantes = datos.acompanantes;
          if (datos.menores) checkinPayload.menores = datos.menores;

          await api.reservas.checkin(idReserva, checkinPayload);
        } catch (err) {
          console.error('[realizarCheckIn] Error al guardar en BD:', err);
          // Rollback: revertir estado local
          const current = get();
          set({
            reservas: current.reservas.map(r => r.id === idReserva ? { ...r, estado: 'Confirmada' as const, horaCheckin: undefined } : r),
            habitaciones: {
              ...current.habitaciones,
              [reserva.habitacion]: current.habitaciones[reserva.habitacion] ? { ...current.habitaciones[reserva.habitacion], estado: 'Reservada' as const } : current.habitaciones[reserva.habitacion],
            },
          });
          return false;
        }
        pushNotif('success', 'Check-In realizado', `${reserva.huesped} — Hab. ${reserva.habitacion}`);
        return true;
      },

      realizarCheckOut: async (idReserva) => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === idReserva);
        if (!reserva || reserva.estado !== 'Check-In realizado') return null;

        const total = state.calcularTotalReserva(idReserva);
        const fechaSalidaReal = todayLocal();
        const noches = nochesEntre(reserva.checkin, fechaSalidaReal);
        const horaCheckout = new Date().toISOString();

        // 1) Actualizar estado local (optimista)
        const updatedReservas = state.reservas.map(r => {
          if (r.id !== idReserva) return r;
          return { ...r, horaCheckout, checkout: fechaSalidaReal, estado: 'Check-Out realizado' as const };
        });

        const newHabs = { ...state.habitaciones };
        if (newHabs[reserva.habitacion]) {
          newHabs[reserva.habitacion] = { ...newHabs[reserva.habitacion], estado: 'Limpieza' };
        }

        // Registrar estadía en cliente
        const newClientes = state.clientes.map(c => {
          if (c.id !== reserva.idCliente) return c;
          const estadia: Estadia = { fechaCheckin: reserva.checkin, fechaCheckout: fechaSalidaReal, habitacion: reserva.habitacion, gastoTotal: total };
          return { ...c, historialEstadias: [...c.historialEstadias, estadia] };
        });

        // Guardar estado previo para rollback
        const prevHabitaciones = { ...state.habitaciones };

        set({ reservas: updatedReservas, habitaciones: newHabs, clientes: newClientes });
        state._registrarAuditoria('Check-Out', `Check-Out: ${reserva.huesped} - Hab ${reserva.habitacion} (Total: ${total})`);

        // 2) Llamar a la API
        try {
          await api.reservas.checkout(idReserva, { fechaCheckoutReal: fechaSalidaReal });
        } catch (err) {
          console.error('[realizarCheckOut] Error al guardar en BD:', err);
          // Rollback: revertir estado local
          const current = get();
          set({
            reservas: current.reservas.map(r => r.id === idReserva ? { ...r, estado: 'Check-In realizado' as const, horaCheckout: undefined, checkout: reserva.checkout } : r),
            habitaciones: prevHabitaciones,
            clientes: state.clientes, // revertir clientes también
          });
          return null;
        }
        pushNotif('info', 'Check-Out realizado', `${reserva.huesped} — Hab. ${reserva.habitacion}`);
        return { noches, total };
      },

      // ===== PAGOS =====
      registrarPago: async (idReserva, monto, metodo, nota = '') => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === idReserva);
        if (!reserva) return null;

        // Validar que la caja esté abierta antes de registrar un pago
        if (state.caja.estado !== 'abierta') {
          return null;
        }

        // Resolve metodo: if it's an ID, find the name from metodosPago
        const metodoObj = state.metodosPago.find(m => m.id === metodo);
        const metodoResuelto = metodoObj ? metodoObj.nombre : metodo;

        const montoNum = parseFloat(String(monto));
        const tempId = generarId();
        const nuevoPago: Pago = { id: tempId, idReserva, monto: montoNum, metodo: metodoResuelto, fecha: todayLocal(), nota };
        const newPagos = [...state.pagos, nuevoPago];

        const total = state.calcularTotalReserva(idReserva);
        const pagado = newPagos.filter(p => p.idReserva === idReserva).reduce((s, p) => s + p.monto, 0);
        let estadoPago: 'Pendiente' | 'Parcial' | 'Pagado' = 'Pendiente';
        if (Math.round(pagado * 100) >= Math.round(total * 100)) estadoPago = 'Pagado';
        else if (pagado > 0) estadoPago = 'Parcial';

        const newReservas = state.reservas.map(r => r.id === idReserva ? { ...r, estadoPago } : r);
        const prevPagos = state.pagos;
        const prevReservas = state.reservas;

        // 1) Actualizar estado local (optimista)
        set({ pagos: newPagos, reservas: newReservas });
        state._registrarAuditoria('Pago', `Pago recibido: ${reserva.huesped} - ${monto} en ${metodoResuelto}${nota ? ` (${nota})` : ''}`);

        // 2) Llamar a la API
        try {
          const dbPago = await api.pagos.create({ reservaId: idReserva, monto: Math.round(montoNum * 100), metodo, nota });

          // Reemplazar ID temporal con ID real de BD
          const currentPagos = get().pagos;
          set({
            pagos: currentPagos.map(p => p.id === tempId ? { ...p, id: dbPago.id } : p),
          });
          nuevoPago.id = (dbPago as any).id || dbPago;

          // Refrescar caja desde el server para traer el nuevo movimiento
          try {
            const cajaData = await api.caja.get();
            set({ caja: mapDbCajaToStore(cajaData) });
          } catch {
            // Si falla el refresh de caja, no es crítico
          }
        } catch (err) {
          console.error('[registrarPago] Error al guardar en BD:', err);
          set({ pagos: prevPagos, reservas: prevReservas });
          return null;
        }
        return nuevoPago;
      },

      // ===== LIMPIEZA =====
      marcarComoLimpia: async (numero) => {
        const { habitaciones } = get();
        const hab = habitaciones[numero];
        if (!hab || hab.estado !== 'Limpieza') return;

        const prevHabitaciones = get().habitaciones;

        try {
          // 1. Marcar tarea de limpieza como completada (o crear una)
          // La API de limpieza al completar también actualiza la habitación a Disponible en BD
          const tasks = await api.limpieza.list('pendiente');
          const existing = (tasks as any[]).find((t: any) => t.habitacion === numero);
          if (existing) {
            await api.limpieza.update(existing.id, { estado: 'completada' });
          } else {
            // No hay tarea pendiente — crear y completar inmediatamente
            const tarea = await api.limpieza.create({ habitacion: numero });
            await api.limpieza.update((tarea as any).id, { estado: 'completada' });
          }

          // 2. Todo OK — actualizar estado local
          set({ habitaciones: { ...prevHabitaciones, [numero]: { ...hab, estado: 'Disponible' as const } } });
          get()._registrarAuditoria('Limpieza', `Habitación ${numero} marcada como limpia`);
          pushNotif('success', 'Limpieza completada', `Habitación ${numero} disponible`);
        } catch (err) {
          console.error('[marcarComoLimpia] error:', err);
          throw err;
        }
      },

      reportarMantenimiento: async (numero, descripcion) => {
        const { habitaciones, reservas } = get();
        const hab = habitaciones[numero];
        if (!hab) return;

        const empleado = get().usuarioActual?.nombreCompleto || get().usuarioActual?.nombre || 'Sistema';

        // Identificar reservas a cancelar (solo Confirmada — las demás no se pueden cancelar)
        const reservasACancelar = reservas.filter(r =>
          r.habitacion === numero &&
          r.estado === 'Confirmada'
        );

        try {
          // 1. Cancelar reservas confirmadas de esa habitación via API (antes de crear el reporte)
          // Si alguna falla, abortamos todo — no se crea el reporte ni se toca el estado local
          if (reservasACancelar.length > 0) {
            const results = await Promise.allSettled(
              reservasACancelar.map(r => api.reservas.cancel(r.id))
            );

            const fallidas = results.filter(r => r.status === 'rejected');
            if (fallidas.length > 0) {
              throw new Error('No se pudieron cancelar todas las reservas activas. Intentá de nuevo.');
            }
          }

          // 2. Crear reporte de mantenimiento en BD (solo si las cancelaciones fueron exitosas)
          const reporte = await api.mantenimiento.create({ habitacion: numero, problema: descripcion, empleado });

          // 3. Todo OK — actualizar estado local
          const newHabs = { ...habitaciones, [numero]: { ...hab, estado: 'Mantenimiento' as const, problema: descripcion } };
          const cancelIds = new Set(reservasACancelar.map(r => r.id));
          const newReservas = reservas.map(r =>
            cancelIds.has(r.id) ? { ...r, estado: 'Cancelada' as const } : r
          );
          const { mantenimientoPendientes } = get();

          set({
            habitaciones: newHabs,
            reservas: newReservas,
            mantenimientoPendientes: { ...mantenimientoPendientes, [numero]: reporte.id },
          });
          get()._registrarAuditoria('Mantenimiento', `Reporte: Hab ${numero} - ${descripcion}`);
        } catch (err) {
          console.error('reportarMantenimiento error:', err);
          throw err;
        }
      },

      resolverMantenimiento: async (numero, reparacion, monto, sacarDeCaja = true) => {
        const state = get();
        const hab = state.habitaciones[numero];
        if (!hab || hab.estado !== 'Mantenimiento') return;

        const reportId = state.mantenimientoPendientes[numero];
        if (!reportId) return;
        const empleado = state.usuarioActual?.nombreCompleto || state.usuarioActual?.nombre || 'Sistema';
        const montoNum = parseFloat(String(monto)) || 0;
        const esDeCaja = sacarDeCaja === true;

        // Snapshot COMPLETO de todo lo que vamos a modificar (para rollback)
        const prevGastos = state.gastos;
        const prevCaja = state.caja;
        const prevHabitaciones = state.habitaciones;
        const prevHistorial = state.historialMantenimiento;
        const prevPendientes = state.mantenimientoPendientes;

        // Construir nuevos estados optimistas sin mutar state directamente
        const newGastos = montoNum > 0
          ? [...prevGastos, { id: generarId(), tipo: 'Mantenimiento', descripcion: `Habitación ${numero}: ${reparacion}`, monto: montoNum, fecha: todayLocal(), empleado } as Gasto]
          : prevGastos;
        const tempGastoId = montoNum > 0 ? newGastos[newGastos.length - 1].id : undefined;

        const newCajaMovimientos = (montoNum > 0 && esDeCaja && prevCaja.estado === 'abierta')
          ? [...prevCaja.movimientos, { id: generarId(), tipo: 'egreso' as const, monto: montoNum, descripcion: `Mantenimiento hab. ${numero}: ${reparacion}`, metodo: 'Efectivo', empleado, fecha: new Date().toISOString(), gastoId: tempGastoId } as MovimientoCaja]
          : prevCaja.movimientos;
        const tempMovId = newCajaMovimientos !== prevCaja.movimientos ? newCajaMovimientos[newCajaMovimientos.length - 1].id : undefined;
        const newCaja = newCajaMovimientos !== prevCaja.movimientos ? { ...prevCaja, movimientos: newCajaMovimientos } : prevCaja;

        const newHistorial = [...prevHistorial, {
          id: reportId, habitacion: numero, problema: hab.problema || 'Sin descripción',
          reparacion, monto: montoNum, fecha: new Date().toISOString(), empleado,
        }];

        const newHabs = { ...prevHabitaciones };
        const { problema: _, ...habSinProblema } = newHabs[numero];
        newHabs[numero] = { ...habSinProblema, estado: 'Disponible' as const };

        const { [numero]: __, ...restPendientes } = prevPendientes;

        // Single set — sin mutar state directamente
        set({
          gastos: newGastos,
          caja: newCaja,
          habitaciones: newHabs,
          historialMantenimiento: newHistorial,
          mantenimientoPendientes: restPendientes,
        });
        get()._registrarAuditoria('Mantenimiento', `Resuelto: Habitación ${numero} - ${reparacion} - ${monto} - ${esDeCaja ? 'de caja' : 'pago aparte'}`);

        try {
          // Un solo llamado API: resuelve mantenimiento + crea Gasto (+ MovimientoCaja si sacarDeCaja)
          const result = await api.mantenimiento.update(reportId, { reparacion, monto: Math.round(montoNum * 100), sacarDeCaja: esDeCaja });

          // Reemplazar IDs temporales con IDs reales de la BD
          const currentGastos = get().gastos;
          const currentCaja = get().caja;
          const realGastoId = result.gasto?.id;
          const realMovId = result.movimientoCaja?.id;

          set({
            gastos: tempGastoId && realGastoId
              ? currentGastos.map(g => g.id === tempGastoId ? { ...g, id: realGastoId } : g)
              : currentGastos,
            caja: tempMovId && realMovId
              ? { ...currentCaja, movimientos: currentCaja.movimientos.map(m => m.id === tempMovId ? { ...m, id: realMovId, gastoId: realGastoId || null } : m) }
              : currentCaja,
          });
        } catch (err) {
          console.error('resolverMantenimiento error:', err);
          // Rollback COMPLETO de todos los campos modificados
          set({
            gastos: prevGastos,
            caja: prevCaja,
            habitaciones: prevHabitaciones,
            historialMantenimiento: prevHistorial,
            mantenimientoPendientes: prevPendientes,
          });
          throw err;
        }
      },

      // ===== CAJA =====
      abrirCaja: async (montoInicial) => {
        const { caja } = get();
        if (caja.estado === 'abierta') return false;
        const empleado = get().usuarioActual?.nombreCompleto || get().usuarioActual?.nombre || 'Sistema';
        set({
          caja: {
            ...caja,
            estado: 'abierta',
            apertura: { montoInicial: parseFloat(String(montoInicial)), empleado, fecha: new Date().toISOString() },
            movimientos: [],
          },
        });
        get()._registrarAuditoria('Caja', `Apertura - ${empleado} - Inicial: ${montoInicial}`);
        try {
          await api.caja.abrir(Math.round(parseFloat(String(montoInicial)) * 100));
          pushNotif('success', 'Caja abierta', `Se abrió la caja con $${montoInicial}`);
          return true;
        } catch (err) {
          console.error('abrirCaja API error:', err);
          // Rollback local state on API failure
          set({ caja });
          return false;
        }
      },

      registrarMovimientoCaja: async (tipo, monto, descripcion, metodo, categoriaGastoNombre) => {
        const { caja, gastos } = get();
        if (caja.estado !== 'abierta') return false;
        const empleado = get().usuarioActual?.nombreCompleto || get().usuarioActual?.nombre || 'Sistema';
        const tempId = generarId();
        const montoNum = parseFloat(String(monto));
        const mov: MovimientoCaja = { id: tempId, tipo, monto: montoNum, descripcion, metodo, empleado, fecha: new Date().toISOString() };

        // Si es egreso con categoría, crear gasto optimista localmente también
        const esEgresoConCategoria = tipo === 'egreso' && categoriaGastoNombre;
        let tempGastoId: string | undefined;
        let prevGastos = gastos;
        if (esEgresoConCategoria) {
          tempGastoId = generarId();
          const nuevoGasto: Gasto = {
            id: tempGastoId, tipo: categoriaGastoNombre, descripcion,
            monto: montoNum, fecha: todayLocal(), empleado,
          };
          set({ gastos: [...gastos, nuevoGasto], caja: { ...caja, movimientos: [...caja.movimientos, { ...mov, gastoId: tempGastoId }] } });
        } else {
          set({ caja: { ...caja, movimientos: [...caja.movimientos, mov] } });
        }
        get()._registrarAuditoria('Caja', `${tipo}: ${montoNum} en ${metodo} - ${descripcion}`);
        try {
          const result = await api.caja.movimiento({ tipo, monto: Math.round(montoNum * 100), descripcion, metodo, categoriaGastoNombre: esEgresoConCategoria ? categoriaGastoNombre : undefined });
          // Reemplazar IDs temporales con los reales de la BD
          const currentCaja = get().caja;
          set({
            caja: { ...currentCaja, movimientos: currentCaja.movimientos.map(m => m.id === tempId ? { ...m, id: result.id, gastoId: result.gastoId || null } : m) },
            ...(esEgresoConCategoria && tempGastoId ? {
              gastos: get().gastos.map(g => g.id === tempGastoId ? { ...g, id: result.gastoId || g.id } : g),
            } : {}),
          });
          return true;
        } catch (err) {
          console.error('registrarMovimientoCaja API error:', err);
          // Rollback: restaurar caja y gastos
          set({ caja, ...(esEgresoConCategoria ? { gastos: prevGastos } : {}) });
          return false;
        }
      },

      cerrarCaja: async (billetes, totalOtros) => {
        const { caja } = get();
        if (caja.estado !== 'abierta' || !caja.apertura) return null;

        let saldoEsperado = caja.apertura.montoInicial;
        caja.movimientos.forEach(mov => {
          if (mov.metodo === 'Efectivo') {
            saldoEsperado += mov.tipo === 'ingreso' ? mov.monto : -mov.monto;
          }
        });

        let saldoContado = 0;
        for (const [billete, cantidad] of Object.entries(billetes)) {
          saldoContado += parseInt(billete) * (cantidad || 0);
        }

        const diferencia = saldoContado - saldoEsperado;
        const empleado = get().usuarioActual?.nombreCompleto || get().usuarioActual?.nombre || 'Sistema';
        const cierre: CierreCaja = { empleado, fecha: new Date().toISOString(), saldoEsperado, saldoContado, diferencia, billetes, totalOtrosMetodos: totalOtros };

        const newCaja: CajaState = {
          estado: 'cerrada',
          apertura: null,
          movimientos: [],
          historial: [...caja.historial, { apertura: caja.apertura, cierre, movimientos: caja.movimientos }],
        };

        set({ caja: newCaja });
        get()._registrarAuditoria('Caja', `Cierre - ${empleado} - Esperado: ${saldoEsperado} Contado: ${saldoContado} Dif: ${diferencia}`);
        try {
          await api.caja.cerrar({ billetes, totalOtrosMetodos: Math.round(totalOtros * 100) });
          pushNotif('info', 'Caja cerrada', `Diferencia: $${diferencia.toFixed(2)}`);
          return cierre;
        } catch (err) {
          console.error('cerrarCaja API error:', err);
          set({ caja });
          return null;
        }
      },

      saldoActualCaja: () => {
        const { caja } = get();
        if (caja.estado !== 'abierta' || !caja.apertura) return 0;
        let saldo = caja.apertura.montoInicial;
        caja.movimientos.forEach(mov => {
          if (mov.metodo === 'Efectivo') saldo += mov.tipo === 'ingreso' ? mov.monto : -mov.monto;
        });
        return saldo;
      },

      editarMovimientoCaja: async (movimientoId, data) => {
        const { caja, gastos } = get();
        if (caja.estado !== 'abierta') return false;
        const mov = caja.movimientos.find(m => m.id === movimientoId);
        if (!mov) return false;
        try {
          const updateData: Record<string, unknown> = {};
          if (data.monto !== undefined) updateData.monto = Math.round(data.monto * 100);
          if (data.descripcion !== undefined) updateData.descripcion = data.descripcion;
          await api.caja.editarMovimiento(movimientoId, updateData);
          // Si el movimiento tiene un gasto vinculado, actualizarlo localmente también
          const nuevosGastos = mov.gastoId
            ? gastos.map(g => g.id === mov.gastoId ? { ...g, ...(data.monto !== undefined ? { monto: data.monto } : {}), ...(data.descripcion !== undefined ? { descripcion: data.descripcion } : {}) } : g)
            : gastos;
          set({
            caja: {
              ...caja,
              movimientos: caja.movimientos.map(m =>
                m.id === movimientoId ? { ...m, ...data } : m
              ),
            },
            gastos: nuevosGastos,
          });
          return true;
        } catch (err) {
          console.error('editarMovimientoCaja error:', err);
          return false;
        }
      },

      eliminarMovimientoCaja: async (movimientoId) => {
        const { caja, gastos } = get();
        if (caja.estado !== 'abierta') return false;
        const mov = caja.movimientos.find(m => m.id === movimientoId);
        try {
          const result = await api.caja.eliminarMovimiento(movimientoId);
          // Si el movimiento tenía un gasto vinculado, eliminarlo localmente también
          const deletedGastoId = result.deletedGastoId;
          set({
            caja: {
              ...caja,
              movimientos: caja.movimientos.filter(m => m.id !== movimientoId),
            },
            ...(deletedGastoId ? { gastos: gastos.filter(g => g.id !== deletedGastoId) } : {}),
          });
          return true;
        } catch (err) {
          console.error('eliminarMovimientoCaja error:', err);
          return false;
        }
      },

      // ===== GASTOS =====
      agregarGasto: async (datos) => {
        const prevGastos = get().gastos;
        const nuevo: Gasto = { id: generarId(), tipo: datos.tipo, descripcion: datos.descripcion, monto: parseFloat(String(datos.monto)), fecha: datos.fecha || todayLocal(), empleado: get().usuarioActual?.nombreCompleto || get().usuarioActual?.nombre || 'Sistema' };
        set({ gastos: [...prevGastos, nuevo] });
        get()._registrarAuditoria('Gasto', `Registro: ${datos.tipo} - ${datos.descripcion} - ${datos.monto}`);
        try {
          await api.gastos.create({ tipo: datos.tipo, descripcion: datos.descripcion, monto: Math.round(parseFloat(String(datos.monto)) * 100), fecha: datos.fecha || todayLocal(), empleado: get().usuarioActual?.nombreCompleto || 'Sistema' });
        } catch (err) {
          console.error('[agregarGasto] API error, rolling back:', err);
          set({ gastos: prevGastos });
          return null;
        }
        return nuevo;
      },

      eliminarGasto: async (id) => {
        const { gastos, caja } = get();
        const gasto = gastos.find(g => g.id === id);
        if (!gasto) return false;
        const prevGastos = gastos;
        const prevCaja = caja;
        // Buscar movimiento de caja vinculado a este gasto
        const movVinculado = caja.movimientos.find(m => m.gastoId === id);
        const newState: Record<string, unknown> = { gastos: gastos.filter(g => g.id !== id) };
        if (movVinculado && caja.estado === 'abierta') {
          newState.caja = { ...caja, movimientos: caja.movimientos.filter(m => m.id !== movVinculado.id) };
        }
        set(newState);
        get()._registrarAuditoria('Gasto', `Eliminación: ${gasto.tipo} - ${gasto.descripcion} - ${gasto.monto}`);
        try {
          const result = await api.gastos.delete(id);
          // La API devuelve deletedMovimientoId si eliminó un movimiento vinculado
          const deletedMovId = (result as any)?.deletedMovimientoId;
          if (deletedMovId && !movVinculado) {
            // El movimiento fue eliminado en el servidor pero no lo teníamos localmente
            set({
              caja: { ...get().caja, movimientos: get().caja.movimientos.filter(m => m.id !== deletedMovId) },
            });
          }
        } catch (err) {
          console.error('[eliminarGasto] API error, rolling back:', err);
          set({ gastos: prevGastos, caja: prevCaja });
          return false;
        }
        return true;
      },

      // ===== USUARIOS =====
      // Gestionado por UsuariosModule via api.usuarios (crear, actualizar, desactivar).
      // Los datos de usuarios se cargan con fetchUsuarios() directamente desde la API,
      // no se almacenan en el store ni en syncFromServer.

      // ===== TARIFAS =====
      actualizarPrecioTarifa: async (tipo, personas, precio) => {
        const { tarifas, _tarifaIds } = get();
        const tarifa = tarifas[tipo];
        if (!tarifa) return false;
        const prevTarifas = tarifas;
        // Buscar el rango que corresponde a la cantidad de personas y actualizar su precio
        const nuevosRangos = tarifa.rangos.map(r => {
          if (personas >= r.minPersonas && (r.maxPersonas === null || personas <= r.maxPersonas)) {
            return { ...r, precio };
          }
          return r;
        });
        const newTarifa = { ...tarifa, rangos: nuevosRangos };
        set({ tarifas: { ...tarifas, [tipo]: newTarifa } });
        const tarifaId = _tarifaIds[tipo];
        if (tarifaId) {
          try {
            await api.tarifas.update(tarifaId, { precios: { rangos: nuevosRangos } } as any);
          } catch (e) {
            console.error('[actualizarPrecioTarifa]', e);
            set({ tarifas: prevTarifas });
            return false;
          }
        }
        return true;
      },

      guardarTarifaCompleta: async (tipoOriginal, datos) => {
        const { tarifas, tiposTarifa, reservas, _tarifaIds } = get();
        const esNueva = tipoOriginal === 'nueva';
        const nombre = datos.nombre;
        const nuevaTarifa: TarifaPrecios = {
          modoCobro: datos.modoCobro,
          rangos: datos.rangos,
          camposPersonalizados: datos.camposPersonalizados,
          promociones: datos.promociones,
        };
        // Se envían promociones dentro del JSON de precios
        const preciosJson: any = { modoCobro: datos.modoCobro, rangos: datos.rangos };
        if (datos.promociones) preciosJson.promociones = datos.promociones;
        const apiPayload = {
          nombre,
          precios: preciosJson,
          camposPersonalizados: datos.camposPersonalizados,
          // Columnas viejas: siempre false/null (migración completa)
          choferCortesia: false,
          habitacionChofer: null,
        };
        const prevState = { tarifas, tiposTarifa, reservas, _tarifaIds };
        try {
          if (esNueva) {
            if (tiposTarifa.some(t => t.toLowerCase() === nombre.toLowerCase())) return false;
            set({ tarifas: { ...tarifas, [nombre]: nuevaTarifa }, tiposTarifa: [...tiposTarifa, nombre] });
            const created = await api.tarifas.create(apiPayload);
            const { _tarifaIds: currIds } = get();
            set({ _tarifaIds: { ...currIds, [nombre]: created.id } });
          } else {
            const newTarifas = { ...tarifas };
            const tarifaId = _tarifaIds[tipoOriginal] || _tarifaIds[nombre];
            if (nombre !== tipoOriginal) {
              newTarifas[nombre] = { ...tarifas[tipoOriginal], ...nuevaTarifa };
              delete newTarifas[tipoOriginal];
              const newTipos = tiposTarifa.map(t => t === tipoOriginal ? nombre : t);
              const newReservas = reservas.map(r => r.tipoTarifa === tipoOriginal ? { ...r, tipoTarifa: nombre } : r);
              const newTarifaIds = { ..._tarifaIds };
              if (newTarifaIds[tipoOriginal]) { newTarifaIds[nombre] = newTarifaIds[tipoOriginal]; delete newTarifaIds[tipoOriginal]; }
              set({ tarifas: newTarifas, tiposTarifa: newTipos, reservas: newReservas, _tarifaIds: newTarifaIds });
            } else {
              newTarifas[nombre] = { ...tarifas[nombre], ...nuevaTarifa };
              set({ tarifas: newTarifas });
            }
            if (tarifaId) {
              await api.tarifas.update(tarifaId, apiPayload);
            }
          }
          return true;
        } catch (err) {
          console.error('[guardarTarifaCompleta] error:', err);
          set(prevState);
          return false;
        }
      },

      agregarTipoTarifa: async (tipo) => {
        const { tarifas, tiposTarifa, _tarifaIds } = get();
        if (tiposTarifa.includes(tipo)) return false;
        const prevTarifas = tarifas;
        const prevTipos = tiposTarifa;
        const prevIds = _tarifaIds;
        const newTarifa: TarifaPrecios = { modoCobro: 'porGrupo', rangos: [{ minPersonas: 1, maxPersonas: 1, precio: 0 }, { minPersonas: 2, maxPersonas: 2, precio: 0 }, { minPersonas: 3, maxPersonas: 3, precio: 0 }, { minPersonas: 4, maxPersonas: 4, precio: 0 }], camposPersonalizados: [] };
        set({ tarifas: { ...tarifas, [tipo]: newTarifa }, tiposTarifa: [...tiposTarifa, tipo] });
        try {
          const created = await api.tarifas.create({ nombre: tipo, precios: { modoCobro: 'porGrupo', rangos: newTarifa.rangos } });
          const { _tarifaIds: currIds } = get();
          set({ _tarifaIds: { ...currIds, [tipo]: created.id } });
        } catch (e) {
          console.error('[agregarTipoTarifa]', e);
          set({ tarifas: prevTarifas, tiposTarifa: prevTipos, _tarifaIds: prevIds });
          return false;
        }
        return true;
      },

      eliminarTipoTarifa: async (tipo) => {
        const { tarifas, tiposTarifa, reservas, _tarifaIds } = get();
        const reservasActivas = reservas.filter(r => r.tipoTarifa === tipo && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'));
        if (reservasActivas.length > 0) return false;
        if (tipo === 'normal') return false;
        const prevTarifas = tarifas;
        const prevTipos = tiposTarifa;
        const prevIds = _tarifaIds;
        const newTarifas = { ...tarifas };
        delete newTarifas[tipo];
        const newIds = { ..._tarifaIds };
        delete newIds[tipo];
        set({ tarifas: newTarifas, tiposTarifa: tiposTarifa.filter(t => t !== tipo), _tarifaIds: newIds });
        const tarifaId = prevIds[tipo];
        if (tarifaId) {
          try {
            await api.tarifas.delete(tarifaId);
          } catch (e) {
            console.error('[eliminarTipoTarifa]', e);
            set({ tarifas: prevTarifas, tiposTarifa: prevTipos, _tarifaIds: prevIds });
            return false;
          }
        }
        return true;
      },

      agregarMetodoPago: async (metodo) => {
        const { metodosPago } = get();
        if (metodosPago.find(m => m.id === metodo.id)) return false;
        const prevMetodos = metodosPago;
        set({ metodosPago: [...metodosPago, metodo] });
        try {
          const created = await api.metodosPago.create({ nombre: metodo.nombre, tipo: metodo.tipo, recargo: metodo.recargo, cuotas: metodo.cuotas });
          // Reemplazar el id local con el id real de BD
          const { metodosPago: current } = get();
          set({ metodosPago: current.map(m => m.id === metodo.id ? { ...m, id: created.id } : m) });
        } catch (e) {
          console.error('[agregarMetodoPago]', e);
          set({ metodosPago: prevMetodos });
          return false;
        }
        return true;
      },

      editarMetodoPago: async (idOriginal, metodo) => {
        const { metodosPago } = get();
        const prevMetodos = metodosPago;
        set({ metodosPago: metodosPago.map(m => m.id === idOriginal ? metodo : m) });
        try {
          await api.metodosPago.update(idOriginal, { nombre: metodo.nombre, tipo: metodo.tipo, recargo: metodo.recargo, cuotas: metodo.cuotas });
        } catch (e) {
          console.error('[editarMetodoPago]', e);
          set({ metodosPago: prevMetodos });
          return false;
        }
        return true;
      },

      eliminarMetodoPago: async (id) => {
        const { metodosPago, pagos, reservas } = get();
        if (id === 'efectivo') return false;
        const metodo = metodosPago.find(m => m.id === id);
        if (!metodo) return false;
        if (pagos.some(p => p.metodo === metodo.nombre)) return false;
        if (reservas.some(r => r.metodoPagoId === id && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'))) return false;
        const prevMetodos = metodosPago;
        set({ metodosPago: metodosPago.filter(m => m.id !== id) });
        try {
          await api.metodosPago.delete(id);
        } catch (e) {
          console.error('[eliminarMetodoPago]', e);
          set({ metodosPago: prevMetodos });
          return false;
        }
        return true;
      },

      agregarCategoriaGasto: async (categoria) => {
        const { categoriasGastos, _categoriaGastoIds } = get();
        if (categoriasGastos.includes(categoria)) return false;
        const prevCats = categoriasGastos;
        const prevIds = _categoriaGastoIds;
        set({ categoriasGastos: [...categoriasGastos, categoria] });
        try {
          const created = await api.categoriasGasto.create({ nombre: categoria });
          const { _categoriaGastoIds: currIds } = get();
          set({ _categoriaGastoIds: { ...currIds, [categoria]: created.id } });
        } catch (e) {
          console.error('[agregarCategoriaGasto]', e);
          set({ categoriasGastos: prevCats, _categoriaGastoIds: prevIds });
          return false;
        }
        return true;
      },

      editarCategoriaGasto: async (nombreOriginal, nombreNuevo) => {
        const { categoriasGastos, gastos, _categoriaGastoIds } = get();
        const prevCats = categoriasGastos;
        const prevGastos = gastos;
        const prevIds = _categoriaGastoIds;
        const newCats = categoriasGastos.map(c => c === nombreOriginal ? nombreNuevo : c);
        const newGastos = gastos.map(g => g.tipo === nombreOriginal ? { ...g, tipo: nombreNuevo } : g);
        const newIds = { ..._categoriaGastoIds };
        if (newIds[nombreOriginal]) { newIds[nombreNuevo] = newIds[nombreOriginal]; delete newIds[nombreOriginal]; }
        set({ categoriasGastos: newCats, gastos: newGastos, _categoriaGastoIds: newIds });
        const catId = _categoriaGastoIds[nombreOriginal];
        if (catId) {
          try {
            await api.categoriasGasto.update(catId, { nombre: nombreNuevo });
          } catch (e) {
            console.error('[editarCategoriaGasto]', e);
            set({ categoriasGastos: prevCats, gastos: prevGastos, _categoriaGastoIds: prevIds });
            return false;
          }
        }
        return true;
      },

      eliminarCategoriaGasto: async (categoria) => {
        const { categoriasGastos, gastos, _categoriaGastoIds } = get();
        if (gastos.some(g => g.tipo === categoria)) return false;
        const catId = _categoriaGastoIds[categoria];
        const prevCats = categoriasGastos;
        const prevIds = _categoriaGastoIds;
        const newIds = { ..._categoriaGastoIds };
        delete newIds[categoria];
        set({ categoriasGastos: categoriasGastos.filter(c => c !== categoria), _categoriaGastoIds: newIds });
        if (catId) {
          try {
            await api.categoriasGasto.delete(catId);
          } catch (e) {
            console.error('[eliminarCategoriaGasto]', e);
            set({ categoriasGastos: prevCats, _categoriaGastoIds: prevIds });
            return false;
          }
        }
        return true;
      },



      // ===== SYNC FROM SERVER =====
      syncFromServer: async () => {
        try {
          // Validar que el tenantId del store coincida (si existe usuarioActual)
          // Esto previene mezcla de datos entre hoteles
          const currentTenantId = get().usuarioActual?.tenantId;

          // Single endpoint — uses requireTenantId() (no module permission).
          // This ensures ALL modules can read shared data regardless of permissions.
          // Write operations remain protected by requirePermission() on their own routes.
          const data = await api.sync.get();

          // Map habitaciones
          const habitaciones: Record<string, Habitacion> = {};
          for (const h of data.habitaciones) {
            habitaciones[h.numero] = {
              numero: h.numero, tipo: h.tipo, capacidad: h.capacidad,
              camasMatrimoniales: h.camasMatrimoniales, camasSimples: h.camasSimples,
              estado: h.estado as EstadoHabitacion,
              problema: h.problema || undefined,
              precioPorCama: h.precioPorCama || undefined,
            };
          }

          // Map clientes
          const clientes: Cliente[] = data.clientes.map((c: any) => ({
            id: c.id, nombre: c.nombre, dni: c.dni, telefono: c.telefono,
            email: c.email || '', preferencias: c.preferencias || '',
            historialEstadias: [], fechaCreacion: c.createdAt?.split('T')[0] || '',
          }));

          // Map reservas
          const reservas: Reserva[] = data.reservas.map((r: any) => mapDbReservaToStore(r));

          // Map metodos de pago FIRST (needed to resolve metodo IDs in pagos)
          const metodosPago: MetodoPago[] = data.metodosPago.map((m: any) => ({
            id: m.id, nombre: m.nombre, tipo: m.tipo as MetodoPago['tipo'],
            recargo: m.recargo, cuotas: m.cuotas || [],
          }));
          const metodoIdToName = new Map(metodosPago.map(m => [m.id, m.nombre]));

          // Map pagos (monto from centavos to pesos, resolve metodo IDs to names for legacy data)
          const pagos: Pago[] = data.pagos.map((p: any) => ({
            id: p.id, idReserva: p.reservaId, monto: p.monto / 100,
            metodo: metodoIdToName.get(p.metodo) || p.metodo,
            fecha: p.fecha?.split('T')[0] || p.fecha, nota: p.nota || '',
          }));

          // Map gastos (monto from centavos to pesos)
          const gastos: Gasto[] = data.gastos.map((g: any) => ({
            id: g.id, tipo: g.tipo, descripcion: g.descripcion, monto: g.monto / 100,
            fecha: g.fecha?.split('T')[0] || g.fecha, empleado: g.empleado || 'Sistema',
          }));

          // Map tarifas (con migración automática del formato viejo al nuevo)
          const tarifas: Record<string, TarifaPrecios> = {};
          const tiposTarifa: string[] = [];
          const _tarifaIds: Record<string, string> = {};
          for (const t of data.tarifas) {
            const preciosData = t.precios as any;
            // modoCobro viene dentro del JSON de precios (nuevo formato) o por defecto 'porGrupo' (viejo)
            const modoCobro: ModoCobro = preciosData?.modoCobro || 'porGrupo';
            const rangos = normalizarRangos(preciosData);
            // Si no se detectaron rangos (datos vacíos), crear rangos por defecto
            const rangosFinales = rangos.length > 0
              ? rangos
              : [{ minPersonas: 1, maxPersonas: 1, precio: 0 }, { minPersonas: 2, maxPersonas: 2, precio: 0 }, { minPersonas: 3, maxPersonas: 3, precio: 0 }, { minPersonas: 4, maxPersonas: 4, precio: 0 }];
            tarifas[t.nombre] = {
              modoCobro,
              rangos: rangosFinales,
              camposPersonalizados: (t.camposPersonalizados || []) as any[],
              // Nuevas promociones: vienen dentro del JSON de precios
              promociones: (preciosData?.promociones || undefined) as PromocionesTarifa | undefined,
              // Datos viejos (para migración en getPromocionesEfectivas)
              choferCortesia: t.choferCortesia, habitacionChofer: t.habitacionChofer || null,
            };
            tiposTarifa.push(t.nombre);
            _tarifaIds[t.nombre] = t.id;
          }



          // Map categorias de gasto
          const categoriasGastos: string[] = [];
          const _categoriaGastoIds: Record<string, string> = {};
          for (const c of data.categoriasGasto) {
            categoriasGastos.push(c.nombre);
            _categoriaGastoIds[c.nombre] = c.id;
          }

          // Map caja (turno actual + historial)
          const caja: CajaState = mapDbCajaToStore({
            turnoActual: data.turnoActual,
            historial: data.historialTurnos || [],
          });

          // ─── Derivar estados de habitación desde reservas activas ───
          //
          // Estrategia: primero recopilar la "señal más fuerte" por habitación
          // desde las reservas, luego aplicar con prioridad:
          //   1. CheckIn_realizado → Ocupada (siempre gana, incluso en compartidas)
          //   2. Si la habitación está Ocupada en BD pero NO hay CheckIn → corregir
          //   3. Confirmada → Reservada (solo si la habitación está Disponible)
          //   4. Mantenimiento pendiente → Mantenimiento (a menos que esté Ocupada)
          //   5. Limpieza pendiente → Limpieza (solo si la habitación quedó Disponible)
          //
          // El DB estado es el punto de partida; estas reglas lo corrigen si está stale.

          const roomReservaSignals: Record<string, { hasCheckIn: boolean; hasConfirmed: boolean }> = {};
          for (const r of data.reservas) {
            if (!habitaciones[r.habitacion]) continue;
            if (!roomReservaSignals[r.habitacion]) {
              roomReservaSignals[r.habitacion] = { hasCheckIn: false, hasConfirmed: false };
            }
            if (r.estado === 'CheckIn_realizado') roomReservaSignals[r.habitacion].hasCheckIn = true;
            if (r.estado === 'Confirmada') roomReservaSignals[r.habitacion].hasConfirmed = true;
          }

          for (const [numero, hab] of Object.entries(habitaciones)) {
            const signals = roomReservaSignals[numero];

            if (signals?.hasCheckIn) {
              // Prioridad máxima: hay alguien check-in → siempre Ocupada
              hab.estado = 'Ocupada';
            } else if (hab.estado === 'Ocupada') {
              // Estado stale: BD dice Ocupada pero no hay CheckIn activo.
              // Corregir a Disponible; los overrides de limpieza/mantenimiento abajo
              // ajustarán si es necesario.
              hab.estado = 'Disponible';
            } else if (signals?.hasConfirmed && (hab.estado === 'Disponible')) {
              // Hay reserva confirmada y la habitación está libre → Reservada
              hab.estado = 'Reservada';
            }
          }

          // Override: mantenimiento pendiente (no si la habitación está Ocupada por check-in)
          const pendientes: Record<string, string> = {};
          const historial: HistorialMantenimientoEntry[] = [];
          for (const r of data.mantenimientoReports) {
            if (!r.resuelto) {
              pendientes[r.habitacion] = r.id;
              const hab = habitaciones[r.habitacion];
              if (hab && hab.estado !== 'Ocupada') {
                hab.estado = 'Mantenimiento';
                hab.problema = r.problema;
              }
            } else {
              historial.push({
                id: r.id, habitacion: r.habitacion, problema: r.problema,
                reparacion: r.reparacion || '', monto: (r.monto || 0) / 100,
                fecha: r.fecha, empleado: r.empleado,
              });
            }
          }

          // Override: limpieza pendiente (solo si la habitación quedó Disponible
          // después de todos los overrides anteriores)
          for (const t of data.limpiezaTasks) {
            const hab = habitaciones[t.habitacion];
            if (hab && hab.estado === 'Disponible') {
              hab.estado = 'Limpieza';
            }
          }

          // Mapear auditoría desde BD (ordenadas por createdAt desc del servidor)
          const auditoria: AuditoriaEntry[] = (data.auditoria || []).map((a: any) => ({
            id: a.id,
            tipo: a.tipo,
            detalle: a.detalle,
            empleado: a.empleado,
            fecha: a.createdAt,
          }));

          // Validar tenantId después de obtener datos (el server ya filtra, pero
          // doble comprobación para evitar escribir datos de otro hotel en el store)
          if (currentTenantId && data.tenantId && data.tenantId !== currentTenantId) {
            console.warn('[syncFromServer] tenantId mismatch, ignorando datos. Store:', currentTenantId, 'Data:', data.tenantId);
            return;
          }

          set({
            habitaciones, clientes, reservas, pagos, gastos, tarifas,
            tiposTarifa, metodosPago, categoriasGastos, caja,
            _categoriaGastoIds, _tarifaIds,
            mantenimientoPendientes: pendientes, historialMantenimiento: historial,
            auditoria,
            _synced: true,
          });

          // Refrescar usuarioActual con permisos frescos de la BD
          try {
            const meParams = new URLSearchParams();
            const currentUser = get().usuarioActual;
            if (currentUser?.tenantId) meParams.set('tenantId', currentUser.tenantId);
            if (currentUser?.tenantUserId) meParams.set('profileId', currentUser.tenantUserId);
            const meUrl = `/api/auth/me${meParams.toString() ? '?' + meParams.toString() : ''}`;
            const meRes = await fetch(meUrl, { cache: 'no-store' });
            if (meRes.ok) {
              const meData = await meRes.json();
              if (meData.tenantId && !meData.selectHotel && !meData.needsSetup && !meData.selectProfile && !meData.error && !meData.needsPassword) {
                const freshSesion: UsuarioSesion = {
                  id: meData.id,
                  tenantUserId: meData.tenantUserId,
                  nombre: meData.nombre,
                  nombreCompleto: meData.nombreCompleto,
                  permisos: meData.permisos || [],
                  rol: meData.rol,
                  tenantId: meData.tenantId,
                  tenantNombre: meData.tenantNombre,
                  email: meData.email,
                };
                set({ usuarioActual: freshSesion });
                // Refrescar plan/fechas si vienen
                if (meData.fechaInicioTrial) set({ fechaInicioTrial: meData.fechaInicioTrial });
                if (meData.subscriptionVencimiento) set({ fechaVencimientoTrial: meData.subscriptionVencimiento });
                if (meData.planActual) set({ planActual: meData.planActual });
              }
            }
          } catch (e) {
            // No bloquear el sync si el refresh de permisos falla
            console.warn('[syncFromServer] No se pudo refrescar permisos:', e);
          }
        } catch (err) {
          console.error('[syncFromServer] Error sincronizando datos:', err);
        }
      },

            // ===== RESET =====
      resetData: () => set({
        habitaciones: defaultHabitaciones,
        reservas: defaultReservas,
        clientes: defaultClientes,
        pagos: defaultPagos,
        // usuarios: no se almacena en el store
        gastos: defaultGastos,
        auditoria: [],
        caja: { estado: 'cerrada', apertura: null, movimientos: [], historial: [] },
        historialMantenimiento: [],
        mantenimientoPendientes: {},
        tarifas: defaultTarifas,
        tiposTarifa: ['compartida'],
        metodosPago: defaultMetodosPago,
        categoriasGastos: defaultCategoriasGastos,
      }),
    })
);
/**
 * Wrapper de fetch para llamar a la API del hotel.
 * Incluye manejo de errores, redirección a login si 401, y CSRF tokens.
 */

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ── CSRF token management (client-side) ──

let _csrfToken: string | null = null;

async function getCsrfToken(): Promise<string | null> {
  if (_csrfToken) return _csrfToken;
  try {
    const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      _csrfToken = data.csrfToken || null;
    }
  } catch {
    // Si falla, no hay token — el request se enviará sin header
    // El backend decidirá si rechazarlo
  }
  return _csrfToken;
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `/api${path}`;
  const method = options?.method || 'GET';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  // ── Agregar CSRF token en mutations ──
  if (MUTATION_METHODS.has(method.toUpperCase())) {
    const token = await getCsrfToken();
    if (token) {
      headers['X-CSRF-Token'] = token;
    }
  }

  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  // ── Si el CSRF token expiró (403), limpiar y reintentar una vez ──
  if (res.status === 403 && method !== 'GET') {
    _csrfToken = null;
    const newToken = await getCsrfToken();
    if (newToken) {
      headers['X-CSRF-Token'] = newToken;
      const retryRes = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers,
      });
      // Si el retry funciona, usar esa respuesta
      if (retryRes.ok || retryRes.status !== 403) {
        let retryData: any;
        try { retryData = await retryRes.json(); } catch { retryData = {}; }
        if (!retryRes.ok) {
          const msg = retryData.error || `Error ${retryRes.status}`;
          if (retryRes.status === 401) throw new ApiError(msg, 401);
          throw new ApiError(msg, retryRes.status);
        }
        return retryData as T;
      }
    }
  }

  // Intentar parsear JSON; si falla (ej. respuesta vacía), usar objeto vacío
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const msg = data.error || `Error ${res.status}`;
    if (res.status === 401) {
      console.error(`[apiFetch] 401 en ${method} ${path}:`, msg);
      throw new ApiError(msg, 401);
    }
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

// ═══════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════

export const api = {
  // ── Habitaciones ──
  habitaciones: {
    list: () => apiFetch<DbHabitacion[]>('/habitaciones'),
    create: (data: CreateHabitacion) =>
      apiFetch<DbHabitacion>('/habitaciones', { method: 'POST', body: JSON.stringify(data) }),
    update: (numero: string, data: UpdateHabitacion) =>
      apiFetch<DbHabitacion>(`/habitaciones/${encodeURIComponent(numero)}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (numero: string) =>
      apiFetch<{ success: boolean }>(`/habitaciones/${encodeURIComponent(numero)}`, { method: 'DELETE' }),
  },

  // ── Clientes ──
  clientes: {
    list: (q?: string) => apiFetch<DbCliente[]>(`/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
    get: (id: string) => apiFetch<DbClienteDetail>(`/clientes/${id}`),
    create: (data: CreateCliente) =>
      apiFetch<DbCliente>('/clientes', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateCliente>) =>
      apiFetch<DbCliente>(`/clientes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/clientes/${id}`, { method: 'DELETE' }),
  },

  // ── Reservas ──
  reservas: {
    list: (params?: { estado?: string; habitacion?: string; desde?: string; hasta?: string; q?: string }) => {
      const sp = new URLSearchParams();
      if (params?.estado) sp.set('estado', params.estado);
      if (params?.habitacion) sp.set('habitacion', params.habitacion);
      if (params?.desde) sp.set('desde', params.desde);
      if (params?.hasta) sp.set('hasta', params.hasta);
      if (params?.q) sp.set('q', params.q);
      const qs = sp.toString();
      return apiFetch<DbReserva[]>(`/reservas${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => apiFetch<DbReservaDetail>(`/reservas/${id}`),
    create: (data: CreateReserva) =>
      apiFetch<DbReserva>('/reservas', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateReserva>) =>
      apiFetch<DbReserva>(`/reservas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    cancel: (id: string) =>
      apiFetch<DbReserva>(`/reservas/${id}`, { method: 'DELETE' }),
    checkin: (id: string, body?: Record<string, any>) =>
      apiFetch<DbReserva>(`/reservas/${id}/checkin`, { method: 'POST', body: JSON.stringify(body || {}) }),
    checkout: (id: string, body?: { fechaCheckoutReal?: string }) =>
      apiFetch<{ noches: number; total: number }>(`/reservas/${id}/checkout`, { method: 'POST', body: JSON.stringify(body || {}) }),
  },

  // ── Pagos ──
  pagos: {
    list: (params?: { reservaId?: string; desde?: string; hasta?: string }) => {
      const sp = new URLSearchParams();
      if (params?.reservaId) sp.set('reservaId', params.reservaId);
      if (params?.desde) sp.set('desde', params.desde);
      if (params?.hasta) sp.set('hasta', params.hasta);
      const qs = sp.toString();
      return apiFetch<DbPago[]>(`/pagos${qs ? `?${qs}` : ''}`);
    },
    create: (data: { reservaId: string; monto: number; metodo: string; nota?: string }) =>
      apiFetch<DbPago>('/pagos', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/pagos/${id}`, { method: 'DELETE' }),
  },

  // ── Tarifas ──
  tarifas: {
    list: () => apiFetch<DbTarifa[]>('/tarifas'),
    get: (id: string) => apiFetch<DbTarifa>(`/tarifas/${id}`),
    create: (data: CreateTarifa) =>
      apiFetch<DbTarifa>('/tarifas', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateTarifa>) =>
      apiFetch<DbTarifa>(`/tarifas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/tarifas/${id}`, { method: 'DELETE' }),
  },

  // ── Métodos de Pago ──
  metodosPago: {
    list: () => apiFetch<DbMetodoPago[]>('/metodos-pago'),
    create: (data: CreateMetodoPago) =>
      apiFetch<DbMetodoPago>('/metodos-pago', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateMetodoPago>) =>
      apiFetch<DbMetodoPago>(`/metodos-pago/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/metodos-pago/${id}`, { method: 'DELETE' }),
  },

  // ── Gastos ──
  gastos: {
    list: (params?: { desde?: string; hasta?: string; tipo?: string }) => {
      const sp = new URLSearchParams();
      if (params?.desde) sp.set('desde', params.desde);
      if (params?.hasta) sp.set('hasta', params.hasta);
      if (params?.tipo) sp.set('tipo', params.tipo);
      const qs = sp.toString();
      return apiFetch<DbGasto[]>(`/gastos${qs ? `?${qs}` : ''}`);
    },
    create: (data: CreateGasto) =>
      apiFetch<DbGasto>('/gastos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CreateGasto>) =>
      apiFetch<DbGasto>(`/gastos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/gastos/${id}`, { method: 'DELETE' }),
  },

  // ── Categorías de Gasto ──
  categoriasGasto: {
    list: () => apiFetch<DbCategoriaGasto[]>('/categorias-gasto'),
    create: (data: { nombre: string; orden?: number }) =>
      apiFetch<DbCategoriaGasto>('/categorias-gasto', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { nombre?: string; orden?: number }) =>
      apiFetch<DbCategoriaGasto>(`/categorias-gasto/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/categorias-gasto/${id}`, { method: 'DELETE' }),
  },

  // ── Caja ──
  caja: {
    get: (params?: { desde?: string; hasta?: string }) => {
      const sp = new URLSearchParams();
      if (params?.desde) sp.set('desde', params.desde);
      if (params?.hasta) sp.set('hasta', params.hasta);
      const qs = sp.toString();
      return apiFetch<DbCajaState>(`/caja${qs ? `?${qs}` : ''}`);
    },
    abrir: (montoInicial: number) =>
      apiFetch<DbTurnoCaja>('/caja/abrir', { method: 'POST', body: JSON.stringify({ montoInicial }) }),
    cerrar: (data: { billetes: Record<number, number>; totalOtrosMetodos: number; notas?: string; discrepancyExplain?: string }) =>
      apiFetch<DbTurnoCaja>('/caja/cerrar', { method: 'POST', body: JSON.stringify(data) }),
    movimiento: (data: { tipo: string; monto: number; descripcion: string; metodo?: string; reservaId?: string; categoriaGastoNombre?: string }) =>
      apiFetch<DbMovimientoCaja>('/caja/movimiento', { method: 'POST', body: JSON.stringify(data) }),
    editarMovimiento: (movimientoId: string, data: { monto?: number; descripcion?: string }) =>
      apiFetch<{ movimiento: DbMovimientoCaja; gasto?: DbGasto | null }>(`/caja/movimiento?id=${encodeURIComponent(movimientoId)}`, { method: 'PUT', body: JSON.stringify(data) }),
    eliminarMovimiento: (movimientoId: string) =>
      apiFetch<{ success: boolean; deletedGastoId?: string | null }>(`/caja/movimiento?id=${encodeURIComponent(movimientoId)}`, { method: 'DELETE' }),
  },

  // ── Limpieza ──
  limpieza: {
    list: (estado?: string) => apiFetch<DbTareaLimpieza[]>(`/limpieza${estado ? `?estado=${estado}` : ''}`),
    create: (data: { habitacion: string; nota?: string; prioridad?: string; tipo?: string }) =>
      apiFetch<DbTareaLimpieza>('/limpieza', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { estado?: string; empleadoId?: string; empleado?: string; nota?: string; prioridad?: string; tipo?: string }) =>
      apiFetch<DbTareaLimpieza>(`/limpieza/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ── Mantenimiento ──
  mantenimiento: {
    list: (resuelto?: string) => apiFetch<DbMantenimiento[]>(`/mantenimiento${resuelto !== undefined ? `?resuelto=${resuelto}` : ''}`),
    create: (data: { habitacion: string; problema: string; empleado?: string; bloquear?: boolean; hasta?: string | null }) =>
      apiFetch<DbMantenimiento>('/mantenimiento', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { reparacion?: string; monto?: number; sacarDeCaja?: boolean }) =>
      apiFetch<{ mantenimiento: DbMantenimiento; gasto?: DbGasto | null; movimientoCaja?: DbMovimientoCaja | null }>(`/mantenimiento/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // ── Usuarios ──
  usuarios: {
    list: (rol?: string) => apiFetch<DbTenantUser[]>(`/usuarios${rol ? `?rol=${rol}` : ''}`),
    create: (data: { nombreCompleto: string; password: string; rol: string; permisos: string[] }) =>
      apiFetch<DbTenantUser>('/usuarios', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { nombreCompleto?: string; rol?: string; permisos?: string[]; activo?: boolean; password?: string }) =>
      apiFetch<DbTenantUser>(`/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<{ success: boolean }>(`/usuarios/${id}`, { method: 'DELETE' }),
  },

  // ── Configuracion ──
  configuracion: {
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      apiFetch<{ success: boolean }>('/configuracion/password', { method: 'PUT', body: JSON.stringify(data) }),
    precioCama: {
      get: () => apiFetch<{ precioPorCamaGlobal: number | null }>('/configuracion/precio-cama'),
      set: (precio: number) =>
        apiFetch<{ success: boolean; precioPorCamaGlobal: number }>('/configuracion/precio-cama', { method: 'PUT', body: JSON.stringify({ precio }) }),
    },
  },

  // ── Dashboard ──
  dashboard: {
    get: () => apiFetch<DbDashboard>('/dashboard'),
  },

  // ── Sync (carga inicial) ──
  sync: {
    get: () => apiFetch<DbSyncData>('/sync'),
  },

  // ── Reportes ──
  reportes: {
    get: (tipo?: string) => apiFetch<DbReportes>(`/reportes${tipo ? `?tipo=${tipo}` : ''}`),
  },

  // ── Presence (online status) ──
  presence: {
    heartbeat: () => apiFetch<{ ok: boolean }>('/presence/heartbeat', { method: 'POST' }),
    online: () => apiFetch<{ onlineUserIds: string[]; onlineCount: number }>('/presence/online'),
  },
};

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface DbHabitacion {
  id: string; tenantId: string; numero: string; tipo: string;
  capacidad: number; camasMatrimoniales: number; camasSimples: number;
  estado: string; problema?: string | null; precioPorCama?: number | null;
  bloqueaDisponibilidad?: boolean; bloqueadoHasta?: string | null;
  piso?: number | null; orden: number; createdAt: string; updatedAt: string;
}
export interface CreateHabitacion {
  numero: string; tipo: string; capacidad: number;
  camasMatrimoniales: number; camasSimples: number;
  precioPorCama?: number; piso?: number;
}
export interface UpdateHabitacion {
  numero?: string; tipo?: string; capacidad?: number;
  camasMatrimoniales?: number; camasSimples?: number;
  precioPorCama?: number | null; piso?: number | null;
  estado?: string;
}

export interface DbCliente {
  id: string; nombre: string; dni: string; telefono: string;
  email?: string | null; fechaNacimiento?: string | null;
  nacionalidad?: string | null; domicilio?: string | null; preferencias: string;
  createdAt: string; _count?: { reservas: number; estadias: number };
}
export interface DbClienteDetail extends DbCliente {
  estadias: { id: string; fechaCheckin: string; fechaCheckout: string; habitacion: string; gastoTotal: number }[];
  reservas: { id: string; habitacion: string; checkin: string; checkout: string; estado: string }[];
}
export interface CreateCliente {
  nombre: string; dni: string; telefono: string;
  email?: string; fechaNacimiento?: string;
  nacionalidad?: string; domicilio?: string; preferencias?: string;
}

export interface DbAcompanante { id: string; nombre: string; dni: string; celular?: string | null; }
export interface DbMenor { id: string; nombre: string; documento: string; edad: number; parentesco: string; }
export interface DbPago {
  id: string; tenantId: string; reservaId: string;
  monto: number; metodo: string; nota: string; fecha: string;
}
export interface DbReserva {
  id: string; tenantId: string; clienteId?: string | null;
  huesped: string; dni: string; telefono: string;
  email?: string | null; habitacion: string;
  checkin: string; checkout: string; personas: number;
  estadoPago: string; estado: string;
  tipoTarifa?: string | null; metodoPagoId?: string | null;
  cuotas?: number | null; recargoPorcentaje?: number | null;
  notas: string; observacionesHuesped?: string | null;
  agenciaNombre?: string | null; agenciaConvenio?: string | null;
  contactoEmergenciaNombre?: string | null; contactoEmergenciaTel?: string | null;
  horaCheckin?: string | null; horaCheckout?: string | null;
  acompanantes?: DbAcompanante[];
  menores?: DbMenor[];
}
export interface DbReservaDetail extends DbReserva {
  pagos: DbPago[];
  acompanantes: DbAcompanante[];
  menores: DbMenor[];
  totalPagado: number;
}
export interface CreateReserva {
  clienteId?: string; huesped: string; dni: string;
  telefono: string; email?: string; domicilio?: string;
  habitacion: string; checkin: string; checkout: string;
  personas: number; tipoTarifa?: string;
  metodoPagoId?: string; cuotas?: number; recargoPorcentaje?: number;
  notas?: string; observacionesHuesped?: string;
  agenciaNombre?: string; agenciaConvenio?: string; agenciaVendedor?: string;
  contactoEmergenciaNombre?: string; contactoEmergenciaTel?: string;
  acompanantes?: { nombre: string; dni: string; celular?: string }[];
}

export interface DbRangoPrecio {
  minPersonas: number;
  maxPersonas: number | null; // null = "y más"
  precio: number;
}

export interface DbTarifa {
  id: string; nombre: string;
  precios: any; // { modoCobro?, rangos? } o formato viejo { "1": 35000, ... }
  camposPersonalizados?: { nombre: string; tipo: string; requerido: boolean }[] | null;
  choferCortesia: boolean; habitacionChofer?: string | null;
  activa: boolean; orden: number;
}
export interface CreateTarifa {
  nombre: string;
  precios: any;
  camposPersonalizados?: { nombre: string; tipo: string; requerido: boolean }[];
  choferCortesia?: boolean; habitacionChofer?: string | null;
  activa?: boolean; orden?: number;
}

export interface DbMetodoPago {
  id: string; nombre: string; tipo: string;
  recargo: boolean; cuotas?: { cantidad: number; porcentaje: number }[] | null;
  activo: boolean; orden: number;
}
export interface CreateMetodoPago {
  nombre: string; tipo: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';
  recargo?: boolean; cuotas?: { cantidad: number; porcentaje: number }[];
  activo?: boolean; orden?: number;
}

export interface DbGasto {
  id: string; tipo: string; descripcion: string;
  monto: number; fecha: string; empleado: string;
}
export interface CreateGasto {
  tipo: string; descripcion: string; monto: number;
  fecha: string; empleado?: string;
}

export interface DbCategoriaGasto { id: string; nombre: string; orden: number; }

export interface DbMovimientoCaja {
  id: string; turnoId: string; tipo: string; monto: number;
  descripcion: string; metodo: string; empleadoNombre: string;
  reservaId?: string | null; gastoId?: string | null; fecha: string;
}
export interface DbTurnoCaja {
  id: string; estado: string; montoInicial: number;
  empleadoNombre: string; fechaApertura: string;
  fechaCierre?: string | null; saldoEsperado?: number | null;
  saldoContado?: number | null; diferencia?: number | null;
  billetes?: Record<number, number> | null; totalOtrosMetodos?: number | null;
  notas?: string | null; discrepancyExplain?: string | null;
  movimientos?: DbMovimientoCaja[];
}
export interface DbCajaState {
  turnoActual: (DbTurnoCaja & { movimientos: DbMovimientoCaja[] }) | null;
  historial: DbTurnoCaja[];
}

export interface DbTareaLimpieza {
  id: string; habitacion: string; estado: string;
  prioridad: string; // urgente, normal, baja
  tipo: string; // limpieza, mantenimiento, preparacion, inspeccion
  empleadoId?: string | null; empleado?: string | null;
  nota?: string | null; fechaCreacion: string; fechaCompletado?: string | null;
}
export interface DbMantenimiento {
  id: string; habitacion: string; problema: string;
  reparacion?: string | null; monto?: number | null;
  fecha: string; empleado: string; resuelto: boolean;
}

export interface DbAuditoria {
  id: string; tipo: string; detalle: string;
  empleado: string; createdAt: string;
}

export interface DbTenantUser {
  id: string; userId?: string | null;
  rol: string; nombreUsuario?: string | null;
  nombreCompleto?: string | null; permisos: string[];
  activo: boolean;
  user?: { id: string; email: string; name?: string | null; phone?: string | null };
}

export interface DbDashboard {
  habitaciones: { total: number; disponibles: number; ocupadas: number; limpieza: number; mantenimiento: number; reservadas: number; fueraDeServicio: number };
  reservas: { activas: number; hoyCheckin: number; hoyCheckout: number; confirmadas: number; canceladas: number };
  ingresos: { mesActual: number; mesAnterior: number; variacion: number };
  caja: { abierta: boolean; saldoActual: number };
  ultimosMovimientos: DbMovimientoCaja[];
  proxChekins: DbReserva[];
}

export interface DbReportes {
  ocupacion?: { mes: string; tasa: number }[];
  ingresos?: { mes: string; total: number }[];
  gastos?: { mes: string; total: number }[];
  metodosPago?: { metodo: string; total: number; cantidad: number }[];
}

export interface DbSyncData {
  tenantId: string;
  habitaciones: DbHabitacion[];
  clientes: DbCliente[];
  reservas: DbReserva[];
  pagos: DbPago[];
  gastos: DbGasto[];
  tarifas: DbTarifa[];
  metodosPago: DbMetodoPago[];
  categoriasGasto: DbCategoriaGasto[];
  turnoActual: (DbTurnoCaja & { movimientos: DbMovimientoCaja[] }) | null;
  historialTurnos: (DbTurnoCaja & { movimientos: DbMovimientoCaja[] })[];
  limpiezaTasks: DbTareaLimpieza[];
  mantenimientoReports: DbMantenimiento[];
  auditoria: DbAuditoria[];
  precioPorCamaGlobal: number | null;
}

export { ApiError };
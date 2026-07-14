import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Habitacion, Cliente, Reserva, Pago, Usuario, Gasto,
  AuditoriaEntry, CajaState, TarifaPrecios, MetodoPago,
  HistorialMantenimientoEntry, UsuarioSesion, ModuloId,
  HabitacionDisponible, MovimientoCaja, CierreCaja, Estadia
} from './types';
import { type PlanTipo, modulosEfectivos as calcModulosEfectivos } from './plan-config';

// ==================== DEFAULT DATA ====================

const defaultHabitaciones: Record<string, Habitacion> = {};

const defaultReservas: Reserva[] = [];

const defaultClientes: Cliente[] = [];

const defaultPagos: Pago[] = [];

const defaultUsuarios: Usuario[] = [];

const defaultGastos: Gasto[] = [];

const defaultTarifas: Record<string, TarifaPrecios> = {
  compartida: { 1: 0, 2: 0, 3: 0, 4: 0, camposPersonalizados: [], choferCortesia: false, habitacionChofer: null },
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

function generarId(coleccion: { id: number }[]): number {
  if (coleccion.length === 0) return 1;
  return Math.max(...coleccion.map(item => item.id)) + 1;
}

function nochesEntre(checkin: string, checkout: string): number {
  const fechaIn = new Date(checkin + 'T12:00:00');
  const fechaOut = new Date(checkout + 'T12:00:00');
  return Math.max(1, Math.ceil((fechaOut.getTime() - fechaIn.getTime()) / (1000 * 60 * 60 * 24)));
}

function calcularTotalSegunTarifa(
  tarifas: Record<string, TarifaPrecios>,
  tipoTarifa: string,
  personas: number,
  noches: number,
  esCompartida: boolean,
  precioPorCama?: number
): number {
  if (esCompartida) {
    const precio = precioPorCama || (tarifas as Record<string, TarifaPrecios & { precioPorCama?: number }>)['_global']?.precioPorCama || 17000;
    return noches * personas * precio;
  }
  const tarifa = tarifas[tipoTarifa];
  if (tarifa) {
    const precioPorPersona = tarifa[personas] || tarifa[Object.keys(tarifa).find(k => !isNaN(Number(k))) as unknown as number] || 0;
    return noches * personas * precioPorPersona;
  }
  const normal = tarifas?.normal;
  if (normal) {
    const precioPorPersona = normal[personas] || normal[Object.keys(normal).find(k => !isNaN(Number(k))) as unknown as number] || 0;
    return noches * personas * precioPorPersona;
  }
  return 0;
}

// ==================== STORE INTERFACE ====================

interface HotelStore {
  // Data
  habitaciones: Record<string, Habitacion>;
  reservas: Reserva[];
  clientes: Cliente[];
  pagos: Pago[];
  usuarios: Usuario[];
  gastos: Gasto[];
  auditoria: AuditoriaEntry[];
  caja: CajaState;
  historialMantenimiento: HistorialMantenimientoEntry[];
  tarifas: Record<string, TarifaPrecios>;
  tiposTarifa: string[];
  metodosPago: MetodoPago[];
  categoriasGastos: string[];

  // UI State
  usuarioActual: UsuarioSesion | null;
  moduloActivo: ModuloId;
  sidebarOpen: boolean;
  perfilOpen: boolean;
  setModulo: (modulo: ModuloId) => void;
  setSidebarOpen: (open: boolean) => void;
  setPerfilOpen: (open: boolean) => void;

  // Plan / Suscripción
  planActual: PlanTipo;
  fechaInicioTrial: string | null;
  moduloBloqueado: ModuloId | null;
  setModuloBloqueado: (m: ModuloId | null) => void;
  setPlanActual: (p: PlanTipo) => void;

  // Auth
  loginFromSession: (sessionData: Record<string, any>) => Promise<boolean>;
  logout: () => void;

  // Auditoria
  _registrarAuditoria: (tipo: string, detalle: string) => void;

  // Habitaciones
  agregarHabitacion: (numero: string, tipo: string, capacidad: number, camasMatrimoniales: number, camasSimples: number) => boolean;
  editarHabitacion: (numeroOriginal: string, numeroNuevo: string, tipo: string, capacidad: number, camasMatrimoniales: number, camasSimples: number) => boolean;
  eliminarHabitacion: (numero: string) => boolean;

  // Clientes
  agregarCliente: (datos: { nombre: string; dni: string; telefono?: string; email?: string; preferencias?: string }) => Cliente;
  actualizarCliente: (id: number, datos: Partial<Cliente>) => void;
  eliminarCliente: (id: number) => boolean;
  buscarCliente: (termino: string) => Cliente[];

  // Reservas
  crearReserva: (datos: Partial<Reserva> & { checkin: string; checkout: string; habitacion: string; huesped: string; dni: string; personas: number }) => Reserva | null;
  modificarReserva: (id: number, datos: Partial<Reserva>) => void;
  cancelarReserva: (id: number) => void;
  buscarDisponibilidad: (desde: string, hasta: string) => HabitacionDisponible[];
  calcularTotalReserva: (idReserva: number) => number;
  calcularTotalPagado: (idReserva: number) => number;
  nochesEntre: (checkin: string, checkout: string) => number;
  calcularTotalSegunTarifa: (tipoTarifa: string, personas: number, noches: number, esCompartida: boolean, precioPorCama?: number) => number;

  // Check-in/Check-out
  realizarCheckIn: (idReserva: number, datos: { contactoEmergencia?: { nombre: string; telefono: string }; observacionesHuesped?: string; llaveEntregada?: string; documentoVerificado?: boolean; firmaConformidad?: boolean; acompanantes?: { nombre: string; dni: string; celular: string }[] }) => boolean;
  realizarCheckOut: (idReserva: number) => { noches: number; total: number } | null;

  // Pagos
  registrarPago: (idReserva: number, monto: number, metodo: string, nota?: string) => Pago | null;

  // Limpieza
  marcarComoLimpia: (numero: string) => void;
  reportarMantenimiento: (numero: string, descripcion: string) => void;
  resolverMantenimiento: (numero: string, reparacion: string, monto: number) => void;

  // Caja
  abrirCaja: (montoInicial: number) => boolean;
  registrarMovimientoCaja: (tipo: 'ingreso' | 'egreso', monto: number, descripcion: string, metodo: string) => boolean;
  cerrarCaja: (billetes: Record<number, number>, totalOtros: number) => CierreCaja | null;
  saldoActualCaja: () => number;

  // Gastos
  agregarGasto: (datos: { tipo: string; descripcion: string; monto: number; fecha?: string }) => Gasto;
  eliminarGasto: (id: number) => void;

  // Usuarios
  crearUsuario: (datos: { nombre: string; contrasena: string; nombreCompleto?: string; permisos?: string[] }) => Usuario;
  actualizarUsuario: (id: number, datos: Partial<Usuario>) => void;
  eliminarUsuario: (id: number) => boolean;

  // Tarifas
  actualizarPrecioTarifa: (tipo: string, personas: number, precio: number) => void;
  guardarTarifaCompleta: (tipoOriginal: string, datos: { nombre: string; precios: Record<number, number>; camposPersonalizados: CampoPersonalizado[]; choferCortesia: boolean; habitacionChofer: string | null }) => void;
  agregarTipoTarifa: (tipo: string) => void;
  eliminarTipoTarifa: (tipo: string) => boolean;
  agregarMetodoPago: (metodo: MetodoPago) => void;
  editarMetodoPago: (idOriginal: string, metodo: MetodoPago) => void;
  eliminarMetodoPago: (id: string) => boolean;
  agregarCategoriaGasto: (categoria: string) => void;
  editarCategoriaGasto: (nombreOriginal: string, nombreNuevo: string) => void;
  eliminarCategoriaGasto: (categoria: string) => boolean;
  actualizarPrecioCama: (precio: number) => void;

  // Reset
  resetData: () => void;
}

// ==================== STORE ====================

export const useHotelStore = create<HotelStore>()(
  persist(
    (set, get) => ({
      // Default data
      habitaciones: defaultHabitaciones,
      reservas: defaultReservas,
      clientes: defaultClientes,
      pagos: defaultPagos,
      usuarios: defaultUsuarios,
      gastos: defaultGastos,
      auditoria: [],
      caja: { estado: 'cerrada', apertura: null, movimientos: [], historial: [] },
      historialMantenimiento: [],
      tarifas: defaultTarifas,
      tiposTarifa: ['compartida'],
      metodosPago: defaultMetodosPago,
      categoriasGastos: defaultCategoriasGastos,

      // UI
      usuarioActual: null,
      moduloActivo: 'dashboard',
      sidebarOpen: false,
      perfilOpen: false,

      // Plan / Suscripción
      planActual: 'trial' as PlanTipo,
      fechaInicioTrial: null,
      moduloBloqueado: null,
      setModuloBloqueado: (m) => set({ moduloBloqueado: m }),
      setPlanActual: (p) => set({ planActual: p }),

      setModulo: (modulo) => {
        const { planActual, usuarioActual, sidebarOpen } = get();
        // Configuracion es owner-only, no depende del plan
        if (modulo !== 'configuracion' && usuarioActual) {
          const efectivos = calcModulosEfectivos(usuarioActual.permisos, planActual);
          if (!efectivos.includes(modulo)) {
            set({ moduloBloqueado: modulo, sidebarOpen: false });
            return;
          }
        }
        set({ moduloActivo: modulo as any, moduloBloqueado: null, sidebarOpen: false });
      },
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setPerfilOpen: (open) => set({ perfilOpen: open }),

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
        // Apply start module preference
        let startModule: string = 'dashboard';
        try {
          const prefs = JSON.parse(localStorage.getItem('hotel-perfil-prefs') || '{}');
          if (prefs.startModule && sesion.permisos.includes(prefs.startModule)) {
            startModule = prefs.startModule;
          }
        } catch { /* ignore */ }
        if (!get().fechaInicioTrial && sessionData.fechaInicioTrial) {
          set({ fechaInicioTrial: sessionData.fechaInicioTrial });
        }
        if (sessionData.planActual) {
          set({ planActual: sessionData.planActual });
        }
        set({ usuarioActual: sesion, moduloActivo: startModule as any, moduloBloqueado: null });
        get()._registrarAuditoria('Login', `Inicio de sesión: ${sesion.nombreCompleto || sesion.nombre}`);
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
        set({
          auditoria: [...auditoria, {
            id: generarId(auditoria),
            tipo,
            detalle,
            empleado,
            fecha: new Date().toISOString(),
          }],
        });
      },

      // ===== HABITACIONES =====
      agregarHabitacion: (numero, tipo, capacidad, camasMatrimoniales, camasSimples) => {
        const { habitaciones } = get();
        if (habitaciones[numero]) return false;
        set({
          habitaciones: {
            ...habitaciones,
            [numero]: { numero, tipo, capacidad: parseInt(String(capacidad)), camasMatrimoniales: parseInt(String(camasMatrimoniales)) || 0, camasSimples: parseInt(String(camasSimples)) || 0, estado: 'Disponible' },
          },
        });
        get()._registrarAuditoria('Habitación', `Creación: habitación ${numero} (${tipo})`);
        return true;
      },

      editarHabitacion: (numeroOriginal, numeroNuevo, tipo, capacidad, camasMatrimoniales, camasSimples) => {
        const { habitaciones, reservas, historialMantenimiento } = get();
        const hab = habitaciones[numeroOriginal];
        if (!hab) return false;

        const nuevaCapacidad = parseInt(String(capacidad));
        const reservasAfectadas = reservas.filter(
          r => r.habitacion === numeroOriginal && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado') && r.personas > nuevaCapacidad
        );
        if (reservasAfectadas.length > 0) return false;

        const datosNuevos: Habitacion = { ...hab, tipo, capacidad: nuevaCapacidad, camasMatrimoniales: parseInt(String(camasMatrimoniales)) || 0, camasSimples: parseInt(String(camasSimples)) || 0 };

        if (numeroOriginal !== numeroNuevo) {
          if (habitaciones[numeroNuevo] && numeroNuevo !== numeroOriginal) return false;
          const newHabs = { ...habitaciones };
          delete newHabs[numeroOriginal];
          newHabs[numeroNuevo] = datosNuevos;
          newHabs[numeroNuevo].numero = numeroNuevo;
          const updatedReservas = reservas.map(r => r.habitacion === numeroOriginal ? { ...r, habitacion: numeroNuevo } : r);
          const updatedHist = historialMantenimiento.map(h => h.habitacion === numeroOriginal ? { ...h, habitacion: numeroNuevo } : h);
          set({ habitaciones: newHabs, reservas: updatedReservas, historialMantenimiento: updatedHist });
        } else {
          set({ habitaciones: { ...habitaciones, [numeroOriginal]: datosNuevos } });
        }
        get()._registrarAuditoria('Habitación', `Edición: ${numeroOriginal}${numeroOriginal !== numeroNuevo ? ` → ${numeroNuevo}` : ''}`);
        return true;
      },

      eliminarHabitacion: (numero) => {
        const { habitaciones, reservas } = get();
        const hab = habitaciones[numero];
        if (!hab || hab.estado === 'Ocupada') return false;
        const reservasActivas = reservas.filter(r => r.habitacion === numero && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'));
        if (reservasActivas.length > 0) return false;

        const newHabs = { ...habitaciones };
        delete newHabs[numero];
        const updatedReservas = reservas.map(r => r.habitacion === numero && !['Cancelada', 'Check-Out realizado', 'Check-In realizado', 'Confirmada'].includes(r.estado) ? { ...r, estado: 'Cancelada' as const } : r);
        set({ habitaciones: newHabs, reservas: updatedReservas });
        get()._registrarAuditoria('Habitación', `Eliminación: habitación ${numero}`);
        return true;
      },

      // ===== CLIENTES =====
      agregarCliente: (datos) => {
        const { clientes } = get();
        const nuevo: Cliente = { id: generarId(clientes), ...datos, telefono: datos.telefono || '', email: datos.email || '', preferencias: datos.preferencias || '', historialEstadias: [], fechaCreacion: new Date().toISOString().split('T')[0] };
        set({ clientes: [...clientes, nuevo] });
        get()._registrarAuditoria('Cliente', `Creación: ${datos.nombre} (DNI: ${datos.dni})`);
        return nuevo;
      },

      actualizarCliente: (id, datos) => {
        const { clientes } = get();
        set({ clientes: clientes.map(c => c.id === id ? { ...c, ...datos } : c) });
        const cliente = clientes.find(c => c.id === id);
        if (cliente) get()._registrarAuditoria('Cliente', `Edición: ${cliente.nombre} (DNI: ${cliente.dni})`);
      },

      eliminarCliente: (id) => {
        const { clientes, reservas } = get();
        const cliente = clientes.find(c => c.id === id);
        if (!cliente) return false;
        const reservasActivas = reservas.filter(r => r.idCliente === id && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'));
        if (reservasActivas.length > 0) return false;
        set({ clientes: clientes.filter(c => c.id !== id) });
        get()._registrarAuditoria('Cliente', `Eliminación: ${cliente.nombre} (DNI: ${cliente.dni})`);
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

      crearReserva: (datos) => {
        const state = get();
        const disponibles = state.buscarDisponibilidad(datos.checkin, datos.checkout);
        const habElegida = disponibles.find(h => h.numero === datos.habitacion);
        if (!habElegida) return null;

        let idCliente = datos.idCliente;
        if (!idCliente) {
          const nuevo = state.agregarCliente({ nombre: datos.huesped, dni: datos.dni, telefono: datos.telefono, email: datos.email });
          idCliente = nuevo.id;
        }

        if (habElegida.tipo !== 'Compartida' && datos.personas > habElegida.capacidad) return null;
        if (habElegida.tipo === 'Compartida' && datos.personas > (habElegida.camasLibres || 0)) return null;

        const noches = nochesEntre(datos.checkin, datos.checkout);
        const esCompartida = habElegida.tipo === 'Compartida';
        const total = calcularTotalSegunTarifa(state.tarifas, datos.tipoTarifa || 'normal', datos.personas, noches, esCompartida, habElegida.precioPorCama);

        const reserva: Reserva = {
          id: generarId(state.reservas),
          idCliente,
          huesped: datos.huesped,
          dni: datos.dni,
          telefono: datos.telefono || '',
          email: datos.email || '',
          domicilio: datos.domicilio || '',
          habitacion: datos.habitacion,
          checkin: datos.checkin,
          checkout: datos.checkout,
          personas: datos.personas,
          estadoPago: datos.estadoPago || 'Pendiente',
          notas: datos.notas || '',
          estado: 'Confirmada',
          tipoTarifa: datos.tipoTarifa || 'normal',
          metodoPagoId: datos.metodoPagoId,
          cuotas: datos.cuotas,
          recargoPorcentaje: datos.recargoPorcentaje,
          agencia: datos.agencia,
          total,
          acompanantes: datos.acompanantes || [],
        };

        const newReservas = [...state.reservas, reserva];
        const newHabitaciones = { ...state.habitaciones };

        if (!esCompartida && newHabitaciones[datos.habitacion]) {
          newHabitaciones[datos.habitacion] = { ...newHabitaciones[datos.habitacion], estado: 'Reservada' };
        }

        set({ reservas: newReservas, habitaciones: newHabitaciones });
        state._registrarAuditoria('Reserva', `Creación: ${datos.huesped} - Hab ${datos.habitacion} - Total: $${total}`);
        return reserva;
      },

      modificarReserva: (id, datos) => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === id);
        if (!reserva) return;

        if (datos.habitacion || datos.checkin || datos.checkout) {
          const checkin = datos.checkin || reserva.checkin;
          const checkout = datos.checkout || reserva.checkout;
          const habitacion = datos.habitacion || reserva.habitacion;
          const disponibles = state.buscarDisponibilidad(checkin, checkout);
          if (!disponibles.find(h => h.numero === habitacion)) return;
        }

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
          if (datos.checkin || datos.checkout || datos.personas || datos.tipoTarifa || datos.habitacion) {
            const hab = state.habitaciones[updated.habitacion || r.habitacion];
            updated.total = calcularTotalSegunTarifa(state.tarifas, updated.tipoTarifa || 'normal', updated.personas || 1, nochesEntre(updated.checkin, updated.checkout), hab?.tipo === 'Compartida', hab?.precioPorCama);
          }
          return updated;
        });
        set({ reservas: updatedReservas });
        state._registrarAuditoria('Reserva', `Modificación #${id}: ${reserva.huesped}`);
      },

      cancelarReserva: (id) => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === id);
        if (!reserva || reserva.estado !== 'Confirmada') return;
        const newReservas = state.reservas.map(r => r.id === id ? { ...r, estado: 'Cancelada' as const } : r);
        const newHabs = { ...state.habitaciones };
        const hab = newHabs[reserva.habitacion];
        if (hab && hab.tipo !== 'Compartida' && hab.estado === 'Reservada') {
          newHabs[reserva.habitacion] = { ...hab, estado: 'Disponible' };
        }
        set({ reservas: newReservas, habitaciones: newHabs });
        state._registrarAuditoria('Reserva', `Cancelación #${id}: ${reserva.huesped} - Hab ${reserva.habitacion}`);
      },

      calcularTotalReserva: (idReserva) => {
        const { reservas, tarifas, habitaciones } = get();
        const reserva = reservas.find(r => r.id === idReserva);
        if (!reserva) return 0;
        if (reserva.total !== undefined && reserva.total !== null) return reserva.total;
        const hab = habitaciones[reserva.habitacion];
        return calcularTotalSegunTarifa(tarifas, reserva.tipoTarifa || 'normal', reserva.personas || 1, nochesEntre(reserva.checkin, reserva.checkout), hab?.tipo === 'Compartida', hab?.precioPorCama);
      },

      calcularTotalPagado: (idReserva) => {
        return get().pagos.filter(p => p.idReserva === idReserva).reduce((sum, p) => sum + p.monto, 0);
      },

      nochesEntre: (checkin, checkout) => nochesEntre(checkin, checkout),

      calcularTotalSegunTarifa: (tipoTarifa, personas, noches, esCompartida, precioPorCama) => {
        return calcularTotalSegunTarifa(get().tarifas, tipoTarifa, personas, noches, esCompartida, precioPorCama);
      },

      // ===== CHECK-IN / CHECK-OUT =====
      realizarCheckIn: (idReserva, datos) => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === idReserva);
        if (!reserva || reserva.estado !== 'Confirmada') return false;

        const updatedReservas = state.reservas.map(r => {
          if (r.id !== idReserva) return r;
          return {
            ...r,
            ...datos,
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
        return true;
      },

      realizarCheckOut: (idReserva) => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === idReserva);
        if (!reserva || reserva.estado !== 'Check-In realizado') return null;

        const total = state.calcularTotalReserva(idReserva);
        const noches = nochesEntre(reserva.checkin, reserva.checkout);
        const fechaSalida = new Date(reserva.checkout + 'T09:00:00');

        const updatedReservas = state.reservas.map(r => {
          if (r.id !== idReserva) return r;
          return { ...r, horaCheckout: fechaSalida.toISOString(), estado: 'Check-Out realizado' as const };
        });

        const newHabs = { ...state.habitaciones };
        if (newHabs[reserva.habitacion]) {
          newHabs[reserva.habitacion] = { ...newHabs[reserva.habitacion], estado: 'Limpieza' };
        }

        // Registrar estadía en cliente
        const newClientes = state.clientes.map(c => {
          if (c.id !== reserva.idCliente) return c;
          const estadia: Estadia = { fechaCheckin: reserva.checkin, fechaCheckout: reserva.checkout, habitacion: reserva.habitacion, gastoTotal: total };
          return { ...c, historialEstadias: [...c.historialEstadias, estadia] };
        });

        set({ reservas: updatedReservas, habitaciones: newHabs, clientes: newClientes });
        state._registrarAuditoria('Check-Out', `Check-Out: ${reserva.huesped} - Hab ${reserva.habitacion} (Total: $${total})`);
        return { noches, total };
      },

      // ===== PAGOS =====
      registrarPago: (idReserva, monto, metodo, nota = '') => {
        const state = get();
        const reserva = state.reservas.find(r => r.id === idReserva);
        if (!reserva) return null;

        const nuevoPago: Pago = { id: generarId(state.pagos), idReserva, monto: parseFloat(String(monto)), metodo, fecha: new Date().toISOString().split('T')[0], nota };
        const newPagos = [...state.pagos, nuevoPago];

        const total = state.calcularTotalReserva(idReserva);
        const pagado = newPagos.filter(p => p.idReserva === idReserva).reduce((s, p) => s + p.monto, 0);
        let estadoPago: 'Pendiente' | 'Parcial' | 'Pagado' = 'Pendiente';
        if (pagado >= total) estadoPago = 'Pagado';
        else if (pagado > 0) estadoPago = 'Parcial';

        const newReservas = state.reservas.map(r => r.id === idReserva ? { ...r, estadoPago } : r);

        // Auto-registrar en caja si efectivo
        const newCaja = { ...state.caja };
        if (metodo === 'Efectivo' && newCaja.estado === 'abierta') {
          const empleado = state.usuarioActual?.nombreCompleto || state.usuarioActual?.nombre || 'Sistema';
          const mov: MovimientoCaja = { tipo: 'ingreso', monto: parseFloat(String(monto)), descripcion: `Pago de ${reserva.huesped} (Reserva #${idReserva})`, metodo: 'Efectivo', empleado, fecha: new Date().toISOString() };
          newCaja.movimientos = [...newCaja.movimientos, mov];
        }

        set({ pagos: newPagos, reservas: newReservas, caja: newCaja });
        state._registrarAuditoria('Pago', `Pago recibido: ${reserva.huesped} - $${monto} en ${metodo}${nota ? ` (${nota})` : ''}`);
        return nuevoPago;
      },

      // ===== LIMPIEZA =====
      marcarComoLimpia: (numero) => {
        const { habitaciones } = get();
        const hab = habitaciones[numero];
        if (!hab || hab.estado !== 'Limpieza') return;
        set({ habitaciones: { ...habitaciones, [numero]: { ...hab, estado: 'Disponible' as const } } });
        get()._registrarAuditoria('Limpieza', `Habitación ${numero} marcada como limpia`);
      },

      reportarMantenimiento: (numero, descripcion) => {
        const { habitaciones, reservas } = get();
        const hab = habitaciones[numero];
        if (!hab) return;

        const newHabs = { ...habitaciones, [numero]: { ...hab, estado: 'Mantenimiento' as const, problema: descripcion } };
        const newReservas = reservas.map(r => {
          if (r.habitacion !== numero || r.estado === 'Cancelada' || r.estado === 'Check-Out realizado') return r;
          return { ...r, estado: 'Cancelada' as const };
        });

        set({ habitaciones: newHabs, reservas: newReservas });
        get()._registrarAuditoria('Mantenimiento', `Reporte: Hab ${numero} - ${descripcion}`);
      },

      resolverMantenimiento: (numero, reparacion, monto) => {
        const state = get();
        const hab = state.habitaciones[numero];
        if (!hab || hab.estado !== 'Mantenimiento') return;

        state.agregarGasto({ tipo: 'Mantenimiento', descripcion: `Habitación ${numero}: ${reparacion}`, monto: parseFloat(String(monto)) || 0 });

        const newHist = [...state.historialMantenimiento, {
          id: generarId(state.historialMantenimiento),
          habitacion: numero,
          problema: hab.problema || 'Sin descripción',
          reparacion,
          monto: parseFloat(String(monto)) || 0,
          fecha: new Date().toISOString(),
          empleado: state.usuarioActual?.nombreCompleto || state.usuarioActual?.nombre || 'Sistema',
        }];

        const newHabs = { ...state.habitaciones };
        const { problema, ...habSinProblema } = newHabs[numero];
        newHabs[numero] = { ...habSinProblema, estado: 'Disponible' as const };

        set({ historialMantenimiento: newHist, habitaciones: newHabs });
        state._registrarAuditoria('Mantenimiento', `Resuelto: Habitación ${numero} - ${reparacion} - $${monto}`);
      },

      // ===== CAJA =====
      abrirCaja: (montoInicial) => {
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
        get()._registrarAuditoria('Caja', `Apertura - ${empleado} - Inicial: $${montoInicial}`);
        return true;
      },

      registrarMovimientoCaja: (tipo, monto, descripcion, metodo) => {
        const { caja } = get();
        if (caja.estado !== 'abierta') return false;
        const empleado = get().usuarioActual?.nombreCompleto || get().usuarioActual?.nombre || 'Sistema';
        const mov: MovimientoCaja = { tipo, monto: parseFloat(String(monto)), descripcion, metodo, empleado, fecha: new Date().toISOString() };
        set({ caja: { ...caja, movimientos: [...caja.movimientos, mov] } });
        get()._registrarAuditoria('Caja', `${tipo}: $${monto} en ${metodo} - ${descripcion}`);
        return true;
      },

      cerrarCaja: (billetes, totalOtros) => {
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
        get()._registrarAuditoria('Caja', `Cierre - ${empleado} - Esperado: $${saldoEsperado} Contado: $${saldoContado} Dif: $${diferencia}`);
        return cierre;
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

      // ===== GASTOS =====
      agregarGasto: (datos) => {
        const { gastos } = get();
        const nuevo: Gasto = { id: generarId(gastos), tipo: datos.tipo, descripcion: datos.descripcion, monto: parseFloat(String(datos.monto)), fecha: datos.fecha || new Date().toISOString().split('T')[0], empleado: get().usuarioActual?.nombreCompleto || get().usuarioActual?.nombre || 'Sistema' };
        set({ gastos: [...gastos, nuevo] });
        get()._registrarAuditoria('Gasto', `Registro: ${datos.tipo} - ${datos.descripcion} - $${datos.monto}`);
        return nuevo;
      },

      eliminarGasto: (id) => {
        const { gastos } = get();
        const gasto = gastos.find(g => g.id === id);
        if (!gasto) return;
        set({ gastos: gastos.filter(g => g.id !== id) });
        get()._registrarAuditoria('Gasto', `Eliminación: ${gasto.tipo} - ${gasto.descripcion} - $${gasto.monto}`);
      },

      // ===== USUARIOS =====
      crearUsuario: (datos) => {
        const { usuarios } = get();
        const nuevo: Usuario = { id: generarId(usuarios), nombre: datos.nombre, contrasena: datos.contrasena, nombreCompleto: datos.nombreCompleto || datos.nombre, permisos: datos.permisos || [] };
        set({ usuarios: [...usuarios, nuevo] });
        return nuevo;
      },

      actualizarUsuario: (id, datos) => {
        const { usuarios, usuarioActual } = get();
        const updated = usuarios.map(u => u.id === id ? { ...u, ...datos } : u);
        let newSesion = usuarioActual;
        if (usuarioActual && usuarioActual.id === id && datos.permisos) {
          newSesion = { ...usuarioActual, permisos: datos.permisos };
        }
        set({ usuarios: updated, usuarioActual: newSesion });
      },

      eliminarUsuario: (id) => {
        const { usuarios, usuarioActual } = get();
        if (usuarioActual && usuarioActual.id === id) return false;
        const usuario = usuarios.find(u => u.id === id);
        if (!usuario) return false;
        const adminsRestantes = usuarios.filter(u => u.id !== id && u.permisos.includes('usuarios'));
        if (usuario.permisos.includes('usuarios') && adminsRestantes.length === 0) return false;
        set({ usuarios: usuarios.filter(u => u.id !== id) });
        return true;
      },

      // ===== TARIFAS =====
      actualizarPrecioTarifa: (tipo, personas, precio) => {
        const { tarifas } = get();
        const tarifa = tarifas[tipo];
        if (!tarifa) return;
        set({ tarifas: { ...tarifas, [tipo]: { ...tarifa, [personas]: precio } } });
      },

      guardarTarifaCompleta: (tipoOriginal, datos) => {
        const { tarifas, tiposTarifa, reservas } = get();
        const esNueva = tipoOriginal === 'nueva';
        const nombre = datos.nombre;
        const nuevaTarifa: TarifaPrecios = {
          1: datos.precios[1] || 0,
          2: datos.precios[2] || 0,
          3: datos.precios[3] || 0,
          4: datos.precios[4] || 0,
          camposPersonalizados: datos.camposPersonalizados,
          choferCortesia: datos.choferCortesia,
          habitacionChofer: datos.habitacionChofer,
        };
        if (esNueva) {
          if (tiposTarifa.some(t => t.toLowerCase() === nombre.toLowerCase())) return;
          set({ tarifas: { ...tarifas, [nombre]: nuevaTarifa }, tiposTarifa: [...tiposTarifa, nombre] });
        } else {
          const newTarifas = { ...tarifas };
          if (nombre !== tipoOriginal) {
            newTarifas[nombre] = { ...tarifas[tipoOriginal], ...nuevaTarifa };
            delete newTarifas[tipoOriginal];
            const newTipos = tiposTarifa.map(t => t === tipoOriginal ? nombre : t);
            const newReservas = reservas.map(r => r.tipoTarifa === tipoOriginal ? { ...r, tipoTarifa: nombre } : r);
            set({ tarifas: newTarifas, tiposTarifa: newTipos, reservas: newReservas });
          } else {
            newTarifas[nombre] = { ...tarifas[nombre], ...nuevaTarifa };
            set({ tarifas: newTarifas });
          }
        }
      },

      agregarTipoTarifa: (tipo) => {
        const { tarifas, tiposTarifa } = get();
        if (tiposTarifa.includes(tipo)) return;
        set({ tarifas: { ...tarifas, [tipo]: { 1: 0, 2: 0, 3: 0, 4: 0, camposPersonalizados: [], choferCortesia: false, habitacionChofer: null } }, tiposTarifa: [...tiposTarifa, tipo] });
      },

      eliminarTipoTarifa: (tipo) => {
        const { tarifas, tiposTarifa, reservas } = get();
        const reservasActivas = reservas.filter(r => r.tipoTarifa === tipo && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'));
        if (reservasActivas.length > 0) return false;
        if (tipo === 'normal') return false;
        const newTarifas = { ...tarifas };
        delete newTarifas[tipo];
        set({ tarifas: newTarifas, tiposTarifa: tiposTarifa.filter(t => t !== tipo) });
        return true;
      },

      agregarMetodoPago: (metodo) => {
        const { metodosPago } = get();
        if (metodosPago.find(m => m.id === metodo.id)) return;
        set({ metodosPago: [...metodosPago, metodo] });
      },

      editarMetodoPago: (idOriginal, metodo) => {
        const { metodosPago } = get();
        set({ metodosPago: metodosPago.map(m => m.id === idOriginal ? metodo : m) });
      },

      eliminarMetodoPago: (id) => {
        const { metodosPago, pagos, reservas } = get();
        if (id === 'efectivo') return false;
        const metodo = metodosPago.find(m => m.id === id);
        if (!metodo) return false;
        if (pagos.some(p => p.metodo === metodo.nombre)) return false;
        if (reservas.some(r => r.metodoPagoId === id && (r.estado === 'Confirmada' || r.estado === 'Check-In realizado'))) return false;
        set({ metodosPago: metodosPago.filter(m => m.id !== id) });
        return true;
      },

      agregarCategoriaGasto: (categoria) => {
        const { categoriasGastos } = get();
        if (categoriasGastos.includes(categoria)) return;
        set({ categoriasGastos: [...categoriasGastos, categoria] });
      },

      editarCategoriaGasto: (nombreOriginal, nombreNuevo) => {
        const { categoriasGastos, gastos } = get();
        const newCats = categoriasGastos.map(c => c === nombreOriginal ? nombreNuevo : c);
        const newGastos = gastos.map(g => g.tipo === nombreOriginal ? { ...g, tipo: nombreNuevo } : g);
        set({ categoriasGastos: newCats, gastos: newGastos });
      },

      eliminarCategoriaGasto: (categoria) => {
        const { categoriasGastos, gastos } = get();
        if (gastos.some(g => g.tipo === categoria)) return false;
        set({ categoriasGastos: categoriasGastos.filter(c => c !== categoria) });
        return true;
      },

      actualizarPrecioCama: (precio) => {
        const { tarifas } = get();
        set({ tarifas: { ...tarifas, precioPorCama: precio } });
      },

      // ===== RESET =====
      resetData: () => set({
        habitaciones: defaultHabitaciones,
        reservas: defaultReservas,
        clientes: defaultClientes,
        pagos: defaultPagos,
        usuarios: defaultUsuarios,
        gastos: defaultGastos,
        auditoria: [],
        caja: { estado: 'cerrada', apertura: null, movimientos: [], historial: [] },
        historialMantenimiento: [],
        tarifas: defaultTarifas,
        tiposTarifa: ['compartida'],
        metodosPago: defaultMetodosPago,
        categoriasGastos: defaultCategoriasGastos,
      }),
    }),
    {
      name: 'hospeda-storage',
      version: 6,
      migrate: (persisted: any, version: number) => {
        // version 5: limpiar datos de prueba y tarifas viejas
        if (version < 5) {
          persisted.reservas = [];
          persisted.clientes = [];
          persisted.pagos = [];
          persisted.usuarios = [];
          persisted.gastos = [];
          persisted.auditoria = [];
          persisted.historialMantenimiento = [];
          persisted.tarifas = { compartida: { 1: 0, 2: 0, 3: 0, 4: 0, camposPersonalizados: [], choferCortesia: false, habitacionChofer: null } };
          persisted.tiposTarifa = ['compartida'];
          persisted.habitaciones = {};
        }
        // version 6: limpiar usuarioActual para re-fetch con campo 'rol'
        if (version < 6) {
          persisted.usuarioActual = null;
        }
        return persisted;
      },
      partialize: (state) => ({
        habitaciones: state.habitaciones,
        reservas: state.reservas,
        clientes: state.clientes,
        pagos: state.pagos,
        usuarios: state.usuarios,
        gastos: state.gastos,
        auditoria: state.auditoria,
        caja: state.caja,
        historialMantenimiento: state.historialMantenimiento,
        tarifas: state.tarifas,
        tiposTarifa: state.tiposTarifa,
        metodosPago: state.metodosPago,
        categoriasGastos: state.categoriasGastos,
        planActual: state.planActual,
        fechaInicioTrial: state.fechaInicioTrial,
      }),
    }
  )
);
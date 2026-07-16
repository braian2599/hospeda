// ==================== TIPOS DEL SISTEMA HOTELERO ====================

export interface Habitacion {
  numero: string;
  tipo: 'Doble' | 'Triple' | 'Cuádruple' | 'Compartida' | string;
  capacidad: number;
  camasMatrimoniales: number;
  camasSimples: number;
  estado: EstadoHabitacion;
  problema?: string;
  precioPorCama?: number;
}

export type EstadoHabitacion = 'Disponible' | 'Ocupada' | 'Limpieza' | 'Mantenimiento' | 'Reservada' | 'Fuera de servicio';

export interface Cliente {
  id: string;
  nombre: string;
  dni: string;
  telefono: string;
  email: string;
  fechaNacimiento?: string;
  nacionalidad?: string;
  preferencias: string;
  historialEstadias: Estadia[];
  fechaCreacion: string;
}

export interface Estadia {
  fechaCheckin: string;
  fechaCheckout: string;
  habitacion: string;
  gastoTotal: number;
}

export interface Reserva {
  id: string;
  idCliente: string;
  huesped: string;
  dni: string;
  telefono: string;
  email: string;
  domicilio?: string;
  habitacion: string;
  checkin: string;
  checkout: string;
  personas: number;
  estadoPago: 'Pendiente' | 'Parcial' | 'Pagado';
  notas: string;
  estado: EstadoReserva;
  tipoTarifa?: string;
  metodoPagoId?: string;
  cuotas?: number;
  recargoPorcentaje?: number;
  agencia?: AgenciaData;
  total?: number;
  contactoEmergencia?: ContactoEmergencia;
  observacionesHuesped?: string;
  llaveEntregada?: string;
  documentoVerificado?: boolean;
  firmaConformidad?: boolean;
  acompanantes?: Acompanante[];
  horaCheckin?: string;
  horaCheckout?: string;
}

export type EstadoReserva = 'Confirmada' | 'Cancelada' | 'Check-In realizado' | 'Check-Out realizado';

export interface AgenciaData {
  nombre: string;
  convenio?: string;
  vendedor?: string;
  [key: string]: string | undefined;
}

export interface ContactoEmergencia {
  nombre: string;
  telefono: string;
}

export interface Acompanante {
  nombre: string;
  dni: string;
  celular: string;
}

export interface Pago {
  id: string;
  idReserva: string;
  monto: number;
  metodo: string;
  fecha: string;
  nota: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  contrasena: string;
  nombreCompleto: string;
  permisos: string[];
}

export interface UsuarioSesion {
  id: string;
  tenantUserId?: string;
  nombre: string;
  nombreCompleto: string;
  permisos: string[];
  rol?: string;
  tenantId?: string;
  tenantNombre?: string;
  email?: string;
}

export interface Gasto {
  id: string;
  tipo: string;
  descripcion: string;
  monto: number;
  fecha: string;
  empleado: string;
}

export interface AuditoriaEntry {
  id: string;
  tipo: string;
  detalle: string;
  empleado: string;
  fecha: string;
}

export interface AperturaCaja {
  montoInicial: number;
  empleado: string;
  fecha: string;
}

export interface MovimientoCaja {
  tipo: 'ingreso' | 'egreso';
  monto: number;
  descripcion: string;
  metodo: string;
  empleado: string;
  fecha: string;
}

export interface CierreCaja {
  empleado: string;
  fecha: string;
  saldoEsperado: number;
  saldoContado: number;
  diferencia: number;
  billetes: Record<number, number>;
  totalOtrosMetodos: number;
}

export interface TurnoCaja {
  apertura: AperturaCaja;
  cierre: CierreCaja;
  movimientos: MovimientoCaja[];
}

export interface CajaState {
  estado: 'abierta' | 'cerrada';
  apertura: AperturaCaja | null;
  movimientos: MovimientoCaja[];
  historial: TurnoCaja[];
}

export interface TarifaPrecios {
  [personas: number]: number;
  camposPersonalizados?: CampoPersonalizado[];
  choferCortesia?: boolean;
  habitacionChofer?: string | null;
}

export interface CampoPersonalizado {
  nombre: string;
  tipo: 'texto' | 'numero';
  requerido: boolean;
}

export interface MetodoPago {
  id: string;
  nombre: string;
  tipo: 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';
  recargo: boolean;
  cuotas: Cuota[];
}

export interface Cuota {
  cantidad: number;
  porcentaje: number;
}

export interface HistorialMantenimientoEntry {
  id: string;
  habitacion: string;
  problema: string;
  reparacion: string;
  monto: number;
  fecha: string;
  empleado: string;
}

export interface HabitacionDisponible extends Omit<Habitacion, 'estado' | 'problema'> {
  camasLibres?: number;
}

export type ModuloId = 'dashboard' | 'habitaciones' | 'reservas' | 'checkin' | 'facturacion' | 'limpieza' | 'caja' | 'clientes' | 'reportes' | 'usuarios' | 'tarifas';

export const MODULOS_SISTEMA: { id: ModuloId; label: string; icon: string; grupo?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'habitaciones', label: 'Habitaciones', icon: 'DoorOpen', grupo: 'operativo' },
  { id: 'checkin', label: 'Check-In/Out', icon: 'LogIn', grupo: 'operativo' },
  { id: 'limpieza', label: 'Limpieza y Mant.', icon: 'Sparkles', grupo: 'operativo' },
  { id: 'reservas', label: 'Reservas', icon: 'CalendarDays', grupo: 'comercial' },
  { id: 'clientes', label: 'Clientes', icon: 'Users', grupo: 'comercial' },
  { id: 'tarifas', label: 'Tarifas', icon: 'Tags', grupo: 'comercial' },
  { id: 'facturacion', label: 'Facturación', icon: 'Receipt', grupo: 'financiero' },
  { id: 'caja', label: 'Caja', icon: 'Wallet', grupo: 'financiero' },
  { id: 'reportes', label: 'Reportes', icon: 'BarChart3', grupo: 'financiero' },
  { id: 'usuarios', label: 'Usuarios', icon: 'UserCog', grupo: 'admin' },
];

export const BILLETES = [20000, 10000, 2000, 1000, 500, 200, 100, 50];
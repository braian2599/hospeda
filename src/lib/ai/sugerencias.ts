// ==================== SUGERENCIAS DEL ASISTENTE POR MÓDULO ====================
// Las tres preguntas que se le ofrecen al usuario cambian según la pantalla
// donde está parado. La idea es que sean las de su tarea de ahora, no
// preguntas genéricas que no le sirven.
//
// Módulo puro, sin React: las claves se validan contra MODULOS_SISTEMA en los
// tests, así que si mañana se agrega un módulo y nadie le escribe sugerencias,
// la prueba avisa.

import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';

export const SUGERENCIAS: Record<ModuloId, string[]> = {
  dashboard: ['¿Cómo leo el calendario?', '¿Qué significa RevPAR?', 'Las alertas de hoy'],
  habitaciones: ['¿Por qué no puedo reservar esta habitación?', 'Poner una en mantenimiento', 'Cómo funcionan las compartidas'],
  checkin: ['¿Cómo hago un check-in?', 'Check-out de una sola cama', 'Cargar acompañantes'],
  limpieza: ['Marcar una habitación como limpia', 'Reportar un desperfecto', 'Bloquear por mantenimiento'],
  reservas: ['Cargar una reserva', 'Cobrar la seña', 'Reservar en una compartida'],
  clientes: ['Buscar un huésped', 'Ver el historial de estadías'],
  tarifas: ['Crear una tarifa por cama', 'Noches de cortesía', 'Precio diferenciado de niños'],
  comprobantes: ['Emitir una factura', 'Anular un remito', '¿Qué es el CAE?'],
  caja: ['Abrir la caja', 'Cerrar el turno', 'Me da diferencia el cierre'],
  reportes: ['Ocupación del mes', '¿Qué es el ADR?', 'Horas trabajadas del equipo'],
  usuarios: ['Dar de alta a alguien del equipo', 'Qué ve cada rol'],
  configuracion: ['Configurar la landing del hotel', 'Cargar los datos fiscales', 'Conectar Mercado Pago'],
};

/** Nombre del módulo tal cual aparece en el menú. Sale de MODULOS_SISTEMA. */
export function nombreDeModulo(modulo: ModuloId): string {
  const encontrado = MODULOS_SISTEMA.find(m => m.id === modulo);
  if (encontrado) return encontrado.label;
  // Configuración no está en MODULOS_SISTEMA (va aparte, abajo del menú).
  if (modulo === 'configuracion') return 'Configuración';
  return modulo;
}

export function sugerenciasDe(modulo: ModuloId): string[] {
  return SUGERENCIAS[modulo] ?? [];
}

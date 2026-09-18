// ==================== LA ÚNICA FORMA DE SALIR DEL SISTEMA ====================
//
// EL PROBLEMA QUE RESUELVE
// Había SIETE lugares distintos que cerraban la sesión, y solo UNO registraba
// el Logout en la auditoría (el botón del menú lateral). Los otros seis
// llamaban a signOut() de next-auth directo, así que el turno de esa persona
// quedaba abierto para siempre, sin que hubiera fallado nada.
//
// Mientras el Logout era solo una línea en un historial, daba igual. Desde que
// el reporte de horas trabajadas se calcula emparejando Login con Logout, un
// Logout que no se registra es un turno que no se paga.
//
// Por eso ahora hay una sola puerta de salida, y hace las dos cosas que
// siempre hay que hacer: cerrar el turno y salir de verdad.

import { signOut } from 'next-auth/react';
import { useHotelStore } from '@/lib/store';

/**
 * Cierra la sesión y vuelve al login.
 *
 * Registra el Logout solo si hay alguien adentro: en las pantallas de elegir
 * hotel o perfil todavía no hay turno abierto, y ahí `logout()` no hace nada
 * —ya se protege solo— así que llamar a esto desde cualquier lado es seguro.
 *
 * El pedido del Logout viaja con keepalive, así que sobrevive a la navegación
 * que dispara signOut() un instante después (ver _registrarAuditoria).
 */
export function cerrarSesion(callbackUrl = '/login'): void {
  useHotelStore.getState().logout();
  void signOut({ callbackUrl });
}

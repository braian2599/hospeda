'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useHotelStore } from '@/lib/store';
import { usePresenceStore } from '@/lib/presence-store';

// ═══════════════════════════════════════════════════════════
// POR QUÉ ESTE ARCHIVO ES ASÍ
// ═══════════════════════════════════════════════════════════
//
// La presencia (el punto verde de "conectado") fue lo que consumió las 100
// CU-hrs del plan gratis de Neon en 16 días. Antes: un latido cada 30 s y la
// lista de conectados cada 15 s, contra Postgres, SIEMPRE — sin mirar si la
// pestaña estaba visible ni si había alguien usando la máquina. Neon apaga la
// base a los ~5 minutos sin actividad; con tráfico cada 15 s nunca se apagaba.
//
// Ahora, tres reglas:
//
//   1. Los datos van a Redis, no a Postgres (ver src/lib/presence.ts y las
//      rutas de /api/presence).
//   2. Nada se manda si no hay ACTIVIDAD REAL del usuario (teclado, mouse,
//      touch) en los últimos minutos. Tener la pestaña abierta no alcanza: una
//      máquina encendida toda la noche no gasta nada.
//   3. La lista de conectados se pide SOLO donde se muestra (el módulo de
//      Usuarios). El latido, en cambio, corre en toda la app, porque es lo que
//      hace que los demás te vean conectado.
//
// Compatibilidad: usa setInterval, fetch y eventos de teclado/mouse/touch.
// Todo soportado desde hace más de una década; no agrega ningún requisito.

/** Cada cuánto se avisa "sigo acá". */
const LATIDO_MS = 60_000;

/** Cada cuánto se refresca la lista de conectados (solo en el módulo Usuarios). */
const REFRESCO_ONLINE_MS = 60_000;

/** Sin actividad del usuario durante este tiempo, se corta todo. */
const INACTIVIDAD_MS = 5 * 60_000;

/** Espera inicial para no competir con la carga de la app. */
const DEMORA_INICIO_MS = 5_000;

// ═══════════════════════════════════════════════════════════
// DETECTOR DE ACTIVIDAD (compartido por toda la app)
// ═══════════════════════════════════════════════════════════
//
// Un único juego de escuchas para toda la pestaña. Los handlers solo escriben
// un número en una variable — no tocan estado de React, así que no provocan
// re-renders por mover el mouse.

let ultimaActividad = typeof Date !== 'undefined' ? Date.now() : 0;
let escuchasPuestas = false;

const EVENTOS_ACTIVIDAD = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

function marcarActividad() {
  ultimaActividad = Date.now();
}

function asegurarEscuchas() {
  if (escuchasPuestas || typeof window === 'undefined') return;
  escuchasPuestas = true;
  for (const evento of EVENTOS_ACTIVIDAD) {
    window.addEventListener(evento, marcarActividad, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    // Volver a la pestaña cuenta como actividad.
    if (document.visibilityState === 'visible') marcarActividad();
  });
}

/** ¿Hay alguien realmente usando el sistema en esta pestaña ahora mismo? */
export function hayActividadReciente(): boolean {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return false;
  return Date.now() - ultimaActividad < INACTIVIDAD_MS;
}

// ═══════════════════════════════════════════════════════════
// LATIDO — va en el layout de la app
// ═══════════════════════════════════════════════════════════

/**
 * usePresenceHeartbeat — avisa al servidor que este usuario sigue activo.
 *
 * Se llama UNA vez, en el layout. No trae datos ni actualiza ninguna pantalla:
 * solo sirve para que los demás vean a este usuario como conectado.
 */
export function usePresenceHeartbeat() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const montadoRef = useRef(true);
  const iniciadoRef = useRef(false);

  const mandarLatido = useCallback(async () => {
    // Sin actividad del usuario no se manda nada. Esta es la línea que hace
    // que una máquina encendida de noche no consuma.
    if (!hayActividadReciente()) return;
    try {
      await fetch('/api/presence/heartbeat', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Best-effort: si falla, se reintenta en el próximo latido.
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    if (!usuarioActual) return;
    if (iniciadoRef.current) return;
    iniciadoRef.current = true;

    asegurarEscuchas();

    let timerLatido: ReturnType<typeof setInterval> | null = null;
    const timerInicio = setTimeout(() => {
      if (!montadoRef.current) return;
      mandarLatido();
      timerLatido = setInterval(mandarLatido, LATIDO_MS);
    }, DEMORA_INICIO_MS);

    return () => {
      montadoRef.current = false;
      iniciadoRef.current = false;
      clearTimeout(timerInicio);
      if (timerLatido) clearInterval(timerLatido);
    };
  }, [usuarioActual, mandarLatido]);
}

// ═══════════════════════════════════════════════════════════
// LISTA DE CONECTADOS — va SOLO donde se muestra
// ═══════════════════════════════════════════════════════════

/**
 * useOnlineUsers — trae la lista de conectados y la deja en presence-store.
 *
 * Se llama únicamente en el módulo de Usuarios, que es el único lugar donde se
 * ve el punto verde. Antes esto corría en el layout, o sea siempre, aunque
 * nadie estuviera mirando esa pantalla.
 */
export function useOnlineUsers() {
  const usuarioActual = useHotelStore(s => s.usuarioActual);
  const montadoRef = useRef(true);

  const traerConectados = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    try {
      const res = await fetch('/api/presence/online', {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!montadoRef.current) return;
      if (Array.isArray(data.onlineUserIds)) {
        usePresenceStore.getState().setOnlineUsers(data.onlineUserIds);
      }
      usePresenceStore.getState().setDisponible(data.disponible !== false);
      usePresenceStore.getState().setLoaded(true);
    } catch {
      // Silencioso: se reintenta en el próximo refresco.
    }
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    if (!usuarioActual) return;

    asegurarEscuchas();
    // Entrar al módulo ES actividad: se pide la lista al toque.
    marcarActividad();
    traerConectados();

    const timer = setInterval(() => {
      // Si el usuario se fue de la máquina, no tiene sentido seguir pidiendo.
      if (!hayActividadReciente()) return;
      traerConectados();
    }, REFRESCO_ONLINE_MS);

    return () => {
      montadoRef.current = false;
      clearInterval(timer);
    };
  }, [usuarioActual, traerConectados]);
}

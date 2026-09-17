'use client';

// Trae los Login/Logout del período y calcula las horas trabajadas.
//
// Se pide al servidor y no se saca del store porque el sync del login solo
// trae las últimas 200 entradas de auditoría de todos los tipos — en un hotel
// con movimiento eso son un par de días (ver /api/reportes/horas).

import { useState, useEffect } from 'react';
import { horasTrabajadas, type EventoSesion, type HorasDeEmpleado } from '@/lib/horas-trabajadas';

export interface EstadoHoras {
  filas: HorasDeEmpleado[];
  cargando: boolean;
  error: string | null;
  /** El servidor llegó al tope de eventos: el resumen está incompleto. */
  recortado: boolean;
}

interface Cargado {
  /** Para qué rango son estos datos. Es lo que decide si están al día. */
  para: string;
  filas: HorasDeEmpleado[];
  recortado: boolean;
  error: string | null;
}

export function useHorasTrabajadas(desde: string, hasta: string, activo: boolean): EstadoHoras {
  const [cargado, setCargado] = useState<Cargado | null>(null);
  const clave = `${desde}|${hasta}`;

  useEffect(() => {
    // Solo se pide cuando la pestaña está abierta: si no, cada visita a
    // Reportes despertaría la base para un dato que nadie está mirando.
    if (!activo || !desde || !hasta) return;

    let vivo = true;
    fetch(`/api/reportes/horas?desde=${desde}&hasta=${hasta}`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'No se pudieron traer las horas');
        return data as { eventos: EventoSesion[]; recortado: boolean };
      })
      .then(data => {
        if (!vivo) return;
        setCargado({
          para: clave,
          // El filtro por día lo hace el cálculo: el servidor trae un margen
          // de más para no cortar los turnos que cruzan el borde del rango.
          filas: horasTrabajadas(data.eventos || [], { desde, hasta }),
          recortado: data.recortado === true,
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        setCargado({
          para: clave,
          filas: [],
          recortado: false,
          error: e instanceof Error ? e.message : 'Error al traer las horas',
        });
      });

    return () => { vivo = false; };
  }, [clave, desde, hasta, activo]);

  // "Cargando" NO es un estado aparte que haya que poner a mano al empezar: es
  // simplemente que lo que hay guardado no corresponde al rango que se está
  // pidiendo. Derivarlo así evita un setState dentro del efecto —que dispara
  // un render en cascada— y además arregla un detalle: al cambiar las fechas,
  // la tabla pasa a "cargando" en el mismo render, sin mostrar por un instante
  // los datos del rango anterior como si fueran los nuevos.
  const alDia = cargado?.para === clave;

  return {
    filas: alDia ? cargado.filas : [],
    cargando: activo && !alDia,
    error: alDia ? cargado.error : null,
    recortado: alDia ? cargado.recortado : false,
  };
}

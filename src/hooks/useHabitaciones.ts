'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, DbHabitacion, DbReserva, ApiError, CreateHabitacion, UpdateHabitacion } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * Hook que reemplaza al store de Zustand para habitaciones.
 * Obtiene datos de la API REST.
 *
 * Retorna la misma interfaz que el módulo espera:
 * - habitaciones: Record<string, DbHabitacion> (mappeado por numero)
 * - reservas: DbReserva[] (solo las necesarias para mostrar huesped)
 * - loading, error
 * - CRUD methods: agregar, editar, eliminar
 */
export function useHabitacionesAPI() {
  const [habitaciones, setHabitaciones] = useState<Record<string, DbHabitacion>>({});
  const [reservas, setReservas] = useState<DbReserva[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch habitaciones ──
  const fetchHabitaciones = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.habitaciones.list();
      // Convertir array a Record<string, DbHabitacion>
      const map: Record<string, DbHabitacion> = {};
      for (const h of data) {
        map[h.numero] = h;
      }
      setHabitaciones(map);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return; // Redirect ya manejado
      setError('Error al cargar habitaciones');
      console.error('fetchHabitaciones:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch reservas (solo para mostrar huésped en tarjetas) ──
  const fetchReservas = useCallback(async () => {
    try {
      // TODO: cuando exista la API de reservas, usarla
      // const data = await api.reservas.list();
      // setReservas(data);
      setReservas([]);
    } catch {
      // No crítico
    }
  }, []);

  // Cargar datos al montar
  useEffect(() => {
    fetchHabitaciones();
    fetchReservas();
  }, [fetchHabitaciones, fetchReservas]);

  // ── Agregar habitación ──
  const agregarHabitacion = async (
    numero: string,
    tipo: string,
    capacidad: number,
    camasMatrimoniales: number,
    camasSimples: number
  ): Promise<boolean> => {
    try {
      const data: CreateHabitacion = { numero, tipo, capacidad, camasMatrimoniales, camasSimples };
      const created = await api.habitaciones.create(data);
      setHabitaciones(prev => ({ ...prev, [created.numero]: created }));
      toast.success('Habitación guardada', { description: `Habitación ${numero}` });
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Error al crear habitación');
      }
      return false;
    }
  };

  // ── Editar habitación ──
  const editarHabitacion = async (
    numeroOriginal: string,
    numeroNuevo: string,
    tipo: string,
    capacidad: number,
    camasMatrimoniales: number,
    camasSimples: number
  ): Promise<boolean> => {
    try {
      const data: UpdateHabitacion = { numero: numeroNuevo, tipo, capacidad, camasMatrimoniales, camasSimples };
      const updated = await api.habitaciones.update(numeroOriginal, data);

      // Si cambió el número, quitar la key vieja y poner la nueva
      setHabitaciones(prev => {
        const next = { ...prev };
        if (numeroOriginal !== numeroNuevo) {
          delete next[numeroOriginal];
        }
        next[updated.numero] = updated;
        return next;
      });

      toast.success('Habitación guardada', { description: `Habitación ${numeroNuevo}` });
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Error al editar habitación');
      }
      return false;
    }
  };

  // ── Eliminar habitación ──
  const eliminarHabitacion = async (numero: string): Promise<boolean> => {
    try {
      await api.habitaciones.delete(numero);
      setHabitaciones(prev => {
        const next = { ...prev };
        delete next[numero];
        return next;
      });
      toast.success('Habitación eliminada');
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('Error al eliminar habitación');
      }
      return false;
    }
  };

  return {
    habitaciones,
    reservas,
    loading,
    error,
    refetch: fetchHabitaciones,
    agregarHabitacion,
    editarHabitacion,
    eliminarHabitacion,
  };
}
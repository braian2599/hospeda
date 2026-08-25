// ==================== CÁLCULO DE PRECIOS DE TARIFA ====================
// Lógica pura, sin dependencias de cliente ni de servidor — compartida entre
// el store (reservas internas) y la API pública de la landing, para que el
// precio que ve un visitante sea matemáticamente idéntico al que carga el
// personal desde el panel.

import type { RangoPrecio, PromocionesTarifa, ModoCobro, TarifaPrecios, ModalidadNochesCortesia } from '@/lib/types';

/**
 * Convierte datos de tarifa desde la BD (puede ser formato viejo o nuevo) a RangoPrecio[].
 * Formato viejo: { "1": 35000, "2": 30000, ... }
 * Formato nuevo: { "rangos": [{ minPersonas, maxPersonas, precio }] }
 */
export function normalizarRangos(preciosDb: unknown): RangoPrecio[] {
  if (!preciosDb || typeof preciosDb !== 'object') return [];
  const obj = preciosDb as Record<string, unknown>;

  if (Array.isArray(obj.rangos)) {
    return obj.rangos.map((r: unknown) => {
      const rango = r as Record<string, unknown>;
      return {
        minPersonas: Number(rango.minPersonas) || 1,
        maxPersonas: rango.maxPersonas != null ? Number(rango.maxPersonas) : null,
        precio: Number(rango.precio) || 0,
      };
    });
  }

  // Formato viejo: keys numéricos { "1": 35000, "2": 30000, ... }
  const keys = Object.keys(obj).filter((k) => !isNaN(Number(k)) && Number(k) >= 1);
  if (keys.length > 0) {
    return keys.map((k) => ({
      minPersonas: Number(k),
      maxPersonas: Number(k),
      precio: Number(obj[k]) || 0,
    }));
  }

  return [];
}

/** Parsea el JSON crudo de Tarifa.precios (BD) a un TarifaPrecios normalizado. */
export function parseTarifaPrecios(raw: unknown): TarifaPrecios {
  const obj = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  return {
    modoCobro: (obj.modoCobro as ModoCobro) || 'porGrupo',
    rangos: normalizarRangos(raw),
    promociones: obj.promociones as PromocionesTarifa | undefined,
    choferCortesia: obj.choferCortesia as boolean | undefined,
    habitacionChofer: obj.habitacionChofer as string | null | undefined,
  };
}

/** Busca el rango que corresponde a la cantidad de personas dada. */
export function encontrarRango(rangos: RangoPrecio[], personas: number): RangoPrecio | undefined {
  for (const r of rangos) {
    if (personas >= r.minPersonas && (r.maxPersonas === null || personas <= r.maxPersonas)) {
      return r;
    }
  }
  return rangos.length > 0 ? rangos[rangos.length - 1] : undefined;
}

/** Calcula las noches de cortesía según la modalidad. Devuelve la cantidad de noches a descontar. */
export function calcularNochesGratis(promociones: PromocionesTarifa, noches: number, checkin?: string): number {
  const nc = promociones.nochesCortesia;
  if (!nc?.activo || !nc.modalidad) return 0;

  const mod: ModalidadNochesCortesia = nc.modalidad;
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

/** Obtiene las promociones efectivas de una tarifa, migrando datos viejos (choferCortesia) si es necesario. */
export function getPromocionesEfectivas(tarifa: TarifaPrecios): PromocionesTarifa {
  if (tarifa.promociones) return tarifa.promociones;
  if (tarifa.choferCortesia) {
    return {
      acompananteSinCargo: {
        activo: true,
        etiqueta: 'Chofer de cortesía',
        habitacionAsignada: tarifa.habitacionChofer || undefined,
        cantidad: 1,
      },
    };
  }
  return {};
}

export interface CalcTarifaOptions {
  ninos?: number;
  checkin?: string;
}

/** Calcula el total a cobrar según la tarifa, cantidad de personas y noches. */
export function calcularTotalSegunTarifa(
  tarifas: Record<string, TarifaPrecios>,
  tipoTarifa: string,
  personas: number,
  noches: number,
  options?: CalcTarifaOptions
): number {
  const tarifa = tarifas[tipoTarifa] || tarifas['normal'];
  if (!tarifa || !tarifa.rangos || tarifa.rangos.length === 0) return 0;

  const promociones = getPromocionesEfectivas(tarifa);
  const modo: ModoCobro = tarifa.modoCobro || 'porGrupo';

  const nochesGratis = calcularNochesGratis(promociones, noches, options?.checkin);
  const nochesCobrables = Math.max(0, noches - nochesGratis);

  const ninosDif = promociones.ninosDiferenciado;
  const cantNinos = (options?.ninos && ninosDif?.activo) ? options.ninos : 0;
  const adultos = Math.max(1, personas - cantNinos);

  if (modo === 'porCama') {
    const rango = encontrarRango(tarifa.rangos, adultos);
    const precioCama = rango?.precio || tarifa.rangos[0]?.precio || 0;
    let total = nochesCobrables * adultos * precioCama;
    if (cantNinos > 0 && ninosDif?.activo) {
      total += cantNinos * (ninosDif.precioNino || 0) * nochesCobrables;
    }
    return total;
  }

  if (modo === 'porHabitacion') {
    const precio = tarifa.rangos[0]?.precio || 0;
    let total = nochesCobrables * precio;
    if (cantNinos > 0 && ninosDif?.activo) {
      total += cantNinos * (ninosDif.precioNino || 0) * nochesCobrables;
    }
    return total;
  }

  const rango = encontrarRango(tarifa.rangos, adultos);
  if (!rango) return 0;

  let total = nochesCobrables * rango.precio;
  if (cantNinos > 0 && ninosDif?.activo) {
    total += cantNinos * (ninosDif.precioNino || 0) * nochesCobrables;
  }
  return total;
}

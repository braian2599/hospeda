// ==================== CÁLCULO DE PRECIOS DE TARIFA ====================
// Lógica pura, sin dependencias de cliente ni de servidor — compartida entre
// el store (reservas internas) y la API pública de la landing, para que el
// precio que ve un visitante sea matemáticamente idéntico al que carga el
// personal desde el panel.

import type { RangoPrecio, PromocionesTarifa, ModoCobro, TarifaPrecios, ModalidadNochesCortesia, CampoPersonalizado } from '@/lib/types';

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

export interface DesgloseTarifa {
  tipoTarifa: string;
  modoCobro: ModoCobro;
  noches: number;
  nochesCobrables: number;
  nochesGratis: number;
  adultos: number;
  precioUnitario: number;
  totalAdultos: number;
  ninosCount: number;
  precioNino: number;
  totalNinos: number;
  ahorroCortesia: number;
  total: number;
}

/** Calcula el desglose completo del precio según la tarifa, personas y noches. Null si la tarifa no tiene rangos cargados. */
export function calcularDesgloseTarifa(
  tarifas: Record<string, TarifaPrecios>,
  tipoTarifa: string,
  personas: number,
  noches: number,
  options?: CalcTarifaOptions
): DesgloseTarifa | null {
  const tarifa = tarifas[tipoTarifa] || tarifas['normal'];
  if (!tarifa || !tarifa.rangos || tarifa.rangos.length === 0) return null;

  const promociones = getPromocionesEfectivas(tarifa);
  const modo: ModoCobro = tarifa.modoCobro || 'porGrupo';

  const nochesGratis = calcularNochesGratis(promociones, noches, options?.checkin);
  const nochesCobrables = Math.max(0, noches - nochesGratis);

  const ninosDif = promociones.ninosDiferenciado;
  const cantNinos = (options?.ninos && ninosDif?.activo) ? options.ninos : 0;
  const adultos = Math.max(1, personas - cantNinos);

  let precioUnitario: number;
  let totalAdultos: number;
  if (modo === 'porCama') {
    const rango = encontrarRango(tarifa.rangos, adultos);
    precioUnitario = rango?.precio || tarifa.rangos[0]?.precio || 0;
    totalAdultos = nochesCobrables * adultos * precioUnitario;
  } else if (modo === 'porHabitacion') {
    precioUnitario = tarifa.rangos[0]?.precio || 0;
    totalAdultos = nochesCobrables * precioUnitario;
  } else {
    const rango = encontrarRango(tarifa.rangos, adultos);
    if (!rango) return null;
    precioUnitario = rango.precio;
    totalAdultos = nochesCobrables * precioUnitario;
  }

  const totalNinos = (cantNinos > 0 && ninosDif?.activo) ? cantNinos * (ninosDif.precioNino || 0) * nochesCobrables : 0;
  const subtotalCobrable = totalAdultos + totalNinos;
  const ahorroCortesia = (nochesGratis > 0 && nochesCobrables > 0)
    ? Math.round(subtotalCobrable / nochesCobrables * nochesGratis)
    : 0;

  return {
    tipoTarifa, modoCobro: modo, noches, nochesCobrables, nochesGratis, adultos,
    precioUnitario, totalAdultos, ninosCount: cantNinos, precioNino: ninosDif?.precioNino || 0, totalNinos,
    ahorroCortesia, total: subtotalCobrable,
  };
}

/** Calcula el total a cobrar según la tarifa, cantidad de personas y noches. */
export function calcularTotalSegunTarifa(
  tarifas: Record<string, TarifaPrecios>,
  tipoTarifa: string,
  personas: number,
  noches: number,
  options?: CalcTarifaOptions
): number {
  return calcularDesgloseTarifa(tarifas, tipoTarifa, personas, noches, options)?.total ?? 0;
}

// ==================== DATOS A PEDIR AL RESERVAR ====================
// Cada tarifa pide datos en toda reserva (columna camposPersonalizados) y,
// además, cada promoción puede pedir los suyos, que se piden solo cuando esa
// promoción se aplica en la reserva:
//   - Precio para niños: si la reserva trae niños.
//   - Noches de cortesía: si la estadía tiene al menos una noche gratis.
//   - Acompañante sin cargo: siempre (la tarifa lo incluye en cada reserva).
// Lo usan el panel (Reservas, reserva rápida) y la reserva desde la web, para
// pedir y validar exactamente lo mismo.

export interface GrupoDeCampos {
  /** Para el título de la sección: "Por la promoción Acompañante sin cargo". null = de toda reserva. */
  promocion: string | null;
  campos: CampoPersonalizado[];
}

function camposValidos(raw: unknown): CampoPersonalizado[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is CampoPersonalizado =>
    !!c && typeof c === 'object' && typeof (c as CampoPersonalizado).nombre === 'string' && !!(c as CampoPersonalizado).nombre.trim());
}

export function camposAPedir(
  tarifa: Pick<TarifaPrecios, 'promociones' | 'choferCortesia' | 'habitacionChofer' | 'modoCobro' | 'rangos'> & { camposPersonalizados?: unknown },
  reserva: { noches: number; ninos?: number; checkin?: string },
): GrupoDeCampos[] {
  const grupos: GrupoDeCampos[] = [];
  const generales = camposValidos(tarifa.camposPersonalizados);
  if (generales.length > 0) grupos.push({ promocion: null, campos: generales });

  const promos = getPromocionesEfectivas(tarifa as TarifaPrecios);
  const ninos = promos.ninosDiferenciado;
  if (ninos?.activo && (reserva.ninos ?? 0) > 0) {
    const campos = camposValidos(ninos.camposPersonalizados);
    if (campos.length > 0) grupos.push({ promocion: 'Precio para niños', campos });
  }
  const noches = promos.nochesCortesia;
  if (noches?.activo && calcularNochesGratis(promos, reserva.noches, reserva.checkin) > 0) {
    const campos = camposValidos(noches.camposPersonalizados);
    if (campos.length > 0) grupos.push({ promocion: 'Noches de cortesía', campos });
  }
  const acom = promos.acompananteSinCargo;
  if (acom?.activo) {
    const campos = camposValidos(acom.camposPersonalizados);
    if (campos.length > 0) grupos.push({ promocion: acom.etiqueta || 'Acompañante sin cargo', campos });
  }
  return grupos;
}

/** El primer dato obligatorio que falta, o null si están todos. */
export function campoObligatorioFaltante(grupos: GrupoDeCampos[], datos: Record<string, string | undefined>): string | null {
  for (const g of grupos) {
    for (const c of g.campos) {
      if (c.requerido && !String(datos[c.nombre] ?? '').trim()) return c.nombre;
    }
  }
  return null;
}

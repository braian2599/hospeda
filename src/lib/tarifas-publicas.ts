// ==================== TARIFAS DE LA PÁGINA WEB ====================
// Configuración → Landing → Precios: qué tarifas cobra la web para cada
// tipo de habitación. Se guarda en TenantConfig.tarifasPublicas.
//
// Antes era una sola tarifa por tipo ({ "Doble": "<id>" }). Ahora puede ser
// una lista, una por período ({ "Doble": ["<id General>", "<id Temporada>"] }):
// la web cobra con la que vale el día de salida (src/lib/tarifa-vigencia.ts).
// Se siguen leyendo las configuraciones viejas, con un id suelto.
//
// Regla: para un mismo tipo, dos tarifas no pueden valer el mismo día; si no,
// la web no sabría con cuál cobrar. Se controla al guardar la configuración y
// al cambiar las fechas de una tarifa que ya está en la web.
//
// Pura (sin base de datos): la usan el servidor y la pantalla de Configuración.

import { seSuperponen, describirVigencia, huecosSinTarifa, describirHueco, type ConVigencia } from '@/lib/tarifa-vigencia';

export type MapaTarifasPublicas = Record<string, string[]>;

/** Lee lo guardado (formato viejo o nuevo) y devuelve siempre listas, sin repetidos ni vacíos. */
export function leerTarifasPublicas(raw: unknown): MapaTarifasPublicas {
  const mapa: MapaTarifasPublicas = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return mapa;
  for (const [tipo, valor] of Object.entries(raw as Record<string, unknown>)) {
    const ids = (Array.isArray(valor) ? valor : [valor])
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
    const unicos = [...new Set(ids)];
    if (unicos.length > 0) mapa[tipo] = unicos;
  }
  return mapa;
}

export interface TarifaConFechas extends ConVigencia {
  id: string;
  nombre: string;
}

export interface Pisada {
  tipo: string;
  a: TarifaConFechas;
  b: TarifaConFechas;
}

/** Pares de tarifas que valen el mismo día para el mismo tipo (las desactivadas no cuentan). */
export function tarifasPisadas(mapa: MapaTarifasPublicas, tarifas: TarifaConFechas[]): Pisada[] {
  const porId = new Map(tarifas.map(t => [t.id, t]));
  const pisadas: Pisada[] = [];
  for (const [tipo, ids] of Object.entries(mapa)) {
    const lista = ids.map(id => porId.get(id)).filter((t): t is TarifaConFechas => !!t && t.activa !== false);
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        if (seSuperponen(lista[i], lista[j])) pisadas.push({ tipo, a: lista[i], b: lista[j] });
      }
    }
  }
  return pisadas;
}

/** Mensaje para el dueño sobre una tarifa pisada. */
export function mensajePisada(p: Pisada): string {
  return `${p.tipo}: "${p.a.nombre}" (${describirVigencia(p.a).toLowerCase()}) y "${p.b.nombre}" (${describirVigencia(p.b).toLowerCase()}) valen los mismos días. Para la web, cada día tiene que tener una sola tarifa.`;
}

/**
 * Avisos de días sin tarifa en la web, desde hoy hasta el tope de reservas
 * (Configuración → Landing → Políticas; null = sin tope). Solo para los tipos
 * que tienen al menos una tarifa en la web: un tipo sin ninguna no se vende
 * online a propósito. Agrupa los tipos con el mismo hueco:
 * "Doble y Triple: desde el 01/03/2027".
 */
export function avisosDeHuecos(
  mapa: MapaTarifasPublicas,
  tarifas: TarifaConFechas[],
  tipos: string[],
  hoy: string,
  limite: string | null,
): string[] {
  const porId = new Map(tarifas.map(t => [t.id, t]));
  const porTexto = new Map<string, string[]>();
  for (const tipo of tipos) {
    const lista = (mapa[tipo] || []).map(id => porId.get(id)).filter((t): t is TarifaConFechas => !!t);
    if (lista.length === 0) continue;
    const huecos = huecosSinTarifa(lista, hoy, limite);
    if (huecos.length === 0) continue;
    const texto = huecos.map(describirHueco).join(' y ');
    porTexto.set(texto, [...(porTexto.get(texto) || []), tipo]);
  }
  return [...porTexto.entries()].map(([texto, ts]) => `${unirNombres(ts)}: sin tarifa ${texto}`);
}

function unirNombres(ns: string[]): string {
  return ns.length <= 1 ? (ns[0] ?? '') : `${ns.slice(0, -1).join(', ')} y ${ns[ns.length - 1]}`;
}

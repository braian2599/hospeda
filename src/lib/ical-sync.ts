// ==================== IMPORTAR UN CANAL EXTERNO (Booking/Airbnb) ====================
// Server-only. Lo usan el botón "Sincronizar ahora" y el cron.
//
// ── EL AGUJERO QUE CIERRA ──
// Esto importaba a ciegas: hacía un upsert de cada evento del feed encima de
// lo que hubiera en la habitación, SIN chequear nada. Si el hotel ya había
// vendido esa cama por teléfono o por su propia landing, la reserva de
// Booking se metía igual y nadie se enteraba hasta que llegaban los dos
// huéspedes a la recepción. Una sobreventa silenciosa.
//
// Ahora cada evento pasa por el MISMO chequeo de disponibilidad que usa el
// alta manual de reservas (src/lib/disponibilidad.ts), dentro de una
// transacción con el lock de la habitación tomado.
//
// ── QUÉ SE HACE CUANDO HAY CHOQUE ──
// NO se importa, y se le avisa al hotel. Es la única respuesta honesta: el
// sistema no puede decidir cuál de las dos reservas vale, eso lo resuelve una
// persona llamando a alguien. Lo que no puede pasar es que se importe encima
// y el choque se descubra en el mostrador.
//
// El resto del feed sigue importándose: un choque no puede dejar afuera a las
// otras veinte reservas legítimas. Por eso cada evento va en su propia
// transacción y no todos en una sola.
//
// ── CÓMO SE LE AVISA ──
// Dos vías, porque ninguna alcanza sola:
//  - CanalExterno.lastSyncError: lo que se ve al lado del canal en
//    Configuración. Es el cartel que mira quien va a revisar la integración.
//  - Auditoria: queda el detalle de cada choque en la actividad del hotel,
//    con fechas y todo, que es lo que hace falta para resolverlo.

import { db } from '@/lib/db';
import { parseIcsEvents } from '@/lib/ical';
import { chequearLugar } from '@/lib/disponibilidad';
import { lockHabitacion } from '@/lib/db-lock';
import type { CanalExterno } from '@prisma/client';

const FETCH_TIMEOUT_MS = 10_000;
/** Un feed de una habitación sola no pesa esto ni de casualidad. */
const MAX_BYTES_FEED = 2_000_000;
/** Tope de eventos por feed. Un año de reservas de una habitación son ~100. */
const MAX_EVENTOS = 400;
/** Más allá de esto, la fecha es basura del feed y no una reserva real. */
const MAX_ANIOS_ADELANTE = 3;
/** Cuántos choques se detallan en el aviso antes de resumir. */
const CHOQUES_A_DETALLAR = 5;

const NOMBRE_CANAL: Record<string, string> = {
  booking: 'Booking.com',
  airbnb: 'Airbnb',
};

function nombreDeCanal(canal: string): string {
  return NOMBRE_CANAL[canal] || canal;
}

const comoFecha = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');

/**
 * Trae el .ics cortando por tamaño además de por tiempo.
 *
 * El timeout solo no alcanza: un servidor que responde rápido pero manda un
 * cuerpo enorme se comería la memoria del proceso antes de que salte. Se lee
 * de a pedazos y se corta al pasar el tope.
 */
async function fetchIcs(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('La URL debe ser http:// o https://');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Hospi-iCal-Sync/1.0' } });
    if (!res.ok) throw new Error(`El servidor externo respondió ${res.status}`);
    if (!res.body) return await res.text();

    const lector = res.body.getReader();
    const decodificador = new TextDecoder();
    let texto = '';
    let bytes = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES_FEED) {
        await lector.cancel();
        throw new Error('El feed externo es demasiado grande');
      }
      texto += decodificador.decode(value, { stream: true });
    }
    return texto + decodificador.decode();
  } finally {
    clearTimeout(timeout);
  }
}

/** Un evento del feed que no se pudo importar, y por qué. */
export interface EventoOmitido {
  uid: string;
  desde: string;
  hasta: string;
  motivo: string;
}

export interface SyncResult {
  success: boolean;
  eventosImportados?: number;
  omitidos?: EventoOmitido[];
  error?: string;
}

/**
 * Identificador estable de un evento del feed.
 *
 * Si el feed trae UID, se usa tal cual: es lo que permite reconocer la misma
 * reserva entre una sincronización y la siguiente.
 *
 * Si NO lo trae, el de reemplazo incluye el canal y la habitación. El viejo
 * usaba solo las fechas, así que dos reservas del mismo rango —dos camas de
 * un compartido, o dos habitaciones distintas del mismo hotel— quedaban con
 * el mismo identificador y se pisaban entre sí.
 */
function identificador(canal: Pick<CanalExterno, 'canal' | 'habitacion'>, ev: { uid: string | null; checkin: Date; checkout: Date }): string {
  if (ev.uid) return ev.uid;
  return `sin-uid:${canal.canal}:${canal.habitacion}:${comoFecha(ev.checkin)}-${comoFecha(ev.checkout)}`;
}

export interface FeedDepurado {
  /** Los eventos que van a intentar importarse. */
  aImportar: { uid: string; checkin: Date; checkout: Date }[];
  /** Los que ni se intentan, con el motivo. */
  omitidos: EventoOmitido[];
  /**
   * TODOS los identificadores que aparecieron en el feed, incluidos los que se
   * descartaron.
   *
   * OJO, ACÁ HAY UNA TRAMPA: esta lista es la que decide qué reservas se
   * cancelan por "ya no están en el feed". Si solo llevara las que se
   * importaron, un evento con las fechas al revés —o uno que cayó fuera del
   * tope— haría que su reserva, que existe y está vendida, se cancelara sola.
   * Un error del feed borrando una reserva real.
   *
   * La regla: solo se cancela lo que DESAPARECIÓ del feed. Que un evento venga
   * mal no significa que la reserva no exista más. Peor un bloqueo de más que
   * una cama liberada por error.
   */
  uidsDelFeed: string[];
}

/**
 * Limpia el feed antes de tocar la base: rangos imposibles, repetidos y
 * volumen absurdo.
 *
 * Es pura a propósito —no consulta nada— para poder probarla de verdad: es la
 * parte donde un error silencioso se traduce en reservas canceladas.
 */
export function depurarFeed(
  canal: Pick<CanalExterno, 'canal' | 'habitacion'>,
  crudos: { uid: string | null; checkin: Date; checkout: Date }[],
  ahora: Date = new Date(),
): FeedDepurado {
  const omitidos: EventoOmitido[] = [];
  const aImportar: FeedDepurado['aImportar'] = [];
  const todos = new Set<string>();
  const yaVistos = new Set<string>();

  const topeFuturo = new Date(ahora);
  topeFuturo.setFullYear(topeFuturo.getFullYear() + MAX_ANIOS_ADELANTE);

  for (const ev of crudos) {
    const uid = identificador(canal, ev);
    todos.add(uid);
    const registrar = (motivo: string) =>
      omitidos.push({ uid, desde: comoFecha(ev.checkin), hasta: comoFecha(ev.checkout), motivo });

    // Un rango invertido o de cero noches no es una reserva, y contra un rango
    // así el chequeo de solapamiento no significa nada.
    if (ev.checkout <= ev.checkin) {
      registrar('las fechas están al revés o son el mismo día');
      continue;
    }
    if (ev.checkin > topeFuturo) {
      registrar(`la fecha está a más de ${MAX_ANIOS_ADELANTE} años`);
      continue;
    }
    // Dos eventos con el mismo identificador en el mismo feed: gana el
    // primero. Antes el segundo pisaba al primero sin dejar rastro.
    if (yaVistos.has(uid)) {
      registrar('viene repetido en el feed');
      continue;
    }
    if (aImportar.length >= MAX_EVENTOS) {
      registrar(`el feed pasa las ${MAX_EVENTOS} reservas`);
      continue;
    }

    yaVistos.add(uid);
    aImportar.push({ uid, checkin: ev.checkin, checkout: ev.checkout });
  }

  return { aImportar, omitidos, uidsDelFeed: [...todos] };
}

/** Trae el .ics, importa lo que entra, anota lo que choca y cancela lo que ya no está. */
export async function syncCanalExterno(canal: CanalExterno): Promise<SyncResult> {
  const urlToSync = canal.importUrl?.trim();
  if (!urlToSync) {
    return { success: false, error: 'No hay URL de importación configurada' };
  }

  try {
    const icsText = await fetchIcs(urlToSync);
    const crudos = parseIcsEvents(icsText);

    // ── La habitación tiene que existir ──
    // Sin esto se importarían reservas a una habitación fantasma: invisibles
    // en el mapa, imposibles de gestionar, y sin capacidad contra la que
    // chequear nada. Es un canal mal configurado, no un problema del feed.
    const room = await db.habitacion.findUnique({
      where: { tenantId_numero: { tenantId: canal.tenantId, numero: canal.habitacion } },
      select: { tipo: true, capacidad: true },
    });
    if (!room) {
      throw new Error(`La habitación "${canal.habitacion}" ya no existe. Revisá la configuración del canal.`);
    }

    const { aImportar, omitidos, uidsDelFeed } = depurarFeed(canal, crudos);

    // ── Importar de a uno ──
    let importados = 0;
    for (const ev of aImportar) {
      const registrar = (motivo: string) =>
        omitidos.push({ uid: ev.uid, desde: comoFecha(ev.checkin), hasta: comoFecha(ev.checkout), motivo });

      // Cada evento en su propia transacción: un choque no puede dejar sin
      // importar al resto del feed. Y con el lock de la habitación tomado,
      // porque si no una reserva manual creada en el mismo instante podría
      // colarse entre el chequeo y el insert.
      const resultado = await db.$transaction(async (tx) => {
        await lockHabitacion(tx, canal.tenantId, canal.habitacion);

        const existente = await tx.reserva.findUnique({
          where: { tenantId_externalUid: { tenantId: canal.tenantId, externalUid: ev.uid } },
          select: { id: true, habitacion: true, origen: true },
        });

        // El identificador es único por hotel, no por habitación. Si ya está
        // usado en otra habitación o por otro canal, importar acá movería una
        // reserva de lugar sin que nadie lo pida.
        if (existente && (existente.habitacion !== canal.habitacion || existente.origen !== canal.canal)) {
          return { ok: false as const, motivo: `ese identificador ya lo usa una reserva de "${existente.habitacion}"` };
        }

        // Una reserva de canal externo ocupa una cama (es lo que se guarda
        // abajo en personas). En una habitación entera alcanza para bloquearla.
        const veredicto = await chequearLugar(tx, room, {
          tenantId: canal.tenantId,
          habitacion: canal.habitacion,
          checkin: ev.checkin,
          checkout: ev.checkout,
          camas: 1,
          // Al re-sincronizar, la reserva ya está en la base: sin esto
          // chocaría consigo misma y no se podría actualizar nunca.
          excluirReservaId: existente?.id,
        });
        if (!veredicto.entra) {
          return { ok: false as const, motivo: veredicto.motivo };
        }

        await tx.reserva.upsert({
          where: { tenantId_externalUid: { tenantId: canal.tenantId, externalUid: ev.uid } },
          create: {
            tenantId: canal.tenantId,
            habitacion: canal.habitacion,
            checkin: ev.checkin,
            checkout: ev.checkout,
            personas: 1,
            huesped: `Reserva ${nombreDeCanal(canal.canal)}`,
            dni: '',
            telefono: '',
            origen: canal.canal,
            externalUid: ev.uid,
            estado: 'Confirmada',
          },
          update: {
            checkin: ev.checkin,
            checkout: ev.checkout,
            estado: 'Confirmada',
          },
        });
        return { ok: true as const };
      });

      if (resultado.ok) importados++;
      else registrar(resultado.motivo);
    }

    // ── Cancelar lo que ya no está en el feed ──
    // Se comparan contra TODOS los identificadores del feed, incluidos los que
    // se omitieron: un evento que choca sigue existiendo en Booking, así que
    // cancelar la reserva que ya teníamos sería liberar una cama vendida.
    await db.reserva.updateMany({
      where: {
        tenantId: canal.tenantId,
        habitacion: canal.habitacion,
        origen: canal.canal,
        externalUid: { notIn: uidsDelFeed.length > 0 ? uidsDelFeed : ['__none__'] },
        estado: { not: 'Cancelada' },
      },
      data: { estado: 'Cancelada' },
    });

    const aviso = omitidos.length > 0 ? armarAviso(canal, omitidos) : null;
    await db.canalExterno.update({
      where: { id: canal.id },
      data: { lastSyncAt: new Date(), lastSyncError: aviso },
    });
    if (aviso) await anotarEnAuditoria(canal, omitidos, aviso);

    return { success: true, eventosImportados: importados, omitidos };
  } catch (syncError: unknown) {
    const message = (syncError as Error).message || 'Error al sincronizar';
    await db.canalExterno.update({ where: { id: canal.id }, data: { lastSyncError: message } });
    return { success: false, error: message };
  }
}

/** El cartel corto que se ve al lado del canal en Configuración. */
function armarAviso(canal: CanalExterno, omitidos: EventoOmitido[]): string {
  const cuantas = omitidos.length;
  return `${cuantas} ${cuantas === 1 ? 'reserva' : 'reservas'} de ${nombreDeCanal(canal.canal)} no se ${cuantas === 1 ? 'importó' : 'importaron'} en "${canal.habitacion}". Mirá el detalle en la actividad reciente del hotel.`;
}

/**
 * Deja el detalle en la actividad del hotel, sin repetirse.
 *
 * Un choque no se arregla solo: vuelve a aparecer en cada sincronización. Si
 * se anotara siempre, con el cron andando el hotel tendría cincuenta entradas
 * idénticas por día y dejaría de leerlas. Se compara contra la última entrada
 * de este tipo: si dice exactamente lo mismo, no se anota de nuevo. Cuando la
 * situación cambia —se resolvió uno, apareció otro— el texto cambia y se
 * vuelve a anotar.
 */
async function anotarEnAuditoria(canal: CanalExterno, omitidos: EventoOmitido[], aviso: string): Promise<void> {
  const detalles = omitidos
    .slice(0, CHOQUES_A_DETALLAR)
    .map(o => `${o.desde} → ${o.hasta}: ${o.motivo}`)
    .join(' · ');
  const resto = omitidos.length > CHOQUES_A_DETALLAR
    ? ` (y ${omitidos.length - CHOQUES_A_DETALLAR} más)`
    : '';
  const detalle = `${aviso} ${detalles}${resto}`;

  const ultima = await db.auditoria.findFirst({
    where: { tenantId: canal.tenantId, tipo: TIPO_AUDITORIA },
    orderBy: { createdAt: 'desc' },
    select: { detalle: true },
  });
  if (ultima?.detalle === detalle) return;

  await db.auditoria.create({
    data: {
      tenantId: canal.tenantId,
      tipo: TIPO_AUDITORIA,
      detalle,
      empleado: `Sincronización ${nombreDeCanal(canal.canal)}`,
      empleadoId: null,
    },
  });
}

const TIPO_AUDITORIA = 'Conflicto de sincronización';

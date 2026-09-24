// ==================== ARCA — Consulta de CUIT (constancia de inscripción) ====================
// Dado un CUIT, trae de ARCA el nombre o razón social, el domicilio fiscal y
// la condición frente al IVA. Es el botón "Traer de ARCA" del alta de un
// titular de cuenta corriente.
//
// Servicio: ws_sr_constancia_inscripcion ("Servicio Consulta Constancia de
// Inscripción"), operación getPersona_v2. Endpoints, namespace y estructura
// de la respuesta salen del WSDL oficial (el mismo que distribuye el SDK
// @afipsdk/afip.js). Usa el MISMO certificado que facturar, pero el hotel
// tiene que habilitar este servicio aparte en ARCA: ver traducirErrorWsaa.

import { db } from '@/lib/db';
import type { CondicionIva } from '@/lib/cuenta-corriente';
import { AfipError, type AfipAmbiente } from './config';
import { soapCall, xmlEscape } from './soap';
import { getWsaaTicket } from './wsaa';

export const PADRON_URLS: Record<AfipAmbiente, string> = {
  homologacion: 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5',
  produccion: 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5',
};

/** Códigos de impuesto de ARCA que definen la condición de IVA. */
const IMPUESTO = {
  IVA: 30,
  IVA_EXENTO: 32,
  IVA_NO_INSCRIPTO: 33,
  IVA_NO_ALCANZADO: 34,
  MONOTRIBUTO: 20,
  MONOTRIBUTO_AUTONOMO: 21,
} as const;

export interface DatosPadron {
  cuit: string;
  nombre: string;
  /** FISICA → persona, JURIDICA → empresa. null si ARCA no lo dijo. */
  tipo: 'empresa' | 'persona' | null;
  /** null cuando ARCA avisó un problema: mejor que la elija una persona. */
  condicionIva: CondicionIva | null;
  domicilioFiscal: string | null;
  /** Lo que ARCA avisó (CUIT inactiva, constancia con errores...). */
  avisos: string[];
}

/** fast-xml-parser devuelve un objeto si hay uno solo y un array si hay varios. */
function lista<T>(x: T | T[] | null | undefined): T[] {
  if (x == null || x === '') return [];
  return Array.isArray(x) ? x : [x];
}

function texto(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

/**
 * La condición de IVA a partir de los impuestos inscriptos. Es la misma regla
 * que usa pyafipws (padrón A5): primero Exento (32), después IVA (30) si no
 * figura como no inscripto (33) o no alcanzado (34), después Monotributo, y
 * si no es nada de eso, Consumidor Final.
 */
export function condicionIvaDesdeImpuestos(impuestos: readonly number[], esMonotributo: boolean): CondicionIva {
  if (impuestos.includes(IMPUESTO.IVA_EXENTO)) return 'Exento';
  const noInscripto = impuestos.includes(IMPUESTO.IVA_NO_INSCRIPTO) || impuestos.includes(IMPUESTO.IVA_NO_ALCANZADO);
  if (!noInscripto && impuestos.includes(IMPUESTO.IVA)) return 'Responsable Inscripto';
  if (esMonotributo) return 'Monotributista';
  return 'Consumidor Final';
}

/**
 * Lee el cuerpo SOAP de getPersona_v2 (ya parseado por soapCall: sin
 * prefijos y todo como texto). null si no vino ninguna persona.
 */
export function leerRespuestaPadron(body: any, cuit: string): DatosPadron | null {
  const ret = body?.getPersona_v2Response?.personaReturn;
  if (!ret || typeof ret !== 'object') return null;

  const avisos: string[] = [];
  for (const bloque of ['errorConstancia', 'errorMonotributo', 'errorRegimenGeneral']) {
    const e = ret[bloque];
    if (!e) continue;
    for (const msg of lista(e.error)) if (texto(msg)) avisos.push(texto(msg));
    if (texto(e.mensaje)) avisos.push(texto(e.mensaje));
  }
  const conErrores = avisos.length > 0;

  const generales = Array.isArray(ret.datosGenerales) ? ret.datosGenerales[0] : ret.datosGenerales;
  // Sin datosGenerales y sin errores no hay nada que mostrar. Con errores
  // (p. ej. una constancia que ARCA no puede emitir) se devuelven igual, para
  // que la persona lea por qué.
  if (!generales && !conErrores) return null;

  const g = generales ?? {};
  const razonSocial = texto(g.razonSocial);
  const nombre = razonSocial || [texto(g.apellido), texto(g.nombre)].filter(Boolean).join(' ')
    // errorConstancia repite apellido y nombre cuando no puede dar la constancia.
    || [texto(ret.errorConstancia?.apellido), texto(ret.errorConstancia?.nombre)].filter(Boolean).join(' ');

  const tipoPersona = texto(g.tipoPersona).toUpperCase();
  const tipo = tipoPersona === 'JURIDICA' ? 'empresa' : tipoPersona === 'FISICA' ? 'persona' : null;

  const estado = texto(g.estadoClave);
  if (estado && estado.toUpperCase() !== 'ACTIVO') avisos.push(`ARCA informa la CUIT como "${estado}".`);

  const dom = g.domicilioFiscal ?? {};
  const cp = texto(dom.codPostal);
  const localidad = [texto(dom.localidad), cp ? `(${cp})` : ''].filter(Boolean).join(' ');
  const domicilioFiscal = [texto(dom.direccion), localidad, texto(dom.descripcionProvincia)]
    .filter(Boolean).join(', ').slice(0, 300) || null;

  const mt = ret.datosMonotributo ?? {};
  const rg = ret.datosRegimenGeneral ?? {};
  const impuestos = [...lista(mt.impuesto), ...lista(rg.impuesto)]
    .map(i => Number(i?.idImpuesto))
    .filter(Number.isFinite);
  const esMonotributo = !!mt.categoriaMonotributo
    || impuestos.includes(IMPUESTO.MONOTRIBUTO) || impuestos.includes(IMPUESTO.MONOTRIBUTO_AUTONOMO);

  return {
    cuit,
    nombre: nombre.slice(0, 200),
    tipo,
    // Si ARCA avisó errores, puede faltar un bloque entero (el de régimen
    // general, p. ej.) y la regla de arriba diría "Consumidor Final" sin
    // serlo. En ese caso no se adivina.
    condicionIva: conErrores ? null : condicionIvaDesdeImpuestos(impuestos, esMonotributo),
    domicilioFiscal,
    avisos,
  };
}

/**
 * Consulta un CUIT en ARCA con el certificado del hotel. null si ARCA dice
 * que no existe. Los demás problemas se lanzan como AfipError.
 */
export async function consultarPadron(tenantId: string, cuit: string): Promise<DatosPadron | null> {
  const config = await db.tenantAfip.findUnique({ where: { tenantId }, select: { cuit: true, ambiente: true } });
  const cuitHotel = (config?.cuit || '').replace(/\D/g, '');
  if (cuitHotel.length !== 11) {
    throw new AfipError('Falta el CUIT del hotel en Configuración → ARCA.', 'MISSING_CONFIG');
  }

  const { token, sign } = await getWsaaTicket(tenantId, 'ws_sr_constancia_inscripcion');

  const bodyXml = `<a5:getPersona_v2 xmlns:a5="http://a5.soap.ws.server.puc.sr/">
      <token>${xmlEscape(token)}</token>
      <sign>${xmlEscape(sign)}</sign>
      <cuitRepresentada>${xmlEscape(cuitHotel)}</cuitRepresentada>
      <idPersona>${xmlEscape(cuit)}</idPersona>
    </a5:getPersona_v2>`;

  let body: unknown;
  try {
    body = await soapCall(PADRON_URLS[(config!.ambiente as AfipAmbiente) || 'homologacion'], '', bodyXml);
  } catch (err) {
    // ARCA contesta un SOAP fault "No existe persona con ese Id". Un fault de
    // SOAP 1.1 viaja con HTTP 500, y soapCall corta ahí (código 'HTTP') con
    // el texto de la respuesta en el mensaje: por eso se miran los dos.
    if (err instanceof AfipError && (err.code === 'SOAP_FAULT' || err.code === 'HTTP') && /no existe persona/i.test(err.message)) return null;
    throw err;
  }
  return leerRespuestaPadron(body, cuit);
}

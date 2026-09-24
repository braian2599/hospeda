// ==================== AFIP/ARCA — WSAA (autenticación) ====================
// Antes de poder llamar a cualquier servicio de AFIP (WSFEv1 incluido) hay
// que autenticarse contra WSAA: se firma un "Login Ticket Request" (un XML
// simple) como CMS/PKCS#7 usando el certificado y la clave privada del
// hotel, y AFIP devuelve un Token+Sign válidos por ~12hs. Ese Token+Sign
// es lo que se manda en cada llamada posterior a WSFEv1.
//
// El ticket se cachea en TenantAfip para no volver a autenticar en cada
// emisión de comprobante — además de ser innecesario, AFIP rate-limitea los
// logins repetidos.
//
// UN TICKET POR SERVICIO. ARCA da un ticket distinto para cada servicio
// (facturar, consultar un CUIT...) y no entrega otro mientras el anterior siga
// vigente: responde coe.alreadyAuthenticated. Por eso cada servicio guarda el
// suyo en sus propias columnas (ver COLUMNAS). Si compartieran columnas, el
// ticket de uno pisaría al del otro y el siguiente login fallaría por hasta 12 h.

import forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { afipUrls, AfipError, type AfipAmbiente } from './config';
import { soapCall, xmlEscape } from './soap';

/** Los servicios de ARCA que usa el sistema. */
export type ServicioArca = 'wsfe' | 'ws_sr_constancia_inscripcion';

/** Dónde guarda su ticket cada servicio en TenantAfip. */
const COLUMNAS = {
  wsfe: { token: 'wsaaToken', sign: 'wsaaSign', expiracion: 'wsaaExpiracion' },
  ws_sr_constancia_inscripcion: { token: 'wsaaPadronToken', sign: 'wsaaPadronSign', expiracion: 'wsaaPadronExpiracion' },
} as const;

/**
 * Borra TODOS los tickets guardados. Para cuando cambia el certificado o el
 * ambiente: un ticket viejo ya no sirve. Está acá, en un solo lugar, para que
 * agregar un servicio nuevo no obligue a acordarse de cada ruta que los borra.
 */
export const SIN_TICKETS_WSAA = {
  wsaaToken: null, wsaaSign: null, wsaaExpiracion: null,
  wsaaPadronToken: null, wsaaPadronSign: null, wsaaPadronExpiracion: null,
} as const;

function datosDelTicket(servicio: ServicioArca, t: { token: string; sign: string; expirationTime: Date }): Prisma.TenantAfipUpdateInput {
  return servicio === 'wsfe'
    ? { wsaaToken: t.token, wsaaSign: t.sign, wsaaExpiracion: t.expirationTime }
    : { wsaaPadronToken: t.token, wsaaPadronSign: t.sign, wsaaPadronExpiracion: t.expirationTime };
}

/** El ticket guardado de ese servicio, si todavía sirve. */
function ticketVigente(
  config: Record<string, unknown>,
  servicio: ServicioArca,
): WsaaTicket | null {
  const col = COLUMNAS[servicio];
  const token = config[col.token] as string | null;
  const sign = config[col.sign] as string | null;
  const expiracion = config[col.expiracion] as Date | null;
  if (token && sign && expiracion && expiracion.getTime() - Date.now() > RENOVAR_SI_VENCE_EN_MS) {
    return { token, sign };
  }
  return null;
}

/**
 * Los dos errores de WSAA que el hotel tiene que entender, dichos en criollo.
 * Los códigos y textos son los de la especificación de WSAA de ARCA.
 */
function traducirErrorWsaa(err: unknown, servicio: ServicioArca): unknown {
  const msg = err instanceof Error ? err.message : String(err);
  if (/notAuthorized|no autorizado a acceder/i.test(msg)) {
    return new AfipError(
      servicio === 'ws_sr_constancia_inscripcion'
        ? 'El certificado del hotel no tiene habilitada la consulta de CUIT en ARCA. Se habilita en ARCA → Administrador de Relaciones de Clave Fiscal → Adherir servicio → ARCA → Webservices → "Servicio Consulta Constancia de Inscripción", con el mismo certificado que se usa para facturar.'
        : 'El certificado del hotel no tiene habilitado este servicio en ARCA (Administrador de Relaciones de Clave Fiscal).',
      'WSAA_NO_AUTORIZADO',
    );
  }
  if (/alreadyAuthenticated|ya posee un TA/i.test(msg)) {
    return new AfipError(
      'ARCA ya le dio un permiso vigente a este certificado desde otro sistema (dura hasta 12 horas) y no entrega otro hasta que venza. Probá más tarde.',
      'WSAA_YA_AUTENTICADO',
    );
  }
  return err;
}
// Margen de seguridad: si el ticket cacheado vence en menos de este tiempo,
// se pide uno nuevo en vez de arriesgarse a que expire a mitad de una
// emisión de comprobante.
const RENOVAR_SI_VENCE_EN_MS = 5 * 60 * 1000;

interface WsaaTicket {
  token: string;
  sign: string;
}

function buildLoginTicketRequestXml(servicio: ServicioArca): string {
  const now = new Date();
  const generationTime = new Date(now.getTime() - 60_000); // -1min por tolerancia de reloj
  const expirationTime = new Date(now.getTime() + 10 * 60_000); // +10min
  const uniqueId = Math.floor(now.getTime() / 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${uniqueId}</uniqueId>
    <generationTime>${generationTime.toISOString()}</generationTime>
    <expirationTime>${expirationTime.toISOString()}</expirationTime>
  </header>
  <service>${servicio}</service>
</loginTicketRequest>`;
}

/** Firma el XML del Login Ticket Request como CMS/PKCS#7 (SignedData, embebido, DER, base64). */
function signLoginTicketRequest(xml: string, certificadoPem: string, clavePrivadaPem: string): string {
  let cert: forge.pki.Certificate;
  let privateKey: forge.pki.PrivateKey;
  try {
    cert = forge.pki.certificateFromPem(certificadoPem);
    privateKey = forge.pki.privateKeyFromPem(clavePrivadaPem);
  } catch (err) {
    throw new AfipError(`Certificado o clave privada inválidos: ${(err as Error).message}`, 'CERT_INVALID');
  }

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(xml, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest }, // forge lo completa automáticamente al firmar
      { type: forge.pki.oids.signingTime }, // ídem — usa la hora actual si no se pasa `value`
    ],
  });
  p7.sign({ detached: false });

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return forge.util.encode64(der);
}

/** Llama a WSAA (LoginCms) y devuelve el Token+Sign+vencimiento crudos, sin tocar la DB. */
async function loginCms(cmsBase64: string, ambiente: AfipAmbiente): Promise<{ token: string; sign: string; expirationTime: Date }> {
  const bodyXml = `<loginCms xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov">
      <in0>${xmlEscape(cmsBase64)}</in0>
    </loginCms>`;

  const body = await soapCall(afipUrls(ambiente).wsaa, '', bodyXml);
  const raw = body?.loginCmsResponse?.loginCmsReturn;
  if (!raw || typeof raw !== 'string') {
    throw new AfipError('WSAA no devolvió un Login Ticket Response válido.', 'WSAA_EMPTY');
  }

  // loginCmsReturn viene como un XML completo dentro de un string — hay
  // que parsearlo de nuevo (fast-xml-parser ya des-escapó las entidades).
  const innerParser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true });
  const inner = innerParser.parse(raw);
  const credentials = inner?.loginTicketResponse?.credentials;
  const header = inner?.loginTicketResponse?.header;
  if (!credentials?.token || !credentials?.sign) {
    throw new AfipError('WSAA no devolvió Token/Sign en la respuesta.', 'WSAA_NO_CREDENTIALS');
  }

  const expirationTime = header?.expirationTime ? new Date(header.expirationTime) : new Date(Date.now() + 11 * 60 * 60 * 1000);
  return { token: credentials.token, sign: credentials.sign, expirationTime };
}

/**
 * Devuelve un Token+Sign válido para el tenant y ese servicio, reutilizando
 * el guardado si todavía no está por vencer. Si hace falta uno nuevo, toma
 * un advisory lock por tenant y servicio para que dos requests concurrentes
 * no disparen dos logins a la vez contra WSAA (AFIP los rate-limitea).
 *
 * Sin servicio es 'wsfe' (facturar): así llaman todas las rutas que ya
 * existían, que siguen funcionando exactamente igual.
 */
export async function getWsaaTicket(tenantId: string, servicio: ServicioArca = 'wsfe'): Promise<WsaaTicket> {
  const config = await db.tenantAfip.findUnique({ where: { tenantId } });
  if (!config || !config.activo || !config.certificadoPem || !config.clavePrivadaPem) {
    throw new AfipError('No hay un certificado de AFIP cargado y activo para este hotel.', 'NO_CERT');
  }

  const guardado = ticketVigente(config, servicio);
  if (guardado) return guardado;

  // El candado de 'wsfe' es el mismo que antes (no cambia nada para
  // facturar); cada servicio nuevo tiene el suyo, así una consulta de CUIT
  // no espera a que termine una factura.
  const candado = servicio === 'wsfe' ? `afip-wsaa:${tenantId}` : `afip-wsaa:${tenantId}:${servicio}`;

  return db.$transaction(async (tx) => {
    // Lock por tenant — evita que dos requests simultáneas (p.ej. dos
    // recepcionistas emitiendo comprobantes al mismo tiempo) disparen dos
    // logins a WSAA en paralelo.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${candado}))`;

    // Re-chequear: otra transacción puede haber renovado el ticket mientras
    // esperábamos el lock.
    const fresh = await tx.tenantAfip.findUnique({ where: { tenantId } });
    if (!fresh || !fresh.activo || !fresh.certificadoPem || !fresh.clavePrivadaPem) {
      throw new AfipError('No hay un certificado de AFIP cargado y activo para este hotel.', 'NO_CERT');
    }
    const renovadoPorOtro = ticketVigente(fresh, servicio);
    if (renovadoPorOtro) return renovadoPorOtro;

    const claveDescifrada = decrypt(fresh.clavePrivadaPem);
    const xml = buildLoginTicketRequestXml(servicio);
    const cms = signLoginTicketRequest(xml, fresh.certificadoPem, claveDescifrada);

    let ticket: { token: string; sign: string; expirationTime: Date };
    try {
      ticket = await loginCms(cms, fresh.ambiente as AfipAmbiente);
    } catch (err) {
      // ultimoError es el estado de FACTURAR que muestra Configuración: un
      // error de la consulta de CUIT no tiene que aparecer ahí como si la
      // facturación estuviera rota.
      if (servicio === 'wsfe') {
        await tx.tenantAfip.update({
          where: { tenantId },
          data: { ultimoError: (err as Error).message.slice(0, 500) },
        });
      }
      throw traducirErrorWsaa(err, servicio);
    }

    await tx.tenantAfip.update({
      where: { tenantId },
      data: {
        ...datosDelTicket(servicio, ticket),
        ...(servicio === 'wsfe' ? { ultimaConexionOk: new Date(), ultimoError: null } : {}),
      },
    });

    return { token: ticket.token, sign: ticket.sign };
  });
}

/**
 * Fuerza un login nuevo (ignora el ticket cacheado) — usado por el botón
 * "Probar conexión" en Configuración, para validar que el certificado
 * realmente funciona en este mismo momento.
 */
export async function probarConexionWsaa(tenantId: string): Promise<void> {
  await db.tenantAfip.update({ where: { tenantId }, data: { wsaaExpiracion: new Date(0) } });
  await getWsaaTicket(tenantId);
}

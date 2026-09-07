// ==================== AFIP/ARCA — WSAA (autenticación) ====================
// Antes de poder llamar a cualquier servicio de AFIP (WSFEv1 incluido) hay
// que autenticarse contra WSAA: se firma un "Login Ticket Request" (un XML
// simple) como CMS/PKCS#7 usando el certificado y la clave privada del
// hotel, y AFIP devuelve un Token+Sign válidos por ~12hs. Ese Token+Sign
// es lo que se manda en cada llamada posterior a WSFEv1.
//
// El ticket se cachea en TenantAfip (wsaaToken/wsaaSign/wsaaExpiracion)
// para no volver a autenticar en cada emisión de comprobante — además de
// ser innecesario, AFIP rate-limitea los logins repetidos.

import forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { afipUrls, AfipError, type AfipAmbiente } from './config';
import { soapCall, xmlEscape } from './soap';

const SERVICE = 'wsfe';
// Margen de seguridad: si el ticket cacheado vence en menos de este tiempo,
// se pide uno nuevo en vez de arriesgarse a que expire a mitad de una
// emisión de comprobante.
const RENOVAR_SI_VENCE_EN_MS = 5 * 60 * 1000;

interface WsaaTicket {
  token: string;
  sign: string;
}

function buildLoginTicketRequestXml(): string {
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
  <service>${SERVICE}</service>
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
 * Devuelve un Token+Sign válido para el tenant, reutilizando el cacheado en
 * DB si todavía no está por vencer. Si hace falta uno nuevo, toma un
 * advisory lock por tenant para que dos requests concurrentes no disparen
 * dos logins a la vez contra WSAA (AFIP los rate-limitea).
 */
export async function getWsaaTicket(tenantId: string): Promise<WsaaTicket> {
  const config = await db.tenantAfip.findUnique({ where: { tenantId } });
  if (!config || !config.activo || !config.certificadoPem || !config.clavePrivadaPem) {
    throw new AfipError('No hay un certificado de AFIP cargado y activo para este hotel.', 'NO_CERT');
  }

  if (config.wsaaToken && config.wsaaSign && config.wsaaExpiracion) {
    const msRestantes = config.wsaaExpiracion.getTime() - Date.now();
    if (msRestantes > RENOVAR_SI_VENCE_EN_MS) {
      return { token: config.wsaaToken, sign: config.wsaaSign };
    }
  }

  return db.$transaction(async (tx) => {
    // Lock por tenant — evita que dos requests simultáneas (p.ej. dos
    // recepcionistas emitiendo comprobantes al mismo tiempo) disparen dos
    // logins a WSAA en paralelo.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'afip-wsaa:' + tenantId}))`;

    // Re-chequear: otra transacción puede haber renovado el ticket mientras
    // esperábamos el lock.
    const fresh = await tx.tenantAfip.findUnique({ where: { tenantId } });
    if (!fresh || !fresh.activo || !fresh.certificadoPem || !fresh.clavePrivadaPem) {
      throw new AfipError('No hay un certificado de AFIP cargado y activo para este hotel.', 'NO_CERT');
    }
    if (fresh.wsaaToken && fresh.wsaaSign && fresh.wsaaExpiracion) {
      const msRestantes = fresh.wsaaExpiracion.getTime() - Date.now();
      if (msRestantes > RENOVAR_SI_VENCE_EN_MS) {
        return { token: fresh.wsaaToken, sign: fresh.wsaaSign };
      }
    }

    const claveDescifrada = decrypt(fresh.clavePrivadaPem);
    const xml = buildLoginTicketRequestXml();
    const cms = signLoginTicketRequest(xml, fresh.certificadoPem, claveDescifrada);

    let ticket: { token: string; sign: string; expirationTime: Date };
    try {
      ticket = await loginCms(cms, fresh.ambiente as AfipAmbiente);
    } catch (err) {
      await tx.tenantAfip.update({
        where: { tenantId },
        data: { ultimoError: (err as Error).message.slice(0, 500) },
      });
      throw err;
    }

    await tx.tenantAfip.update({
      where: { tenantId },
      data: {
        wsaaToken: ticket.token,
        wsaaSign: ticket.sign,
        wsaaExpiracion: ticket.expirationTime,
        ultimaConexionOk: new Date(),
        ultimoError: null,
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

// ==================== AFIP/ARCA — Helper SOAP mínimo ====================
// AFIP expone WSAA/WSFEv1 como servicios SOAP 1.1 clásicos. No hay ningún
// cliente SOAP en el resto del repo (ver investigación previa), así que en
// vez de sumar una librería SOAP genérica (más superficie, más difícil de
// auditar) armamos el sobre a mano con un template string y parseamos la
// respuesta con fast-xml-parser ignorando los prefijos de namespace — así
// no importa si AFIP usa "soap:", "soapenv:" u otro prefijo.

import { XMLParser } from 'fast-xml-parser';
import { AfipError } from './config';

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false, // mantenemos todo como string — nosotros decidimos cómo tipar cada campo
});

/** Envuelve un cuerpo SOAP y lo envía por POST. Devuelve el body ya parseado a objeto. */
export async function soapCall(url: string, soapAction: string, bodyXml: string): Promise<any> {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${bodyXml}
  </soap:Body>
</soap:Envelope>`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': soapAction,
      },
      body: envelope,
    });
  } catch (err) {
    throw new AfipError(`No se pudo conectar con AFIP (${url}): ${(err as Error).message}`, 'NETWORK');
  }

  const text = await res.text();
  if (!res.ok) {
    throw new AfipError(`AFIP respondió ${res.status}: ${text.slice(0, 500)}`, 'HTTP');
  }

  let parsed: any;
  try {
    parsed = parser.parse(text);
  } catch (err) {
    throw new AfipError(`Respuesta de AFIP no es XML válido: ${(err as Error).message}`, 'PARSE');
  }

  const envelopeParsed = parsed?.Envelope;
  const fault = envelopeParsed?.Body?.Fault;
  if (fault) {
    const msg = fault.faultstring || fault.detail || JSON.stringify(fault);
    throw new AfipError(`AFIP rechazó la solicitud: ${msg}`, 'SOAP_FAULT');
  }

  return envelopeParsed?.Body;
}

/** Escapa un valor para insertarlo como texto dentro de un tag XML. */
export function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

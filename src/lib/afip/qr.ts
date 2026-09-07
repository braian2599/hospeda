// ==================== AFIP/ARCA — QR obligatorio (RG 4892) ====================
// Desde 2020 todo comprobante electrónico tiene que llevar impreso un QR
// que apunta al validador público de AFIP, con un payload JSON (codificado
// en base64) con los datos del comprobante. Formato oficial y estable —
// documentado en el "Anexo I" de la RG 4892/2020. Solo se usa del lado del
// cliente (junto al componente de impresión), por eso puede asumir `btoa`.

export interface DatosQrAfip {
  fecha: string; // YYYY-MM-DD
  cuit: string; // CUIT del emisor, solo dígitos
  ptoVta: number;
  cbteTipo: number;
  nroCmp: number;
  importe: number; // en pesos (no centavos)
  docTipo: number;
  docNro: string;
  cae: string;
}

export function urlQrAfip(datos: DatosQrAfip): string {
  const payload = {
    ver: 1,
    fecha: datos.fecha,
    cuit: Number(datos.cuit),
    ptoVta: datos.ptoVta,
    tipoCmp: datos.cbteTipo,
    nroCmp: datos.nroCmp,
    importe: datos.importe,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: datos.docTipo,
    nroDocRec: Number(datos.docNro) || 0,
    tipoCodAut: 'E',
    codAut: Number(datos.cae),
  };
  const base64 = btoa(JSON.stringify(payload));
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}

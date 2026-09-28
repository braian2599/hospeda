// ==================== ARCA — Notas de crédito y débito ====================
//
// Corrigen una factura ya autorizada por ARCA. Reglas:
// - Llevan la MISMA letra que la factura (A, B o C) y van asociadas a ella
//   ante ARCA (CbtesAsoc: tipo, punto de venta, número y CUIT del hotel).
//   Códigos: ver tipoNotaDe en config.ts.
// - La nota de crédito anula toda la factura o una parte. Entre todas las
//   notas de crédito no pueden pasar lo que vale la factura más las notas de
//   débito que ya tenga. Cuando se anula todo, la factura queda "anulada".
// - La nota de débito suma un importe a la factura (por ejemplo, consumos
//   que no se incluyeron).
// - Van al mismo receptor que la factura, con el mismo servicio (las fechas
//   de la estadía) y el IVA discriminado igual que ella.
// - La reserva NO se desbloquea: facturada, no se edita más, aunque tenga
//   una nota de crédito (decisión del dueño, 28/09).

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  AfipError, ALICUOTA_IVA_ALOJAMIENTO, DOC_TIPO, condicionIvaReceptorId, discriminaIva, letraComprobante,
  nombreTipoComprobante, separarIva, tipoNotaDe, type AfipAmbiente,
} from './config';
import { solicitarCae } from './wsfe';
import { pesos } from '@/lib/cuenta-corriente';

export type ClaseNota = 'credito' | 'debito';

/** Estado de paso de la factura mientras se le emite una nota. */
const ESTADO_NOTA_EN_CURSO = 'nota-en-curso';

/** Un error pensado para mostrarle al hotel tal cual, con su código HTTP. */
export class NotaError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Lo que la factura vale hoy: su importe, más débitos, menos créditos. En centavos. */
export interface SaldoFactura {
  importe: number;
  creditado: number;
  debitado: number;
  /** Lo máximo que todavía se puede anular con notas de crédito. */
  disponible: number;
}

type Nota = { tipo: string; importe: number; cae: string | null };

export function saldoDesdeNotas(importeFactura: number, notas: Nota[]): SaldoFactura {
  const conCae = notas.filter(n => n.cae);
  const creditado = conCae.filter(n => n.tipo === 'NotaCredito').reduce((s, n) => s + n.importe, 0);
  const debitado = conCae.filter(n => n.tipo === 'NotaDebito').reduce((s, n) => s + n.importe, 0);
  return { importe: importeFactura, creditado, debitado, disponible: Math.max(0, importeFactura + debitado - creditado) };
}

function numeroDisplay(puntoVenta: number, numero: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
}

export interface PedidoNota {
  facturaId: string;
  clase: ClaseNota;
  /** En centavos. */
  importe: number;
  motivo: string;
  /** Solo nota de débito: qué se suma (p. ej. "Consumos del frigobar"). */
  concepto?: string | null;
}

/**
 * Pide el CAE de una nota de crédito o débito y la guarda en Comprobante.
 * Devuelve el id de la nota creada.
 */
export async function emitirNotaAfip(tenantId: string, pedido: PedidoNota): Promise<{ id: string }> {
  const motivo = pedido.motivo.trim();
  if (!motivo) throw new NotaError('Falta el motivo de la nota.');
  if (!Number.isInteger(pedido.importe) || pedido.importe <= 0) throw new NotaError('El importe tiene que ser mayor a cero.');
  if (pedido.clase === 'debito' && !pedido.concepto?.trim()) throw new NotaError('Falta qué se suma con la nota de débito.');

  const [factura, afip, tenantConfig] = await Promise.all([
    db.comprobante.findFirst({
      where: { id: pedido.facturaId, tenantId, tipo: 'Factura' },
      include: {
        reserva: { select: { checkin: true, checkout: true } },
        notasAsociadas: { select: { tipo: true, importe: true, cae: true } },
      },
    }),
    db.tenantAfip.findUnique({ where: { tenantId }, select: { cuit: true, ambiente: true } }),
    db.tenantConfig.findUnique({ where: { tenantId }, select: { puntoVenta: true } }),
  ]);

  if (!factura) throw new NotaError('No se encontró la factura.', 404);
  if (!factura.cae || !factura.tipoAfip) {
    throw new NotaError('Esa factura no está autorizada por ARCA: no lleva nota de crédito ni de débito.');
  }
  if (!afip?.cuit) throw new NotaError('Falta la configuración de ARCA del hotel.');
  // Una factura de prueba (homologación) no se corrige en producción, ni al revés.
  if (factura.ambiente && factura.ambiente !== afip.ambiente) {
    throw new NotaError(`Esa factura se hizo en ${factura.ambiente === 'homologacion' ? 'modo de prueba' : 'producción'} y ARCA ahora está en ${afip.ambiente === 'homologacion' ? 'modo de prueba' : 'producción'}: no se puede corregir desde acá.`);
  }

  const cbteTipo = tipoNotaDe(factura.tipoAfip, pedido.clase);
  if (!cbteTipo) throw new NotaError('Ese comprobante no es una factura A, B o C.');

  const facturaDisplay = `${nombreTipoComprobante(factura.tipoAfip)} ${numeroDisplay(factura.puntoVenta, factura.numero)}`;
  const puntoVenta = tenantConfig?.puntoVenta || 1;

  // "Reclamar" la factura con un estado de paso, igual que facturar-afip
  // con 'PENDIENTE': dos notas a la vez sobre la misma factura no pueden leer
  // las dos el mismo saldo y anular entre las dos más de lo que vale. No se
  // usa una transacción larga: dejaría una conexión de la base tomada
  // mientras se espera a ARCA.
  const reclamo = await db.comprobante.updateMany({
    where: { id: factura.id, tenantId, estado: 'emitido' },
    data: { estado: ESTADO_NOTA_EN_CURSO },
  });
  if (reclamo.count === 0) {
    const actual = await db.comprobante.findUnique({ where: { id: factura.id }, select: { estado: true } });
    throw new NotaError(actual?.estado === ESTADO_NOTA_EN_CURSO
      ? `Ya se está emitiendo una nota sobre la ${facturaDisplay}: esperá un momento.`
      : `La ${facturaDisplay} ya está anulada.`, 409);
  }

  let estadoFinal = 'emitido';
  try {
    const notas = await db.comprobante.findMany({
      where: { tenantId, comprobanteAsociadoId: factura.id },
      select: { tipo: true, importe: true, cae: true },
    });
    const saldo = saldoDesdeNotas(factura.importe, notas);
    if (pedido.clase === 'credito' && pedido.importe > saldo.disponible) {
      throw new NotaError(`La nota de crédito no puede pasar de ${pesos(saldo.disponible)}: es lo que queda de la ${facturaDisplay}.`);
    }

    const importeTotal = pedido.importe / 100;
    const iva = discriminaIva(cbteTipo)
      ? (() => {
        const { neto, iva: importeIva } = separarIva(importeTotal, ALICUOTA_IVA_ALOJAMIENTO.porcentaje);
        return { alicuotaId: ALICUOTA_IVA_ALOJAMIENTO.id, neto, importe: importeIva };
      })()
      : null;

    let resultado;
    try {
      resultado = await solicitarCae(tenantId, puntoVenta, {
        cbteTipo,
        docTipo: factura.docTipoReceptor ?? DOC_TIPO.CONSUMIDOR_FINAL,
        docNro: factura.docReceptor || '0',
        importeTotal,
        // El mismo servicio que la factura: la estadía.
        fechaServicioDesde: factura.reserva?.checkin ?? factura.fecha,
        fechaServicioHasta: factura.reserva?.checkout ?? factura.fecha,
        condicionIvaReceptorId: condicionIvaReceptorId(factura.condicionIvaReceptor),
        iva,
        comprobanteAsociado: { tipo: factura.tipoAfip, ptoVta: factura.puntoVenta, nro: factura.numero, cuit: afip.cuit },
      });
    } catch (err) {
      await db.tenantAfip.update({ where: { tenantId }, data: { ultimoError: (err as Error).message.slice(0, 500) } }).catch(() => {});
      throw err;
    }

    const tipo = pedido.clase === 'credito' ? 'NotaCredito' : 'NotaDebito';
    const anulaTodo = pedido.clase === 'credito' && pedido.importe === saldo.disponible;
    const concepto = pedido.clase === 'credito'
      ? `${anulaTodo && saldo.creditado === 0 && saldo.debitado === 0 ? 'Anulación de la' : 'Crédito sobre la'} ${facturaDisplay}`
      : `${pedido.concepto!.trim()} (suma a la ${facturaDisplay})`;

    const datos = {
      tenantId, tipo, letra: letraComprobante(cbteTipo),
      puntoVenta, numero: resultado.cbteNro, fecha: new Date(),
      reservaId: factura.reservaId,
      comprobanteAsociadoId: factura.id,
      razonSocialReceptor: factura.razonSocialReceptor,
      docTipoReceptor: factura.docTipoReceptor,
      docReceptor: factura.docReceptor,
      domicilioReceptor: factura.domicilioReceptor,
      condicionIvaReceptor: factura.condicionIvaReceptor,
      concepto: concepto.slice(0, 500),
      importe: pedido.importe,
      motivo: motivo.slice(0, 500),
      cae: resultado.cae,
      caeVencimiento: resultado.caeFchVto,
      tipoAfip: cbteTipo,
      ambiente: afip.ambiente as AfipAmbiente,
      titularCuentaId: factura.titularCuentaId,
    } satisfies Prisma.ComprobanteUncheckedCreateInput;

    const nota = await guardarNota(datos);
    if (anulaTodo) estadoFinal = 'anulado';
    return { id: nota.id };
  } finally {
    // Siempre se suelta: si falló, la factura queda como estaba.
    await db.comprobante.update({
      where: { id: factura.id },
      data: estadoFinal === 'anulado' ? { estado: 'anulado', anuladoAt: new Date() } : { estado: 'emitido' },
    }).catch(err => console.error('emitirNotaAfip soltar factura:', err));
  }
}

/**
 * Guarda la nota con el número que dio ARCA. Si ese número lo tiene una nota
 * INTERNA vieja (de antes de conectar las notas a ARCA, sin CAE y con su
 * propia numeración), la interna pasa al punto de venta 0000: la que vale
 * ante ARCA es esta, y su CAE no se puede perder.
 */
async function guardarNota(datos: Prisma.ComprobanteUncheckedCreateInput) {
  try {
    return await db.comprobante.create({ data: datos, select: { id: true } });
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') throw err;
    const ocupada = await db.comprobante.findFirst({
      where: { tenantId: datos.tenantId, tipo: datos.tipo, puntoVenta: datos.puntoVenta, numero: datos.numero, cae: null },
      select: { id: true },
    });
    if (!ocupada) {
      console.error('emitirNotaAfip: CAE sin guardar', datos.cae, datos.tipoAfip, datos.puntoVenta, datos.numero);
      throw new AfipError(`ARCA autorizó la nota (CAE ${datos.cae}) pero no se pudo guardar. Anotá ese CAE y avisale a soporte.`, 'NOTA_SIN_GUARDAR');
    }
    await db.comprobante.update({ where: { id: ocupada.id }, data: { puntoVenta: 0 } });
    return db.comprobante.create({ data: datos, select: { id: true } });
  }
}

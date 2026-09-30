import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { letraPorTipoComprobante } from '@/lib/afip/config';
import { saldoDesdeNotas } from '@/lib/afip/notas';
import type { Prisma, TipoComprobante } from '@prisma/client';

// ─────────────────────────────────────────────────────────
// POST /api/comprobantes — Emite un Presupuesto (módulo ARCA, con su
// permiso). No tiene validez fiscal: numeración propia del hotel,
// atómica por tipo + punto de venta. La Factura NO se emite acá: sigue su
// propio camino en POST /api/reservas/[id]/facturar-afip. Las Notas de
// Crédito y Débito tampoco: una factura con CAE solo se corrige con una
// nota autorizada por ARCA (se construye aparte), no con una interna.
//
// GET /api/comprobantes — Lista/busca comprobantes emitidos (cualquier
// tipo): la ven Comprobantes (solo lectura) y ARCA.
// ─────────────────────────────────────────────────────────

// Los remitos se sacaron del sistema (decisión del dueño, 29/09).
const TIPOS_EMITIBLES = new Set<TipoComprobante>(['Presupuesto']);

function formatComprobante(c: {
  id: string; tipo: string; puntoVenta: number; numero: number; numeroInterno: number | null; letra: string; fecha: Date;
  reservaId: string | null;
  razonSocialReceptor: string; docTipoReceptor: number | null; docReceptor: string | null;
  domicilioReceptor: string | null; condicionIvaReceptor: string | null; concepto: string;
  importe: number; cae: string | null; caeVencimiento: Date | null; tipoAfip: number | null;
  ambiente: string | null; estado: string; anuladoAt: Date | null; motivo: string | null;
  comprobanteAsociado: { tipo: string; letra: string; puntoVenta: number; numero: number } | null;
  notasAsociadas?: { tipo: string; importe: number; cae: string | null }[];
}) {
  // Solo facturas: cuánto se anuló (crédito) o se sumó (débito) con notas de
  // ARCA, y cuánto queda para anular. En pesos.
  const saldo = c.tipo === 'Factura' && c.notasAsociadas ? saldoDesdeNotas(c.importe, c.notasAsociadas) : null;
  return {
    id: c.id,
    tipo: c.tipo,
    puntoVenta: c.puntoVenta,
    numero: c.numero,
    numeroDisplay: `${String(c.puntoVenta).padStart(4, '0')}-${String(c.numero).padStart(8, '0')}`,
    numeroInternoDisplay: c.numeroInterno != null ? `${String(c.puntoVenta).padStart(4, '0')}-${String(c.numeroInterno).padStart(8, '0')}` : null,
    letra: c.letra,
    fecha: c.fecha,
    reservaId: c.reservaId,
    razonSocialReceptor: c.razonSocialReceptor,
    docTipoReceptor: c.docTipoReceptor,
    docReceptor: c.docReceptor,
    domicilioReceptor: c.domicilioReceptor,
    condicionIvaReceptor: c.condicionIvaReceptor,
    concepto: c.concepto,
    importe: c.importe / 100,
    cae: c.cae,
    caeVencimiento: c.caeVencimiento,
    tipoAfip: c.tipoAfip,
    ambiente: c.ambiente,
    estado: c.estado,
    anuladoAt: c.anuladoAt,
    motivo: c.motivo,
    notas: saldo
      ? { creditado: saldo.creditado / 100, debitado: saldo.debitado / 100, disponible: saldo.disponible / 100 }
      : null,
    comprobanteAsociadoDisplay: c.comprobanteAsociado
      ? `${c.comprobanteAsociado.tipo === 'Factura' ? `Factura ${c.comprobanteAsociado.letra}` : c.comprobanteAsociado.tipo} ${String(c.comprobanteAsociado.puntoVenta).padStart(4, '0')}-${String(c.comprobanteAsociado.numero).padStart(8, '0')}`
      : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await requirePermission('arca');
    const body = await req.json();
    const {
      tipo, comprobanteAsociadoId, razonSocialReceptor, docTipoReceptor, docReceptor,
      domicilioReceptor, condicionIvaReceptor, concepto, importe, motivo, titularCuentaId,
    } = body as {
      titularCuentaId?: string;
      tipo?: string;
      comprobanteAsociadoId?: string;
      razonSocialReceptor?: string;
      docTipoReceptor?: number;
      docReceptor?: string;
      domicilioReceptor?: string;
      condicionIvaReceptor?: string;
      concepto?: string;
      importe?: number;
      motivo?: string;
    };

    if (tipo === 'NotaCredito' || tipo === 'NotaDebito') {
      return NextResponse.json({ error: 'Las notas de crédito y débito se emiten con ARCA, desde la factura que corrigen.' }, { status: 400 });
    }
    if (!tipo || !TIPOS_EMITIBLES.has(tipo as TipoComprobante)) {
      return NextResponse.json({ error: 'Tipo de comprobante inválido' }, { status: 400 });
    }
    // La empresa elegida de la lista (Clientes → Empresas): así después se
    // listan "todos los comprobantes de esta empresa" sin buscar por texto.
    if (titularCuentaId) {
      const titular = await db.titularCuenta.findFirst({ where: { id: titularCuentaId, tenantId }, select: { id: true } });
      if (!titular) {
        return NextResponse.json({ error: 'No se encontró la empresa elegida.' }, { status: 400 });
      }
    }
    if (!razonSocialReceptor?.trim()) {
      return NextResponse.json({ error: 'Falta la razón social del receptor' }, { status: 400 });
    }
    if (!concepto?.trim()) {
      return NextResponse.json({ error: 'Falta el concepto/detalle' }, { status: 400 });
    }
    if (typeof importe !== 'number' || !(importe > 0)) {
      return NextResponse.json({ error: 'El importe debe ser mayor a 0' }, { status: 400 });
    }
    const esNota = tipo === 'NotaCredito' || tipo === 'NotaDebito';
    if (esNota && !comprobanteAsociadoId) {
      return NextResponse.json({ error: 'Las Notas de Crédito/Débito necesitan el comprobante que ajustan' }, { status: 400 });
    }
    if (esNota && !motivo?.trim()) {
      return NextResponse.json({ error: 'Falta el motivo de la nota' }, { status: 400 });
    }

    if (comprobanteAsociadoId) {
      const comprobanteAsociado = await db.comprobante.findFirst({ where: { id: comprobanteAsociadoId, tenantId }, select: { id: true } });
      if (!comprobanteAsociado) {
        return NextResponse.json({ error: 'El comprobante asociado no existe' }, { status: 400 });
      }
    }

    const tenantConfig = await db.tenantConfig.findUnique({ where: { tenantId }, select: { puntoVenta: true } });
    const puntoVenta = tenantConfig?.puntoVenta || 1;
    const tipoTyped = tipo as TipoComprobante;
    // Solo se emiten presupuestos acá: sin validez fiscal, letra X.
    const letra = letraPorTipoComprobante('Presupuesto', null);

    // Numeración atómica por tipo + punto de venta: el upsert toma un row
    // lock en Postgres sobre esa fila del contador, así que dos emisiones
    // simultáneas del mismo tipo no pueden pisarse el número entre sí.
    const creado = await db.$transaction(async tx => {
      const contador = await tx.comprobanteContador.upsert({
        where: { tenantId_tipo_puntoVenta: { tenantId, tipo: tipoTyped, puntoVenta } },
        create: { tenantId, tipo: tipoTyped, puntoVenta, ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
        select: { ultimoNumero: true },
      });
      return tx.comprobante.create({
        data: {
          tenantId, tipo: tipoTyped, letra,
          puntoVenta, numero: contador.ultimoNumero,
          comprobanteAsociadoId: comprobanteAsociadoId || null,
          razonSocialReceptor: razonSocialReceptor.trim(),
          docTipoReceptor: docTipoReceptor ?? null,
          docReceptor: docReceptor?.trim() || null,
          domicilioReceptor: domicilioReceptor?.trim() || null,
          condicionIvaReceptor: condicionIvaReceptor?.trim() || null,
          concepto: concepto.trim(),
          importe: Math.round(importe * 100),
          motivo: motivo?.trim() || null,
          titularCuentaId: titularCuentaId || null,
        },
        include: { comprobanteAsociado: { select: { tipo: true, letra: true, puntoVenta: true, numero: true } } },
      });
    });

    return NextResponse.json(formatComprobante(creado), { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST comprobantes:', error);
    return NextResponse.json({ error: 'Error al emitir el comprobante' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requirePermission(['comprobantes', 'arca']);
    const { searchParams } = req.nextUrl;
    const tipo = searchParams.get('tipo');
    const q = searchParams.get('q')?.trim();
    // conCae=1: solo lo autorizado por ARCA. Una "Factura" sin CAE es el
    // recibo interno de una reserva, que todavía no se facturó.
    const conCae = searchParams.get('conCae') === '1';
    // pagina=N: paginado del lado del servidor (ARCA y Comprobantes). Trae
    // solo esa página y el total, en vez de cargar todo: con cientos de
    // comprobantes la lista completa hacía lento el sistema. Sin "pagina",
    // devuelve la lista como siempre (los primeros "take").
    const pagina = searchParams.has('pagina') ? Math.max(1, Math.floor(Number(searchParams.get('pagina'))) || 1) : null;
    const take = Math.min(100, Math.max(1, Number(searchParams.get('take')) || (pagina ? 15 : 20)));

    const where: Prisma.ComprobanteWhereInput = {
      tenantId,
      ...(tipo ? { tipo: tipo as TipoComprobante } : {}),
      ...(conCae ? { cae: { not: null } } : {}),
      ...(q ? { OR: condicionesDeBusqueda(q) } : {}),
    };

    const [comprobantes, total] = await Promise.all([
      db.comprobante.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        ...(pagina ? { skip: (pagina - 1) * take } : {}),
        include: {
          comprobanteAsociado: { select: { tipo: true, letra: true, puntoVenta: true, numero: true } },
          notasAsociadas: { select: { tipo: true, importe: true, cae: true } },
        },
      }),
      pagina ? db.comprobante.count({ where }) : Promise.resolve(0),
    ]);

    if (pagina) {
      return NextResponse.json({ items: comprobantes.map(formatComprobante), total, pagina, porPagina: take });
    }
    return NextResponse.json(comprobantes.map(formatComprobante));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET comprobantes:', error);
    return NextResponse.json({ error: 'Error al listar comprobantes' }, { status: 500 });
  }
}

/**
 * Qué busca el cuadro de búsqueda: el receptor (nombre o razón social), su
 * DNI/CUIT, el número del comprobante ("0002-00000015", "15") y el número de
 * la reserva ("#12", "12").
 */
function condicionesDeBusqueda(q: string): Prisma.ComprobanteWhereInput[] {
  const condiciones: Prisma.ComprobanteWhereInput[] = [
    { razonSocialReceptor: { contains: q, mode: 'insensitive' } },
  ];
  // El DNI/CUIT solo si se escribieron números (con o sin guiones): con un
  // nombre como "Cliente 7" no se buscan documentos que tengan un 7.
  const digitos = q.replace(/\D/g, '');
  if (digitos && !/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(q)) condiciones.push({ docReceptor: { contains: digitos } });

  // "0002-00000015": punto de venta y número.
  const conPunto = q.match(/^(\d{1,5})-(\d{1,8})$/);
  if (conPunto) {
    condiciones.push({ puntoVenta: Number(conPunto[1]), numero: Number(conPunto[2]) });
  } else if (/^#?\d{1,8}$/.test(q)) {
    const n = Number(q.replace('#', ''));
    // "#12" es solo el número de reserva; "12", el del comprobante o el de la reserva.
    if (!q.startsWith('#')) condiciones.push({ numero: n });
    condiciones.push({ reserva: { numero: n } });
  }
  return condiciones;
}

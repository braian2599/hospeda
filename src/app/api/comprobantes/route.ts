import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { letraPorTipoComprobante } from '@/lib/afip/config';
import type { TipoComprobante } from '@prisma/client';

// ─────────────────────────────────────────────────────────
// POST /api/comprobantes — Emite un comprobante interno (Presupuesto formal,
// Remito, Nota de Crédito o Nota de Débito). La Factura NO se emite acá:
// sigue su propio camino atómico en POST /api/reservas/[id]/comprobante
// (que además refleja una copia en esta misma tabla — ver mirrorComprobante
// en esa ruta). Estos 4 tipos todavía no están conectados a AFIP (ver tarea
// pendiente "conectar Remito/NC/ND a AFIP"): la numeración es propia del
// tenant, atómica por tipo + punto de venta.
//
// GET /api/comprobantes — Lista/busca comprobantes emitidos (cualquier
// tipo), para el historial y para el selector de "comprobante asociado" al
// emitir una Nota de Crédito/Débito.
// ─────────────────────────────────────────────────────────

const TIPOS_EMITIBLES = new Set<TipoComprobante>(['Presupuesto', 'Remito', 'NotaCredito', 'NotaDebito']);

function formatComprobante(c: {
  id: string; tipo: string; puntoVenta: number; numero: number; letra: string; fecha: Date;
  razonSocialReceptor: string; docTipoReceptor: number | null; docReceptor: string | null;
  domicilioReceptor: string | null; condicionIvaReceptor: string | null; concepto: string;
  importe: number; cae: string | null; caeVencimiento: Date | null;
  ambiente: string | null; estado: string; motivo: string | null;
  comprobanteAsociado: { tipo: string; puntoVenta: number; numero: number } | null;
}) {
  return {
    id: c.id,
    tipo: c.tipo,
    numeroDisplay: `${String(c.puntoVenta).padStart(4, '0')}-${String(c.numero).padStart(8, '0')}`,
    letra: c.letra,
    fecha: c.fecha,
    razonSocialReceptor: c.razonSocialReceptor,
    docTipoReceptor: c.docTipoReceptor,
    docReceptor: c.docReceptor,
    domicilioReceptor: c.domicilioReceptor,
    condicionIvaReceptor: c.condicionIvaReceptor,
    concepto: c.concepto,
    importe: c.importe / 100,
    cae: c.cae,
    caeVencimiento: c.caeVencimiento,
    ambiente: c.ambiente,
    estado: c.estado,
    motivo: c.motivo,
    comprobanteAsociadoDisplay: c.comprobanteAsociado
      ? `${c.comprobanteAsociado.tipo} ${String(c.comprobanteAsociado.puntoVenta).padStart(4, '0')}-${String(c.comprobanteAsociado.numero).padStart(8, '0')}`
      : null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission('comprobantes');
    const body = await req.json();
    const {
      tipo, comprobanteAsociadoId, razonSocialReceptor, docTipoReceptor, docReceptor,
      domicilioReceptor, condicionIvaReceptor, concepto, importe, motivo,
    } = body as {
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

    if (!tipo || !TIPOS_EMITIBLES.has(tipo as TipoComprobante)) {
      return NextResponse.json({ error: 'Tipo de comprobante inválido' }, { status: 400 });
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
    const letra = letraPorTipoComprobante(tipoTyped, null);

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
        },
        include: { comprobanteAsociado: { select: { tipo: true, puntoVenta: true, numero: true } } },
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
    const tenantId = await requirePermission('comprobantes');
    const { searchParams } = req.nextUrl;
    const tipo = searchParams.get('tipo');
    const q = searchParams.get('q')?.trim();
    const take = Math.min(50, Math.max(1, Number(searchParams.get('take')) || 20));

    const comprobantes = await db.comprobante.findMany({
      where: {
        tenantId,
        ...(tipo ? { tipo: tipo as TipoComprobante } : {}),
        ...(q ? { razonSocialReceptor: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: { comprobanteAsociado: { select: { tipo: true, puntoVenta: true, numero: true } } },
    });

    return NextResponse.json(comprobantes.map(formatComprobante));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET comprobantes:', error);
    return NextResponse.json({ error: 'Error al listar comprobantes' }, { status: 500 });
  }
}

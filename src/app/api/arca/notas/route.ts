import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { db } from '@/lib/db';
import { auditar, TIPO } from '@/lib/auditoria';
import { afipDisponible } from '@/lib/afip/tenant-afip';
import { AfipError } from '@/lib/afip/config';
import { emitirNotaAfip, NotaError, type ClaseNota } from '@/lib/afip/notas';
import { pesos } from '@/lib/cuenta-corriente';

// ─────────────────────────────────────────────────────────
// POST /api/arca/notas — Nota de crédito o de débito autorizada por ARCA,
// sobre una factura con CAE. Las reglas están en src/lib/afip/notas.ts.
//
// Body: { facturaId, clase: 'credito' | 'debito', importe (pesos), motivo,
//         concepto? (solo débito: qué se suma) }
// ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { tenantId, actorId, nombre } = await requirePermission('arca');
    const body = await req.json().catch(() => ({}));

    const facturaId = typeof body?.facturaId === 'string' ? body.facturaId : '';
    const clase = body?.clase === 'credito' || body?.clase === 'debito' ? body.clase as ClaseNota : null;
    const importePesos = Number(body?.importe);
    const motivo = typeof body?.motivo === 'string' ? body.motivo : '';
    const concepto = typeof body?.concepto === 'string' ? body.concepto : null;

    if (!facturaId) return NextResponse.json({ error: 'Falta elegir la factura.' }, { status: 400 });
    if (!clase) return NextResponse.json({ error: 'Falta decir si es nota de crédito o de débito.' }, { status: 400 });
    if (!Number.isFinite(importePesos) || importePesos <= 0) {
      return NextResponse.json({ error: 'El importe tiene que ser mayor a cero.' }, { status: 400 });
    }

    if (!(await afipDisponible(tenantId))) {
      return NextResponse.json({ error: 'ARCA no está configurado o activo para este hotel. Revisá Configuración → Facturación.' }, { status: 400 });
    }

    const importe = Math.round(importePesos * 100);
    const { id } = await emitirNotaAfip(tenantId, { facturaId, clase, importe, motivo, concepto });

    await auditar(db, {
      tenantId,
      tipo: TIPO.ARCA,
      detalle: `Nota de ${clase === 'credito' ? 'crédito' : 'débito'} por ${pesos(importe)}. Motivo: ${motivo.trim().slice(0, 200)}`,
      actor: { id: actorId, nombre },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof NotaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AfipError) {
      return NextResponse.json({ error: `ARCA: ${error.message}` }, { status: 502 });
    }
    console.error('POST arca/notas:', error);
    return NextResponse.json({ error: 'No se pudo emitir la nota' }, { status: 500 });
  }
}

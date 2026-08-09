import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// POST /api/auditoria — Crear entrada de auditoría
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireTenantId();
    const body = await req.json();
    const { tipo, detalle, empleado } = body;

    if (!tipo || !detalle) {
      return NextResponse.json({ error: 'tipo y detalle son obligatorios' }, { status: 400 });
    }

    const entry = await db.auditoria.create({
      data: {
        tenantId,
        tipo: String(tipo).slice(0, 50),
        detalle: String(detalle).slice(0, 500),
        empleado: String(empleado || 'Sistema').slice(0, 100),
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/auditoria:', error);
    return NextResponse.json({ error: 'Error al registrar auditoría' }, { status: 500 });
  }
}

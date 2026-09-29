import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { activarDelegacion, delegacionesPendientes } from '@/lib/afip/delegacion';
import { AfipError } from '@/lib/afip/config';

// GET /api/super-admin/arca-delegaciones — Hoteles que avisaron que le
// delegaron la facturación a Hospeda y esperan que se acepte en ARCA.
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    return NextResponse.json({ pendientes: await delegacionesPendientes() });
  } catch (err) {
    console.error('GET /api/super-admin/arca-delegaciones:', err);
    return NextResponse.json({ error: 'Error al cargar las delegaciones' }, { status: 500 });
  }
}

// POST /api/super-admin/arca-delegaciones — Después de aceptarla en ARCA,
// verifica la delegación de ese hotel (misma verificación que hace el hotel:
// no emite nada). Si ARCA la acepta, el hotel queda facturando.
export async function POST(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const { tenantId } = (await req.json()) as { tenantId?: string };
    if (!tenantId) return NextResponse.json({ error: 'Falta el hotel' }, { status: 400 });
    const resultado = await activarDelegacion(tenantId);
    return NextResponse.json({ success: true, ...resultado });
  } catch (err) {
    if (err instanceof AfipError) return NextResponse.json({ error: err.message }, { status: 502 });
    console.error('POST /api/super-admin/arca-delegaciones:', err);
    return NextResponse.json({ error: 'Error al verificar la delegación' }, { status: 500 });
  }
}

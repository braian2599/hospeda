import { NextResponse } from 'next/server';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { probarConexionWsaa } from '@/lib/afip/wsaa';
import { AfipError } from '@/lib/afip/config';

// POST /api/configuracion/afip/test — Fuerza un login WSAA para validar que el certificado funciona (no emite nada)
export async function POST() {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'facturacionArca');

    await probarConexionWsaa(tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    if (error instanceof AfipError) return NextResponse.json({ error: error.message }, { status: 502 });
    console.error('POST /api/configuracion/afip/test:', error);
    return NextResponse.json({ error: 'Error al probar la conexión con AFIP' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { avisarDelegacion } from '@/lib/afip/delegacion';
import { AfipError } from '@/lib/afip/config';

// POST /api/configuracion/afip/delegacion/aviso — El hotel avisa que ya le
// delegó la facturación a Hospeda en ARCA. Aparece en el panel de Super Admin.
export async function POST() {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'facturacionArca');

    const avisadaEn = await avisarDelegacion(tenantId);
    return NextResponse.json({ success: true, avisadaEn: avisadaEn.toISOString() });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    if (error instanceof AfipError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('POST /api/configuracion/afip/delegacion/aviso:', error);
    return NextResponse.json({ error: 'Error al avisar a Hospeda' }, { status: 500 });
  }
}

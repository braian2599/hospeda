import { NextResponse } from 'next/server';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { activarDelegacion, desactivarDelegacion } from '@/lib/afip/delegacion';
import { AfipError } from '@/lib/afip/config';

// POST /api/configuracion/afip/delegacion — Verifica en ARCA que el hotel le
// delegó la facturación a Hospeda y, si es así, lo deja facturando con el
// certificado de Hospeda. No emite ningún comprobante.
export async function POST() {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'facturacionArca');

    const resultado = await activarDelegacion(tenantId);
    return NextResponse.json({ success: true, ...resultado });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    if (error instanceof AfipError) {
      const status = error.code === 'MISSING_CONFIG' ? 400 : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error('POST /api/configuracion/afip/delegacion:', error);
    return NextResponse.json({ error: 'Error al verificar la delegación en ARCA' }, { status: 500 });
  }
}

// DELETE /api/configuracion/afip/delegacion — Deja de facturar con el certificado de Hospeda.
export async function DELETE() {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'facturacionArca');

    await desactivarDelegacion(tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('DELETE /api/configuracion/afip/delegacion:', error);
    return NextResponse.json({ error: 'Error al desactivar la facturación con Hospeda' }, { status: 500 });
  }
}

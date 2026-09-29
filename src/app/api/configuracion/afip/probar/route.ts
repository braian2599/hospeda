import { NextResponse } from 'next/server';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { db } from '@/lib/db';
import { probarConexionWsaa } from '@/lib/afip/wsaa';
import { AfipError } from '@/lib/afip/config';
import { usaCertificadoHospeda } from '@/lib/afip/certificado-hospeda';
import { activarDelegacion } from '@/lib/afip/delegacion';

// POST /api/configuracion/afip/test — Fuerza un login WSAA para validar que el certificado funciona (no emite nada)
export async function POST() {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'facturacionArca');

    // Con el certificado de Hospeda no se fuerza un login nuevo (el ticket es
    // de todos los hoteles y ARCA no da otro mientras siga vigente): se
    // vuelve a verificar la delegación con una consulta real.
    const config = await db.tenantAfip.findUnique({ where: { tenantId } });
    if (usaCertificadoHospeda(config)) {
      const resultado = await activarDelegacion(tenantId);
      return NextResponse.json({ success: true, ...resultado });
    }

    await probarConexionWsaa(tenantId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    if (error instanceof AfipError) return NextResponse.json({ error: error.message }, { status: 502 });
    console.error('POST /api/configuracion/afip/test:', error);
    return NextResponse.json({ error: 'Error al probar la conexión con AFIP' }, { status: 500 });
  }
}

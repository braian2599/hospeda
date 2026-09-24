import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, AuthError } from '@/lib/auth/utils';
import { PERMISOS_TITULAR, validarCuit, normalizarCuit } from '@/lib/cuenta-corriente';
import { afipDisponible } from '@/lib/afip/tenant-afip';
import { AfipError } from '@/lib/afip/config';
import { consultarPadron } from '@/lib/afip/padron';

// ─────────────────────────────────────────────────────────
// GET /api/titulares/arca?cuit=30712345678
//
// Los datos de ese CUIT según ARCA, para autocompletar el alta de un titular.
// No guarda nada: quien carga revisa lo que vino y recién ahí guarda.
// Solo funciona si el hotel tiene conectada la facturación con ARCA: usa ese
// mismo certificado. Ver src/lib/afip/padron.ts.
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await requirePermission(PERMISOS_TITULAR);

    const cuit = normalizarCuit(req.nextUrl.searchParams.get('cuit') || '');
    const errorCuit = validarCuit(cuit);
    if (errorCuit) return NextResponse.json({ error: errorCuit }, { status: 400 });

    if (!(await afipDisponible(tenantId))) {
      return NextResponse.json(
        { error: 'Para traer datos de ARCA, el hotel tiene que tener conectada la facturación con ARCA (Configuración → ARCA).' },
        { status: 409 },
      );
    }

    const datos = await consultarPadron(tenantId, cuit);
    if (!datos) return NextResponse.json({ error: 'ARCA no tiene a nadie con ese CUIT.' }, { status: 404 });
    return NextResponse.json(datos);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    if (error instanceof AfipError) {
      // Estos mensajes ya están escritos para el hotel.
      if (error.code === 'WSAA_NO_AUTORIZADO' || error.code === 'WSAA_YA_AUTENTICADO' || error.code === 'MISSING_CONFIG' || error.code === 'NO_CERT') {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      console.error('GET /api/titulares/arca:', error);
      return NextResponse.json(
        { error: 'ARCA no respondió bien. Probá de nuevo en un rato o cargá los datos a mano.' },
        { status: 502 },
      );
    }
    console.error('GET /api/titulares/arca:', error);
    return NextResponse.json({ error: 'No se pudo consultar ARCA.' }, { status: 500 });
  }
}

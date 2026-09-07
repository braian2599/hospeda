import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';

// GET /api/configuracion/afip — Estado de la integración (nunca expone la clave privada).
export async function GET() {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'facturacionArca');

    const config = await db.tenantAfip.findUnique({ where: { tenantId } });
    return NextResponse.json({
      cuit: config?.cuit || '',
      ambiente: config?.ambiente || 'homologacion',
      activo: config?.activo || false,
      tieneCertificado: !!config?.certificadoPem,
      ultimaConexionOk: config?.ultimaConexionOk?.toISOString() || null,
      ultimoError: config?.ultimoError || null,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('GET /api/configuracion/afip:', error);
    return NextResponse.json({ error: 'Error al obtener la configuración de AFIP' }, { status: 500 });
  }
}

// PUT /api/configuracion/afip — Actualiza CUIT y ambiente (el certificado se maneja aparte).
export async function PUT(req: NextRequest) {
  try {
    const tenantId = await requireOwner();
    await requireFeatureFlag(tenantId, 'facturacionArca');

    const body = await req.json();
    const { cuit, ambiente, confirmarProduccion } = body as { cuit?: string; ambiente?: string; confirmarProduccion?: boolean };

    const cuitDigits = (cuit || '').replace(/\D/g, '');
    if (!cuitDigits || cuitDigits.length !== 11) {
      return NextResponse.json({ error: 'El CUIT debe tener 11 dígitos' }, { status: 400 });
    }
    if (ambiente !== 'homologacion' && ambiente !== 'produccion') {
      return NextResponse.json({ error: 'Ambiente inválido' }, { status: 400 });
    }
    // Pasar a producción emite comprobantes fiscales REALES ante AFIP —
    // exigimos una confirmación explícita además de la del lado del cliente,
    // para que no sea posible activarlo por accidente con un PUT genérico.
    if (ambiente === 'produccion' && !confirmarProduccion) {
      return NextResponse.json({ error: 'Falta confirmar el cambio a ambiente de producción' }, { status: 400 });
    }

    const existente = await db.tenantAfip.findUnique({ where: { tenantId }, select: { ambiente: true } });
    const cambioDeAmbiente = existente && existente.ambiente !== ambiente;

    await db.tenantAfip.upsert({
      where: { tenantId },
      create: { tenantId, cuit: cuitDigits, ambiente },
      update: {
        cuit: cuitDigits,
        ambiente,
        // Un ticket WSAA de homologación no sirve en producción (y viceversa)
        // — si cambia el ambiente, se descarta el ticket cacheado para
        // forzar un login nuevo contra el servidor correcto.
        ...(cambioDeAmbiente ? { wsaaToken: null, wsaaSign: null, wsaaExpiracion: null } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PUT /api/configuracion/afip:', error);
    return NextResponse.json({ error: 'Error al guardar la configuración de AFIP' }, { status: 500 });
  }
}

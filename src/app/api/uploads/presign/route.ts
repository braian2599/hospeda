import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { requireFeatureFlag } from '@/lib/feature-flags-server';
import { getPresignedUploadUrl, buildPublicUrl, isAllowedImageType, extForContentType, MAX_UPLOAD_BYTES } from '@/lib/storage/r2';
import { randomUUID } from 'crypto';

// POST /api/uploads/presign — Genera una URL firmada para subir una foto directo a R2
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireOwner();

    const body = await req.json();
    const { tipo, habitacion, contentType, size } = body as {
      tipo?: 'hotel' | 'habitacion' | 'factura';
      habitacion?: string;
      contentType?: string;
      size?: number;
    };

    if (tipo !== 'hotel' && tipo !== 'habitacion' && tipo !== 'factura') {
      return NextResponse.json({ error: 'tipo debe ser "hotel", "habitacion" o "factura"' }, { status: 400 });
    }
    // El logo de landing/habitaciones requiere el feature flag de landing page.
    // El logo de factura es parte del módulo base de Facturación (no de la
    // landing), así que no se gatea con ese flag.
    if (tipo === 'hotel' || tipo === 'habitacion') {
      await requireFeatureFlag(tenantId, 'landingPage');
    }
    if (!contentType || !isAllowedImageType(contentType)) {
      return NextResponse.json({ error: 'Formato no permitido (solo jpg, png, webp)' }, { status: 400 });
    }
    if (!size || size <= 0 || size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `El archivo debe pesar menos de ${MAX_UPLOAD_BYTES / 1024 / 1024}MB` }, { status: 400 });
    }

    let key: string;
    if (tipo === 'habitacion') {
      if (!habitacion?.trim()) {
        return NextResponse.json({ error: 'Falta habitacion' }, { status: 400 });
      }
      const hab = await db.habitacion.findUnique({
        where: { tenantId_numero: { tenantId, numero: habitacion.trim() } },
      });
      if (!hab) return NextResponse.json({ error: 'Habitación no encontrada' }, { status: 404 });
      key = `tenants/${tenantId}/habitaciones/${habitacion.trim()}/${randomUUID()}.${extForContentType(contentType)}`;
    } else if (tipo === 'factura') {
      key = `tenants/${tenantId}/factura/${randomUUID()}.${extForContentType(contentType)}`;
    } else {
      key = `tenants/${tenantId}/hotel/${randomUUID()}.${extForContentType(contentType)}`;
    }

    const uploadUrl = await getPresignedUploadUrl(key, contentType, size);
    const publicUrl = buildPublicUrl(key);

    return NextResponse.json({ uploadUrl, publicUrl, key });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('POST /api/uploads/presign:', error);
    return NextResponse.json({ error: 'Error al generar la URL de subida' }, { status: 500 });
  }
}

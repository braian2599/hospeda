import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { getPresignedUploadUrl, buildPublicUrl, isAllowedImageType, extForContentType, MAX_UPLOAD_BYTES } from '@/lib/storage/r2';
import { randomUUID } from 'crypto';

// POST /api/super-admin/upload-logo — URL firmada para subir el logo de la
// empresa desarrolladora directo a R2 (solo super-admin).
export async function POST(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { contentType, size } = body as { contentType?: string; size?: number };

    if (!contentType || !isAllowedImageType(contentType)) {
      return NextResponse.json({ error: 'Formato no permitido (solo jpg, png, webp)' }, { status: 400 });
    }
    if (!size || size <= 0 || size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: `El archivo debe pesar menos de ${MAX_UPLOAD_BYTES / 1024 / 1024}MB` }, { status: 400 });
    }

    const key = `platform/dev-company-logo/${randomUUID()}.${extForContentType(contentType)}`;
    const uploadUrl = await getPresignedUploadUrl(key, contentType, size);
    const publicUrl = buildPublicUrl(key);

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error) {
    console.error('POST /api/super-admin/upload-logo:', error);
    return NextResponse.json({ error: 'Error al generar la URL de subida' }, { status: 500 });
  }
}

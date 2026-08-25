import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { deleteObject, extractKeyFromPublicUrl } from '@/lib/storage/r2';

// POST /api/uploads/delete — Elimina una foto de R2 a partir de su URL pública
// (solo si pertenece al propio tenant — se valida vía el prefijo de la key).
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requireOwner();
    const { url } = (await req.json()) as { url?: string };

    if (!url) {
      return NextResponse.json({ error: 'Falta url' }, { status: 400 });
    }
    const key = extractKeyFromPublicUrl(url);
    if (!key || !key.startsWith(`tenants/${tenantId}/`)) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    await deleteObject(key);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('POST /api/uploads/delete:', error);
    return NextResponse.json({ error: 'Error al eliminar el archivo' }, { status: 500 });
  }
}

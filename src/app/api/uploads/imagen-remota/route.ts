import { NextRequest, NextResponse } from 'next/server';
import { requireTenantId, AuthError } from '@/lib/auth/utils';

// ─────────────────────────────────────────────────────────
// GET /api/uploads/imagen-remota?url=<url pública de R2>
// Reenvía (proxy) una imagen ya pública de nuestro bucket R2, del mismo
// origen que la app. Existe porque el navegador SÍ puede mostrar un <img
// src="https://...r2.dev/...">, pero un fetch() del lado del cliente a ese
// mismo bucket puede fallar por CORS (R2 no manda Access-Control-Allow-Origin
// para el dominio de la app) — y eso es justo lo que necesita jsPDF
// (doc.addImage) para poder embeber el logo en el PDF. Al pasar por esta
// ruta, el fetch lo hace el servidor (sin restricción de CORS) y el
// navegador solo hace fetch a nuestro propio origen.
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    await requireTenantId();

    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
      return NextResponse.json({ error: 'Falta el parámetro url' }, { status: 400 });
    }

    const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
    if (!base || !url.startsWith(`${base}/`)) {
      // Evita que esta ruta se use como proxy genérico (SSRF): solo se
      // reenvían imágenes que ya son públicas de nuestro propio bucket.
      return NextResponse.json({ error: 'URL no permitida' }, { status: 400 });
    }

    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: 'No se pudo obtener la imagen' }, { status: 502 });
    }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    return new NextResponse(upstream.body, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET uploads/imagen-remota:', error);
    return NextResponse.json({ error: 'Error al obtener la imagen' }, { status: 500 });
  }
}

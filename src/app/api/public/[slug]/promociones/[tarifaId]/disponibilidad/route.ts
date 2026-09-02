import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/validation';
import {
  getPublicTenant, parseFechasConsulta, parsePersonasConsulta, buscarDisponibilidadPorTarifa,
} from '@/lib/public-landing';

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

// GET /api/public/[slug]/promociones/[tarifaId]/disponibilidad?checkin&checkout&personas
// Disponibilidad de TODAS las habitaciones del hotel cotizadas con la tarifa
// promocional puntual — no está atada a ningún tipo de habitación.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; tarifaId: string }> }
) {
  const ip = clientIp(req);
  const rl = await rateLimit(`public-promo-disponibilidad:${ip}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas consultas, esperá un momento.' }, { status: 429 });
  }

  const { slug, tarifaId } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const fechas = parseFechasConsulta(searchParams.get('checkin'), searchParams.get('checkout'));
  if ('error' in fechas) return NextResponse.json({ error: fechas.error }, { status: 400 });

  const personas = parsePersonasConsulta(searchParams.get('personas') || '2');
  if (typeof personas !== 'number') return NextResponse.json({ error: personas.error }, { status: 400 });

  const resultados = await buscarDisponibilidadPorTarifa(tenant, tarifaId, fechas, personas);

  return NextResponse.json({
    checkin: searchParams.get('checkin'),
    checkout: searchParams.get('checkout'),
    noches: fechas.noches,
    personas,
    resultados: resultados.map((r) => ({
      numero: r.numero,
      tipo: r.tipo,
      capacidad: r.capacidad,
      camasMatrimoniales: r.camasMatrimoniales,
      camasSimples: r.camasSimples,
      total: r.total,
      badges: r.badges,
      desglose: r.desglose,
    })),
  });
}

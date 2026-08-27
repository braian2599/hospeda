import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/validation';
import {
  getPublicTenant, parseFechasConsulta, parsePersonasConsulta, buscarDisponibilidad,
} from '@/lib/public-landing';

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

// GET /api/public/[slug]/disponibilidad?checkin&checkout&personas
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const ip = clientIp(req);
  const rl = await rateLimit(`public-disponibilidad:${ip}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas consultas, esperá un momento.' }, { status: 429 });
  }

  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  if (!tenant) return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const fechas = parseFechasConsulta(searchParams.get('checkin'), searchParams.get('checkout'));
  if ('error' in fechas) return NextResponse.json({ error: fechas.error }, { status: 400 });

  const personas = parsePersonasConsulta(searchParams.get('personas') || '2');
  if (typeof personas !== 'number') return NextResponse.json({ error: personas.error }, { status: 400 });

  const { resultados, combinaciones } = await buscarDisponibilidad(tenant, fechas, personas);

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
    combinaciones: combinaciones.map((c) => ({
      legs: c.legs,
      capacidadTotal: c.capacidadTotal,
      total: c.total,
    })),
  });
}

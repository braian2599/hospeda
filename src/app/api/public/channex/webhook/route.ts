import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { traerReservas } from '@/lib/channex/reservas';

// POST /api/public/channex/webhook?token=... — Channex avisa que hay una
// novedad de reservas. No se confía en lo que trae el aviso: se usa solo
// como timbre, y las reservas se leen de Channex con la clave de Hospi.
// El token es el secreto que se le dio a Channex al conectar el hotel.
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!/^[a-f0-9]{48}$/.test(token)) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const conexion = await db.channexConexion.findUnique({ where: { webhookToken: token }, select: { tenantId: true } });
  if (!conexion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Se contesta enseguida (Channex espera una respuesta rápida) y se leen después.
  after(async () => {
    try {
      await traerReservas(conexion.tenantId);
    } catch (e) {
      console.error('[channex webhook] No se pudieron traer las reservas:', e);
    }
  });
  return NextResponse.json({ ok: true });
}

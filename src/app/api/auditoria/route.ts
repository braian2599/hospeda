import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireActor, AuthError } from '@/lib/auth/utils';
import { esSuperAdmin, ACTOR_SISTEMA } from '@/lib/auditoria-actores';

/**
 * El nombre que se graba. Nunca el del super admin: ese se filtra al leer, y
 * dejar que el body lo use sería una forma de esconder acciones propias.
 */
function nombreDelActor(empleado: unknown): string {
  const nombre = String(empleado || ACTOR_SISTEMA).slice(0, 100);
  return esSuperAdmin(nombre) ? ACTOR_SISTEMA : nombre;
}

// POST /api/auditoria — Crear entrada de auditoría
export async function POST(req: NextRequest) {
  try {
    const { tenantId, actorId } = await requireActor();
    const body = await req.json();
    const { tipo, detalle, empleado } = body;

    if (!tipo || !detalle) {
      return NextResponse.json({ error: 'tipo y detalle son obligatorios' }, { status: 400 });
    }

    const entry = await db.auditoria.create({
      data: {
        tenantId,
        tipo: String(tipo).slice(0, 50),
        detalle: String(detalle).slice(0, 500),
        // El nombre del super admin se filtra al leer, así que aceptarlo acá
        // desde el body sería un agujero al revés: cualquiera con sesión
        // podría firmar sus propias acciones como "Super Admin" y las dejaría
        // invisibles en la auditoría del hotel. No se acepta.
        empleado: nombreDelActor(empleado),
        // El id del perfil sale de la SESIÓN, nunca del cuerpo del pedido.
        //
        // Hasta acá se guardaba solo el nombre como texto, y con eso el
        // reporte de horas no servía: dos perfiles llamados "Ana" sumaban al
        // mismo montón, y renombrar a alguien le partía el historial al medio.
        //
        // Del body sería falseable: cualquiera con sesión podría cargarle
        // horas a otro. De la sesión no.
        empleadoId: actorId,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/auditoria:', error);
    return NextResponse.json({ error: 'Error al registrar auditoría' }, { status: 500 });
  }
}

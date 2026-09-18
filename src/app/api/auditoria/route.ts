import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireActor, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';

// POST /api/auditoria — SOLO el cierre de sesión.
//
// POR QUÉ SOLO ESO: este endpoint aceptaba cualquier `tipo` y cualquier
// `detalle` que le mandaran. Era la puerta por la que el navegador escribía su
// propia versión de cada acción —una fila "Reserva" que se sumaba a la
// "reserva_creada" del servidor— y también el agujero por el que cualquiera
// con sesión podía inventar historial.
//
// Ahora todo lo demás lo escribe el servidor, adentro de la operación que
// audita (ver src/lib/auditoria.ts). Queda esta sola excepción: el Logout,
// porque nadie más que el navegador sabe que la persona se está yendo.
export async function POST(req: NextRequest) {
  try {
    const { tenantId, actorId, nombre } = await requireActor();
    const body = await req.json();
    const { tipo, detalle } = body;

    // Lista de UNO. Cualquier otro tipo se rechaza: si mañana hace falta
    // auditar algo nuevo desde el navegador, que sea una decisión consciente y
    // no un string que se cuela.
    if (tipo !== TIPO.LOGOUT) {
      return NextResponse.json(
        { error: 'Este endpoint solo registra el cierre de sesión.' },
        { status: 400 },
      );
    }
    if (!detalle) {
      return NextResponse.json({ error: 'detalle es obligatorio' }, { status: 400 });
    }

    // El nombre y el id salen de la SESIÓN, nunca del cuerpo del pedido: del
    // body serían falseables y cualquiera podría cerrarle el turno a otro.
    await auditar(db, {
      tenantId,
      tipo: TIPO.LOGOUT,
      detalle: String(detalle),
      actor: { id: actorId, nombre },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/auditoria:', error);
    return NextResponse.json({ error: 'Error al registrar auditoría' }, { status: 500 });
  }
}

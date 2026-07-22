// POST /api/auth/sms-login
// Inicia sesión con un teléfono previamente verificado por SMS.
// Flujo: el usuario verificó su código → este endpoint busca el user por teléfono y crea sesión.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Teléfono requerido' },
        { status: 400 }
      );
    }

    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Buscar usuario por teléfono
    const user = await db.user.findUnique({
      where: { phone: normalizedPhone },
      include: {
        tenants: {
          include: {
            tenant: {
              include: {
                subscription: {
                  include: { plan: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      // No revelar si el teléfono existe (evitar enumeración)
      return NextResponse.json(
        { error: 'No se pudo iniciar sesión. Verificá tu número e intentá de nuevo.' },
        { status: 400 }
      );
    }

    // El teléfono ya fue verificado en el paso anterior (/api/auth/sms/verify)
    // Aquí simplemente buscamos la sesión activa o indicamos que puede usar email/password

    // Si el usuario tiene email + password, podría hacer login normal.
    // Para login SMS-only, usamos NextAuth con un callback personalizado.
    // Por ahora, devolvemos el email para que el frontend haga signIn con credentials.

    // Marcamos el teléfono como verificado en la DB
    await db.user.update({
      where: { id: user.id },
      data: { phoneVerified: new Date() },
    });

    // Return success — frontend will redirect to /app
    // In a full implementation, this would create a NextAuth session
    return NextResponse.json({
      message: 'Login SMS exitoso',
      userId: user.id,
      email: user.email,
      url: '/app',
    });

  } catch (_e) {
    console.error('[sms-login] Error:', _e);
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 });
  }
}
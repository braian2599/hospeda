// POST /api/auth/sms/verify
// Verifica un código SMS ingresado por el usuario.
// Requiere: { phone: string, code: string }

import { NextRequest, NextResponse } from 'next/server';
import { verifySmsCode } from '@/lib/sms';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, code } = body as { phone?: string; code?: string };

    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Teléfono y código son requeridos' },
        { status: 400 }
      );
    }

    if (typeof code !== 'string' || code.trim().length !== 6) {
      return NextResponse.json(
        { error: 'El código debe tener 6 dígitos' },
        { status: 400 }
      );
    }

    // Verify the code
    const result = await verifySmsCode(phone, code);

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Código inválido' },
        { status: 401 }
      );
    }

    // Code is valid
    // TODO (con DB): Actualizar user.phoneVerified = new Date()
    // await db.user.update({
    //   where: { phone: phone.replace(/[\s\-\(\)]/g, '') },
    //   data: { phoneVerified: new Date() },
    // });

    return NextResponse.json({
      message: 'Teléfono verificado exitosamente',
      verified: true,
    });
  } catch (error: any) {
    console.error('[sms/verify] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
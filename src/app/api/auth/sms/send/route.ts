// POST /api/auth/sms/send
// Envía un código de verificación por SMS al número proporcionado.
// Requiere: { phone: string, purpose?: 'register' | 'login' | 'settings' }

import { NextRequest, NextResponse } from 'next/server';
import {
  sendVerificationSms,
  generateVerificationCode,
  isValidPhoneNumber,
  formatPhoneDisplay,
  isSmsConfigured,
} from '@/lib/sms';

const COOLDOWN_MS = 60 * 1000; // 1 minuto entre envíos

// Simple per-IP/phone cooldown to prevent spam
const lastSent = new Map<string, number>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, purpose } = body as { phone?: string; purpose?: string };

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json(
        { error: 'Número de teléfono requerido' },
        { status: 400 }
      );
    }

    // Validate phone format
    if (!isValidPhoneNumber(phone)) {
      return NextResponse.json(
        { error: 'Formato de teléfono inválido. Usá formato: +54 9 381 555-0000' },
        { status: 400 }
      );
    }

    // Check cooldown
    const key = phone.replace(/\D/g, '');
    const lastTime = lastSent.get(key) || 0;
    const now = Date.now();
    if (now - lastTime < COOLDOWN_MS) {
      const waitSeconds = Math.ceil((COOLDOWN_MS - (now - lastTime)) / 1000);
      return NextResponse.json(
        { error: `Esperá ${waitSeconds} segundos antes de reenviar el código.` },
        { status: 429 }
      );
    }

    // Generate and send code
    const code = generateVerificationCode();
    const result = await sendVerificationSms(phone, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'No se pudo enviar el SMS' },
        { status: 503 }
      );
    }

    // Update cooldown
    lastSent.set(key, now);

    // Mask the phone for the response
    const masked = formatPhoneDisplay(phone).replace(/\d{4}$/, '****');

    return NextResponse.json({
      message: 'Código enviado exitosamente',
      maskedPhone: masked,
      expiresIn: 600, // 10 minutos
      // En desarrollo, devolver el código para testing
      ...(result.code && { _devCode: result.code }),
    });
  } catch (error: any) {
    console.error('[sms/send] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
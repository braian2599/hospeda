// ==================== TWILIO SMS VERIFICATION ====================
// Funciones server-side para enviar y verificar códigos SMS.
// Los códigos se almacenan en la tabla VerificationToken (DB), no en memoria.

import crypto from 'crypto';

// ── Types ──

export interface SmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string; // Twilio phone number, e.g. +1234567890
  enabled: boolean;
}

export interface SendSmsResult {
  success: boolean;
  code?: string;         // Solo en dev para testing
  error?: string;
  sid?: string;          // Twilio message SID
}

export interface VerifyResult {
  valid: boolean;
  error?: string;
}

// ── Config ──

export function getTwilioConfig(): SmsConfig {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_PHONE_NUMBER || '',
    enabled: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
  };
}

/** Check if SMS verification is configured and available */
export function isSmsConfigured(): boolean {
  const config = getTwilioConfig();
  return config.enabled;
}

// ── Generate code ──

/** Generate a 6-digit numeric code */
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// ── Rate limiting (in-memory, same as before for SMS send) ──

const rateLimitStore = new Map<string, { count: number; firstAt: number }>();

/** Max 3 SMS per phone per 15 minutes */
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 min

function checkRateLimit(phone: string): { allowed: boolean; retryAfterSeconds: number } {
  const key = `rl:${phone}`;
  const entry = rateLimitStore.get(key);
  const now = Date.now();

  if (!entry || now - entry.firstAt > RATE_LIMIT_WINDOW) {
    rateLimitStore.set(key, { count: 1, firstAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW - (now - entry.firstAt)) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

// ── Send SMS ──

/**
 * Envía un código de verificación por SMS usando Twilio.
 * El código se guarda en la tabla VerificationToken de la DB.
 * En desarrollo (sin credenciales), simula el envío y devuelve el código.
 */
export async function sendVerificationSms(phone: string, code: string): Promise<SendSmsResult> {
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

  // Rate limit check
  const rateLimit = checkRateLimit(normalizedPhone);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Demasiados intentos. Esperá ${rateLimit.retryAfterSeconds} segundos antes de reenviar.`,
    };
  }

  const config = getTwilioConfig();

  // Guardar código en la DB (VerificationToken) en vez de memoria
  try {
    const { db } = await import('@/lib/db');
    const identifier = `sms:${normalizedPhone}`;
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    // Upsert: si ya existe un código para este teléfono, lo reemplaza
    await db.verificationToken.upsert({
      where: {
        identifier_token: { identifier, token: code },
      },
      create: { identifier, token: code, expires },
      update: { expires },
    });

    // Borrar códigos viejos para este teléfono
    await db.verificationToken.deleteMany({
      where: {
        identifier,
        token: { not: code },
      },
    });
  } catch (dbError) {
    console.error('[SMS] Error guardando código en DB:', dbError);
    // Si la DB falla, no enviamos el SMS
    return { success: false, error: 'Error interno. Intentá de nuevo.' };
  }

  // If Twilio not configured, simulate (dev mode)
  if (!config.enabled) {
    console.log(`[SMS-DEV] Code for ${normalizedPhone}: ${code}`);
    return {
      success: true,
      code, // Dev only: return code for testing
    };
  }

  // Send via Twilio
  try {
    const twilio = await import('twilio');
    const client = twilio.default(config.accountSid, config.authToken);

    const message = await client.messages.create({
      body: `Hospeda - Tu codigo de verificacion es: ${code}. No lo compartas con nadie. Expira en 10 minutos.`,
      from: config.fromNumber,
      to: normalizedPhone,
    });

    return {
      success: true,
      sid: message.sid,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[SMS] Error sending via Twilio:', err.message);

    // If Twilio fails but we're in dev, still allow it
    if (process.env.NODE_ENV === 'development') {
      console.log(`[SMS-DEV-FALLBACK] Code for ${normalizedPhone}: ${code}`);
      return { success: true, code };
    }

    return {
      success: false,
      error: 'No se pudo enviar el SMS. Verificá el número e intentá de nuevo.',
    };
  }
}

// ── Verify code ──

/**
 * Verifica un código SMS ingresado por el usuario.
 * Busca el código en la tabla VerificationToken de la DB.
 */
export async function verifySmsCode(phone: string, inputCode: string): Promise<VerifyResult> {
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
  const identifier = `sms:${normalizedPhone}`;

  try {
    const { db } = await import('@/lib/db');

    // Buscar el código en la DB
    const token = await db.verificationToken.findUnique({
      where: {
        identifier_token: { identifier, token: inputCode.trim() },
      },
    });

    if (!token) {
      return { valid: false, error: 'Código incorrecto. Verificá e intentá de nuevo.' };
    }

    // Check expiration
    if (token.expires < new Date()) {
      await db.verificationToken.delete({ where: { id: token.id } });
      return { valid: false, error: 'El código expiró. Solicitá uno nuevo.' };
    }

    // Success — borrar el token usado
    await db.verificationToken.delete({ where: { id: token.id } });
    return { valid: true };
  } catch (dbError) {
    console.error('[SMS] Error verificando código en DB:', dbError);
    return { valid: false, error: 'Error interno. Intentá de nuevo.' };
  }
}

// ── Helpers ──

/** Validate a phone number (basic format for Argentina/LatAm) */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return /^\d{8,15}$/.test(cleaned);
}

/** Format phone for display: +54 9 381 555-0000 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return phone;

  if (digits.startsWith('54') && digits.length >= 12) {
    const cc = digits.slice(0, 2);
    const area = digits.slice(2, 4);
    const prefix = digits.slice(4, 8);
    const suffix = digits.slice(8);
    return `+${cc} 9 ${area} ${prefix}-${suffix}`;
  }

  if (digits.length > 10) {
    return `+${digits.slice(0, -8)} ${digits.slice(-8, -4)}-${digits.slice(-4)}`;
  }
  return `${digits.slice(0, -4)}-${digits.slice(-4)}`;
}

// ==================== TWILIO SMS VERIFICATION ====================
// Funciones server-side para enviar y verificar códigos SMS.

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

// ── In-memory code store (production: Redis o DB) ──

interface StoredCode {
  code: string;
  phone: string;
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
}

// Simple in-memory store with TTL cleanup
const codeStore = new Map<string, StoredCode>();

/** Clean up expired codes every 5 minutes */
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of codeStore.entries()) {
      if (val.expiresAt < now) codeStore.delete(key);
    }
  }, 5 * 60 * 1000);
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

// ── Rate limiting ──

const rateLimitStore = new Map<string, { count: number; firstAt: number }>();

/** Max 3 SMS per phone per 15 minutes */
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 min

function checkRateLimit(phone: string): { allowed: boolean; retryAfterSeconds: number } {
  const key = `rl:${phone}`;
  const entry = rateLimitStore.get(key);
  const now = Date.now();

  if (!entry || now - entry.firstAt > RATE_LIMIT_WINDOW) {
    // Reset
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
 * En desarrollo (sin credenciales), simula el envío y devuelve el código.
 */
export async function sendVerificationSms(phone: string, code: string): Promise<SendSmsResult> {
  // Normalize phone: strip spaces, dashes, parentheses
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

  // Store the code before sending
  const storeKey = `sms:${normalizedPhone}`;
  codeStore.set(storeKey, {
    code,
    phone: normalizedPhone,
    createdAt: Date.now(),
    attempts: 0,
    maxAttempts: 5,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
  });

  // If Twilio not configured, simulate (dev mode)
  if (!config.enabled) {
    console.log(`[SMS-DEV] Code for ${normalizedPhone}: ${code}`);
    return {
      success: true,
      code, // Dev only: return code for testing
      error: undefined,
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
  } catch (error: any) {
    console.error('[SMS] Error sending via Twilio:', error?.message || error);

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
 */
export function verifySmsCode(phone: string, inputCode: string): VerifyResult {
  const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
  const storeKey = `sms:${normalizedPhone}`;
  const stored = codeStore.get(storeKey);

  if (!stored) {
    return { valid: false, error: 'No se encontró un código para este número. Solicitá uno nuevo.' };
  }

  // Check expiration
  if (Date.now() > stored.expiresAt) {
    codeStore.delete(storeKey);
    return { valid: false, error: 'El código expiró. Solicitá uno nuevo.' };
  }

  // Increment attempts
  stored.attempts++;
  if (stored.attempts > stored.maxAttempts) {
    codeStore.delete(storeKey);
    return { valid: false, error: 'Demasiados intentos fallidos. Solicitá un código nuevo.' };
  }

  // Compare codes
  if (stored.code !== inputCode.trim()) {
    const remaining = stored.maxAttempts - stored.attempts;
    return {
      valid: false,
      error: `Codigo incorrecto. ${remaining} intento${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''}.`,
    };
  }

  // Success — clean up
  codeStore.delete(storeKey);
  return { valid: true };
}

// ── Helpers ──

/** Validate a phone number (basic format for Argentina/LatAm) */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  // Must be 8-15 digits, start with country code or not
  return /^\d{8,15}$/.test(cleaned);
}

/** Format phone for display: +54 9 381 555-0000 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return phone;

  // Argentine format heuristic
  if (digits.startsWith('54') && digits.length >= 12) {
    const cc = digits.slice(0, 2);
    const area = digits.slice(2, 4);
    const prefix = digits.slice(4, 8);
    const suffix = digits.slice(8);
    return `+${cc} 9 ${area} ${prefix}-${suffix}`;
  }

  // Generic format
  if (digits.length > 10) {
    return `+${digits.slice(0, -8)} ${digits.slice(-8, -4)}-${digits.slice(-4)}`;
  }
  return `${digits.slice(0, -4)}-${digits.slice(-4)}`;
}
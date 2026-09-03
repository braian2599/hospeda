import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto';

// ─── Helpers ───

// Campos que contienen credenciales sensibles.
// Se cifran en la BD con AES-256-GCM y se enmascaran en el GET.
const SENSITIVE_KEYS = new Set(['mp_access_token', 'mp_webhook_secret']);

// Enmascara un valor sensible: muestra solo los primeros y últimos 4 caracteres.
// Ej: "APP_USR-1234567890-abcdef" → "APP_...cdef"
// Si el valor es muy corto (< 8 chars), lo oculta completamente.
// Acepta valores cifrados (los descifra antes de enmascarar).
function maskSensitive(value: string): string {
  if (!value) return '';
  // Descifrar si está cifrado
  const plaintext = isEncrypted(value) ? decrypt(value) : value;
  if (plaintext.length <= 8) return '••••';
  return `${plaintext.slice(0, 4)}...${plaintext.slice(-4)}`;
}

// GET /api/super-admin/config — Obtener toda la configuración de plataforma
// Las credenciales sensibles se devuelven enmascaradas por seguridad.
// El frontend puede enviar el valor completo en el PUT para actualizar.
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const configs = await db.platformConfig.findMany();
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    // Enmascarar credenciales sensibles
    const maskedConfig: Record<string, string> = {};
    for (const [key, value] of Object.entries(configMap)) {
      maskedConfig[key] = SENSITIVE_KEYS.has(key) ? maskSensitive(value) : value;
    }

    return NextResponse.json({
      config: maskedConfig,
      // Indica qué campos están enmascarados (para que el frontend sepa
      // que debe enviar el valor completo solo si el usuario lo edita)
      maskedFields: Array.from(SENSITIVE_KEYS),
      // Agrupar para facilidad de uso
      mercadopago: {
        accessToken: maskSensitive(configMap.mp_access_token || ''),
        publicKey: configMap.mp_public_key || '',
        webhookUrl: configMap.mp_webhook_url || '',
        webhookSecret: maskSensitive(configMap.mp_webhook_secret || ''),
        // Flags indicando si hay un valor real guardado (sin exponerlo)
        hasAccessToken: !!configMap.mp_access_token,
        hasWebhookSecret: !!configMap.mp_webhook_secret,
      },
      banco: {
        banco: configMap.bank_banco || '',
        titular: configMap.bank_titular || '',
        cbu: configMap.bank_cbu || '',
        alias: configMap.bank_alias || '',
        cuit: configMap.bank_cuit || '',
        comprobanteEmail: configMap.bank_comprobante_email || '',
        comprobanteWhatsapp: configMap.bank_comprobante_whatsapp || '',
        comprobanteTelefono: configMap.bank_comprobante_telefono || '',
      },
      plataforma: {
        nombre: configMap.plataforma_nombre || 'Hospi',
        emailContacto: configMap.plataforma_email || '',
        moneda: configMap.plataforma_moneda || 'ARS',
        supportEmail: configMap.support_email || '',
      },
      empresaDesarrolladora: {
        nombre: configMap.dev_company_nombre || '',
        logoUrl: configMap.dev_company_logo_url || '',
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/config] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// PUT /api/super-admin/config — Guardar configuración de plataforma
// Si un campo sensible viene enmascarado (contiene "...""),
// se conserva el valor existente en la BD.
export async function PUT(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { config } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Falta config' }, { status: 400 });
    }

    // Leer config actual para preservar valores sensibles no editados
    // Descifrar valores existentes para comparar
    const existingConfigs = await db.platformConfig.findMany();
    const existingMap: Record<string, string> = {};
    for (const c of existingConfigs) {
      existingMap[c.key] = c.value; // puede estar cifrado o plaintext
    }

    // Upsert cada key
    for (const [key, rawValue] of Object.entries(config)) {
      let value = String(rawValue);

      // Si es un campo sensible:
      // 1. Si viene enmascarado (con "...") → el usuario no lo editó, conservar el existente
      // 2. Si viene vacío → conservar el existente
      // 3. Si viene un valor nuevo → cifrarlo antes de guardar
      if (SENSITIVE_KEYS.has(key)) {
        if (value.includes('...')) {
          // El usuario no lo editó → conservar valor existente (ya cifrado en BD)
          if (existingMap[key]) {
            continue; // No tocar el valor existente
          } else {
            continue; // No crear entrada con valor enmascarado
          }
        }
        if (!value && existingMap[key]) {
          continue; // No sobreescribir con vacío
        }
        // Cifrar el valor nuevo antes de guardar
        if (value) {
          value = encrypt(value);
        }
      }

      await db.platformConfig.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    // Invalidar cache de credenciales de MP (5 min en payments/config.ts)
    // para que los cambios se propaguen inmediatamente
    try {
      const { invalidatePaymentConfigCache } = await import('@/lib/payments/config');
      if (typeof invalidatePaymentConfigCache === 'function') {
        invalidatePaymentConfigCache();
      }
    } catch {
      // Si no se puede importar, no es crítico — el cache expira solo en 5 min
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/config PUT] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

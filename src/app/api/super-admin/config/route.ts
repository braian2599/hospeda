import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';

// ─── Helpers ───

// Campos que contienen credenciales sensibles.
// Se enmascaran en el GET para no exponerlos en la red.
const SENSITIVE_KEYS = new Set(['mp_access_token', 'mp_webhook_secret']);

// Enmascara un valor sensible: muestra solo los primeros y últimos 4 caracteres.
// Ej: "APP_USR-1234567890-abcdef" → "APP_...cdef"
// Si el valor es muy corto (< 8 chars), lo oculta completamente.
function maskSensitive(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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
        cuenta: configMap.bank_cuenta || '',
        comprobanteEmail: configMap.bank_comprobante_email || '',
        comprobanteWhatsapp: configMap.bank_comprobante_whatsapp || '',
        comprobanteTelefono: configMap.bank_comprobante_telefono || '',
      },
      plataforma: {
        nombre: configMap.plataforma_nombre || 'Hospeda',
        emailContacto: configMap.plataforma_email || '',
        moneda: configMap.plataforma_moneda || 'ARS',
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
    const existingConfigs = await db.platformConfig.findMany();
    const existingMap: Record<string, string> = {};
    for (const c of existingConfigs) {
      existingMap[c.key] = c.value;
    }

    // Upsert cada key
    for (const [key, rawValue] of Object.entries(config)) {
      let value = String(rawValue);

      // Si es un campo sensible y el valor viene enmascarado (con "...")
      // significa que el usuario NO lo editó → conservar el valor existente
      if (SENSITIVE_KEYS.has(key) && value.includes('...')) {
        // Si no hay valor previo y el usuario envió "••••" o vacío, skip
        if (existingMap[key]) {
          value = existingMap[key];
        } else {
          continue; // No crear entrada con valor enmascarado
        }
      }

      // No guardar valores vacíos para campos sensibles si ya hay uno
      if (SENSITIVE_KEYS.has(key) && !value && existingMap[key]) {
        continue;
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

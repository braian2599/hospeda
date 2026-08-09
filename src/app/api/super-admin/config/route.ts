import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';

// GET /api/super-admin/config — Obtener toda la configuración de plataforma
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const configs = await db.platformConfig.findMany();
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.key] = c.value;
    }

    return NextResponse.json({
      config: configMap,
      // Agrupar para facilidad de uso
      mercadopago: {
        accessToken: configMap.mp_access_token || '',
        publicKey: configMap.mp_public_key || '',
        webhookUrl: configMap.mp_webhook_url || '',
        webhookSecret: configMap.mp_webhook_secret || '',
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
export async function PUT(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { config } = body;

    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'Falta config' }, { status: 400 });
    }

    // Upsert cada key
    for (const [key, value] of Object.entries(config)) {
      await db.platformConfig.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/config PUT] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';

// GET /api/super-admin/status — Verificar estado del Super Admin
export async function GET() {
  const { error: authError, session } = await requireSuperAdmin();
  if (authError) return authError;

  const checks: { nombre: string; ok: boolean; detalle: string }[] = [];

  // Check DB connection
  try {
    await db.$queryRaw`SELECT 1`;
    checks.push({ nombre: 'Base de datos', ok: true, detalle: 'Conexión OK' });
  } catch (e: unknown) {
    const err = e as Error;
    checks.push({ nombre: 'Base de datos', ok: false, detalle: err.message });
  }

  // Check tenants
  try {
    const count = await db.tenant.count();
    checks.push({ nombre: 'Tabla Tenant', ok: true, detalle: `${count} registros` });
  } catch (e: unknown) {
    const err = e as Error;
    checks.push({ nombre: 'Tabla Tenant', ok: false, detalle: err.message });
  }

  // Check PlatformPayment
  try {
    const count = await db.platformPayment.count();
    checks.push({ nombre: 'Tabla PlatformPayment', ok: true, detalle: `${count} registros` });
  } catch (e: unknown) {
    const err = e as Error;
    checks.push({ nombre: 'Tabla PlatformPayment', ok: false, detalle: `Tabla no creada: ${err.message.slice(0, 80)}` });
  }

  // Check PlatformConfig
  try {
    const count = await db.platformConfig.count();
    checks.push({ nombre: 'Tabla PlatformConfig', ok: true, detalle: `${count} registros` });
  } catch (e: unknown) {
    const err = e as Error;
    checks.push({ nombre: 'Tabla PlatformConfig', ok: false, detalle: `Tabla no creada: ${err.message.slice(0, 80)}` });
  }

  // Check env var
  const emails = (process.env.SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
  checks.push({
    nombre: 'SUPER_ADMIN_EMAILS',
    ok: emails.length > 0,
    detalle: emails.length > 0 ? `${emails.length} email(s) configurado(s)` : 'No configurada',
  });

  return NextResponse.json({
    email: session?.user?.email,
    superAdminEmails: emails,
    checks,
    todoOk: checks.every(c => c.ok),
  });
}
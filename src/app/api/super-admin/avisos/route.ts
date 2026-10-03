import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { avisosDelMenu } from '@/lib/super-admin/datos';
import { handleApiError } from '@/lib/api-error';

// GET /api/super-admin/avisos — Los números del menú del Super Admin:
// cuántas cosas hay para resolver y cuántos grupos de Configuración faltan.
export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  try {
    return NextResponse.json(await avisosDelMenu());
  } catch (err) {
    return handleApiError(err, '/api/super-admin/avisos GET');
  }
}

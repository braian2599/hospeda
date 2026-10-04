import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { handleApiError } from '@/lib/api-error';
import { enviarEmail, enviarVariosEmails } from '@/lib/email';
import { emailAvisoPlataforma, esTipoAviso, type DatosAviso } from '@/lib/email/aviso-plataforma';

// Super Admin → Avisos: un email a los dueños de los hoteles (mantenimiento,
// novedad o aviso importante).
//
// GET  → historial de lo enviado y cuántos hoteles activos hay por plan.
// POST → { accion: 'prueba' }  se lo manda solo al Super Admin, para revisarlo.
//        { accion: 'enviar' }  a todos los hoteles activos, o a los de los
//                              planes elegidos. Queda en el historial.
//
// Va al email de la cuenta de cada hotel (el del dueño). Los hoteles dados de
// baja (Tenant.activo = false) no lo reciben.

const PLANES = ['trial', 'basico', 'profesional', 'premium', 'elite'] as const;
type TipoPlan = typeof PLANES[number];

/** Hoteles activos con el email de su cuenta y su plan. */
async function hotelesActivos(planes: TipoPlan[]) {
  const tenants = await db.tenant.findMany({
    where: {
      activo: true,
      ...(planes.length ? { subscription: { plan: { type: { in: planes } } } } : {}),
    },
    select: {
      nombre: true,
      email: true,
      subscription: { select: { plan: { select: { type: true } } } },
      users: {
        where: { rol: 'owner', activo: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { user: { select: { email: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  return tenants
    .map(t => ({ hotel: t.nombre, email: t.users[0]?.user.email || t.email, plan: t.subscription?.plan.type ?? null }))
    .filter(h => !!h.email);
}

/** Valida lo que llega del formulario. Devuelve el error para mostrar, o los datos. */
function leerAviso(body: Record<string, unknown>): { error: string } | { datos: DatosAviso; planes: TipoPlan[] } {
  const { tipo } = body;
  if (!esTipoAviso(tipo)) return { error: 'Elegí el tipo de aviso.' };
  const asunto = typeof body.asunto === 'string' ? body.asunto.trim() : '';
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
  if (asunto.length < 3 || asunto.length > 150) return { error: 'El asunto tiene que tener entre 3 y 150 caracteres.' };
  if (!mensaje || mensaje.length > 5000) return { error: 'Escribí el mensaje (hasta 5000 caracteres).' };

  let dia: string | null = null, desde: string | null = null, hasta: string | null = null;
  if (tipo === 'mantenimiento') {
    const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
    dia = typeof body.dia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dia) ? body.dia : null;
    desde = typeof body.desde === 'string' && hora.test(body.desde) ? body.desde : null;
    hasta = typeof body.hasta === 'string' && hora.test(body.hasta) ? body.hasta : null;
    if (!dia || !desde || !hasta) return { error: 'Para un mantenimiento, completá el día y el horario.' };
  }

  const crudos = Array.isArray(body.planes) ? body.planes : [];
  const planes = PLANES.filter(p => crudos.includes(p));
  if (crudos.length && !planes.length) return { error: 'Elegí al menos un plan.' };
  return { datos: { tipo, asunto, mensaje, dia, desde, hasta }, planes };
}

export async function GET() {
  const { error } = await requireSuperAdmin();
  if (error) return error;
  try {
    const [avisos, hoteles] = await Promise.all([
      db.avisoPlataforma.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      hotelesActivos([]),
    ]);
    const porPlan = Object.fromEntries(PLANES.map(p => [p, hoteles.filter(h => h.plan === p).length]));
    return NextResponse.json({
      avisos: avisos.map(a => ({ ...a, createdAt: a.createdAt.toISOString() })),
      hoteles: { total: hoteles.length, porPlan },
    });
  } catch (err) {
    return handleApiError(err, '/api/super-admin/avisos-email GET');
  }
}

export async function POST(req: NextRequest) {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const leido = leerAviso(body);
    if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 });
    const { datos, planes } = leido;
    const yo = session!.user!.email!;

    if (body.accion === 'prueba') {
      const r = await enviarEmail(emailAvisoPlataforma(yo, 'Hotel de ejemplo', datos), 'aviso de la plataforma (prueba)');
      if (!r.success) return NextResponse.json({ error: 'No se pudo mandar la prueba. Probá de nuevo en un rato.' }, { status: 502 });
      return NextResponse.json({ ok: true, para: yo });
    }

    if (body.accion !== 'enviar') return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });

    // Un doble clic no lo manda dos veces.
    const repetido = await db.avisoPlataforma.findFirst({
      where: { asunto: datos.asunto, createdAt: { gt: new Date(Date.now() - 2 * 60 * 1000) } },
      select: { id: true },
    });
    if (repetido) return NextResponse.json({ error: 'Ese aviso se acaba de mandar. Esperá un par de minutos si querés mandarlo de nuevo.' }, { status: 409 });

    const hoteles = await hotelesActivos(planes);
    if (!hoteles.length) return NextResponse.json({ error: 'No hay hoteles activos para mandarle el aviso.' }, { status: 400 });

    // Primero queda anotado: si algo se corta en el medio, se ve en el historial.
    const aviso = await db.avisoPlataforma.create({
      data: { ...datos, planes, total: hoteles.length, creadoPor: yo },
    });
    const salieron = await enviarVariosEmails(hoteles.map(h => emailAvisoPlataforma(h.email, h.hotel, datos)), 'aviso de la plataforma');
    const fallidos = hoteles.filter((_, i) => !salieron[i]).map(h => ({ hotel: h.hotel, email: h.email }));
    const actualizado = await db.avisoPlataforma.update({
      where: { id: aviso.id },
      data: { enviados: hoteles.length - fallidos.length, fallidos },
    });
    console.log(`[super-admin] Aviso "${datos.asunto}" por ${yo}: ${actualizado.enviados} de ${hoteles.length} enviados`);
    return NextResponse.json({ ok: true, total: hoteles.length, enviados: actualizado.enviados, fallidos: fallidos.length });
  } catch (err) {
    return handleApiError(err, '/api/super-admin/avisos-email POST');
  }
}

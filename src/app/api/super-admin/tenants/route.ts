import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import {
  FEATURE_FLAGS,
  parseFeatureFlags,
  parseFlagOverrides,
  resolverFlags,
  valorDeModo,
  type FeatureFlag,
  type ModoFlag,
} from '@/lib/feature-flags';
import { setFeatureFlag, getPlanFeatureFlags } from '@/lib/feature-flags-server';
import { deleteAllTenantObjects } from '@/lib/storage/r2';
import bcrypt from 'bcryptjs';

// GET /api/super-admin/tenants — Listar todos los tenants con info de suscripción
export async function GET(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const estadoFilter = searchParams.get('estado') || '';

    const whereClause: Record<string, unknown> = {};
    if (search) {
      whereClause.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tenants = await db.tenant.findMany({
      where: whereClause,
      include: {
        subscription: { include: { plan: true } },
        configuracion: { select: { featureFlags: true } },
        users: {
          include: { user: { select: { id: true, email: true, name: true } } },
          where: { activo: true },
        },
        _count: {
          select: {
            habitaciones: true,
            reservas: true,
            users: { where: { activo: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Filtrar por estado de suscripción si se pidió
    const filtered = estadoFilter
      ? tenants.filter(t => t.subscription?.estado === estadoFilter)
      : tenants;

    const total = await db.tenant.count({ where: whereClause as any });

    const result = filtered.map(t => {
      const sub = t.subscription;
      const diasRestantes = sub?.fechaVencimiento
        ? Math.max(0, Math.ceil((new Date(sub.fechaVencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      return {
        id: t.id,
        nombre: t.nombre,
        slug: t.slug,
        email: t.email,
        telefono: t.telefono,
        pais: t.pais,
        activo: t.activo,
        creadoEn: t.createdAt.toISOString(),
        suscripcion: sub ? {
          id: sub.id,
          plan: sub.plan.nombre,
          planType: sub.plan.type,
          estado: sub.estado,
          fechaInicio: sub.fechaInicio.toISOString(),
          fechaVencimiento: sub.fechaVencimiento.toISOString(),
          diasRestantes,
          paymentProviderId: sub.paymentProviderId,
        } : null,
        usuarios: t.users.map(tu => ({
          id: tu.id,
          nombre: tu.nombreCompleto || tu.user.name || '',
          email: tu.user.email,
          rol: tu.rol,
          tienePassword: !!tu.password,
        })),
        stats: {
          habitaciones: t._count.habitaciones,
          reservas: t._count.reservas,
          usuariosActivos: t._count.users,
        },
        // Tres cosas distintas, porque la UI necesita las tres:
        //   featureFlagsPlan → lo que trae el plan del hotel (el default del nivel)
        //   featureFlagsOverrides → las excepciones cargadas para ESTE hotel.
        //     Una clave ausente significa "sigue a su plan", no "apagada".
        //   featureFlags → el resultado final, que es lo que el hotel ve.
        featureFlagsPlan: parseFeatureFlags(sub?.plan?.featureFlags),
        featureFlagsOverrides: parseFlagOverrides(t.configuracion?.featureFlags),
        featureFlags: resolverFlags(
          parseFeatureFlags(sub?.plan?.featureFlags),
          parseFlagOverrides(t.configuracion?.featureFlags),
        ),
      };
    });

    return NextResponse.json({ tenants: result, total, page, limit });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/tenants] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// PATCH /api/super-admin/tenants — Cambiar plan, activar/desactivar, resetear contraseña
/**
 * Una fecha de vencimiento válida, o null.
 *
 * Se acepta una fecha en el pasado a propósito: es la forma de cortarle el
 * servicio a un hotel ahora mismo, sin esperar. Lo que no se acepta es una
 * fecha absurda —diez años, o el año 1900— que casi siempre es un dedazo
 * escribiendo el año.
 */
function vencimientoValido(crudo: unknown): Date | null {
  if (typeof crudo !== 'string' || !crudo.trim()) return null;
  const fecha = new Date(crudo);
  if (Number.isNaN(fecha.getTime())) return null;
  const ahora = Date.now();
  const unAnioAtras = ahora - 365 * 86400000;
  const cincoAniosAdelante = ahora + 5 * 365 * 86400000;
  if (fecha.getTime() < unAnioAtras || fecha.getTime() > cincoAniosAdelante) return null;
  return fecha;
}

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { tenantId, action, ...data } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Falta tenantId' }, { status: 400 });
    }

    const adminEmail = session?.user?.email || 'desconocido';
    // Log interno (no tenant-visible) para trazabilidad de qué super-admin
    // hizo cada acción — el email NO va al registro de auditoría del tenant
    // (Auditoria.empleado), que los hoteles ven en su propio módulo de
    // Usuarios ("Actividad reciente"). Ver también plans/route.ts y
    // payments/route.ts, que tenían el mismo problema.
    console.log(`[super-admin] PATCH tenant ${tenantId} action=${action} por ${adminEmail}`);

    // ── Cambiar plan ──
    if (action === 'changePlan') {
      const { planId, duracionMeses } = data;
      if (!planId) return NextResponse.json({ error: 'Falta planId' }, { status: 400 });

      const meses = duracionMeses || 1;
      const plan = await db.plan.findUnique({ where: { id: planId } });
      if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 });

      const subscription = await db.subscription.findUnique({ where: { tenantId } });
      if (!subscription) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });

      const fechaInicio = new Date();
      // Por defecto el ciclo arranca hoy y dura `meses`. Pero se puede fijar la
      // fecha exacta: si el hotel factura el 10 de cada mes, cambiarle el plan
      // un día 17 no tiene por qué correrle el ciclo al 17. Antes esto siempre
      // reiniciaba el reloj a "hoy + N meses" y no había forma de evitarlo.
      const fechaElegida = vencimientoValido(data.fechaVencimiento);
      const fechaVencimiento = fechaElegida ?? new Date(fechaInicio);
      if (!fechaElegida) fechaVencimiento.setMonth(fechaVencimiento.getMonth() + meses);

      const planAnterior = await db.plan.findUnique({ where: { id: subscription.planId } });

      // Quien cambia el plan a mano tiene que declarar si hubo plata de por
      // medio. Sin esto, una cortesía quedaba escrita igual que una suscripción
      // pagada y el hotel figuraba como suscripto: el día del vencimiento se le
      // cortaba el servicio sin que nadie lo hubiera visto venir.
      // Se asume cortesía cuando no se aclara: es el caso que más avisa.
      const origen = data.origen === 'transferencia' ? 'transferencia' : 'cortesia';

      // Una cortesía no se renueva sola ni tiene cobro programado. Si este
      // hotel venía de una suscripción de Mercado Pago, esos rastros se
      // limpian: si no, la pantalla seguiría prometiendo un cobro automático
      // que ya no va a ocurrir.
      const cortaLaRecurrencia = origen === 'cortesia'
        ? { esRecurrente: false, mpPreapprovalId: null, proximoCobro: null, paymentProviderId: null }
        : {};

      const updated = await db.subscription.update({
        where: { tenantId },
        data: {
          planId,
          estado: 'activa',
          origen,
          fechaInicio,
          fechaVencimiento,
          trialUsado: true,
          ...cortaLaRecurrencia,
        },
        include: { plan: true },
      });

      // El super admin NO deja rastro en la auditoría del hotel: está por
      // encima de todos y sus acciones no son actividad del personal. La
      // trazabilidad de quién hizo esto queda en el log del servidor
      // ('[super-admin] …'), que es donde corresponde — es información de la
      // plataforma, no del hotel. Ver src/lib/auditoria-actores.ts.

      return NextResponse.json({ success: true, subscription: updated });
    }

    // ── Activar/Desactivar tenant ──
    if (action === 'toggleActive') {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });

      const nuevoEstado = !tenant.activo;
      const updated = await db.tenant.update({
        where: { id: tenantId },
        data: { activo: nuevoEstado },
      });

      // Si se desactivó el tenant, invalidar TODAS las sesiones activas de sus usuarios.
      // Esto fuerza a los usuarios a re-loguearse; al re-loguearse, si el tenant está
      // inactivo, no podrán seleccionarlo (el selector de hotel filtra por activo=true).
      if (!nuevoEstado) {
        const tenantUsers = await db.tenantUser.findMany({
          where: { tenantId },
          select: { userId: true },
        });
        const userIds = [...new Set(tenantUsers.map(tu => tu.userId))];
        if (userIds.length > 0) {
          // Borrar sesiones asociadas a este tenant específico
          // (Session.tenantId es un string plano, no FK)
          for (const userId of userIds) {
            await db.session.deleteMany({
              where: { userId, tenantId },
            });
          }
        }
      }

      // El super admin NO deja rastro en la auditoría del hotel: está por
      // encima de todos y sus acciones no son actividad del personal. La
      // trazabilidad de quién hizo esto queda en el log del servidor
      // ('[super-admin] …'), que es donde corresponde — es información de la
      // plataforma, no del hotel. Ver src/lib/auditoria-actores.ts.

      return NextResponse.json({ success: true, activo: updated.activo });
    }

    // ── Fijar el modo de una integración para este hotel ──
    // modo: 'plan' (sigue a su plan) | 'on' (forzada prendida) | 'off' (forzada apagada).
    // Se acepta además el formato viejo { enabled: boolean } por si queda
    // alguna pestaña abierta con el build anterior: equivale a 'on'/'plan'.
    if (action === 'toggleFeatureFlag') {
      const { flag } = data;
      if (!flag || !(flag in FEATURE_FLAGS)) {
        return NextResponse.json({ error: 'Falta una integración válida' }, { status: 400 });
      }

      let modo: ModoFlag;
      if (data.modo !== undefined) {
        if (data.modo !== 'plan' && data.modo !== 'on' && data.modo !== 'off') {
          return NextResponse.json({ error: "modo debe ser 'plan', 'on' u 'off'" }, { status: 400 });
        }
        modo = data.modo;
      } else if (typeof data.enabled === 'boolean') {
        modo = data.enabled ? 'on' : 'plan';
      } else {
        return NextResponse.json({ error: "Falta modo ('plan', 'on' u 'off')" }, { status: 400 });
      }

      const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });

      const overrides = await setFeatureFlag(tenantId, flag as FeatureFlag, valorDeModo(modo));
      const planFlags = await getPlanFeatureFlags(tenantId);
      const efectivas = resolverFlags(planFlags, overrides);

      const comoQueda = efectivas[flag as FeatureFlag] ? 'activada' : 'desactivada';
      const porQue = modo === 'plan' ? 'según su plan' : 'forzada por super-admin';

      // El super admin NO deja rastro en la auditoría del hotel: está por
      // encima de todos y sus acciones no son actividad del personal. La
      // trazabilidad de quién hizo esto queda en el log del servidor
      // ('[super-admin] …'), que es donde corresponde — es información de la
      // plataforma, no del hotel. Ver src/lib/auditoria-actores.ts.

      return NextResponse.json({
        success: true,
        featureFlagsOverrides: overrides,
        featureFlags: efectivas,
      });
    }

    // ── Resetear contraseña de un perfil ──
    if (action === 'resetPassword') {
      const { tenantUserId, newPassword } = data;
      if (!tenantUserId || !newPassword) {
        return NextResponse.json({ error: 'Falta tenantUserId o newPassword' }, { status: 400 });
      }
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Minimo 6 caracteres' }, { status: 400 });
      }

      const tu = await db.tenantUser.findFirst({
        where: { id: tenantUserId, tenantId },
        include: { user: { select: { email: true } } },
      });
      if (!tu) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Actualizar contraseña Y invalidar sesiones del usuario en una transacción
      await db.$transaction(async (tx) => {
        await tx.tenantUser.update({
          where: { id: tenantUserId },
          data: { password: hashedPassword },
        });

        // Invalidar TODAS las sesiones del usuario (no solo las de este tenant).
        // El usuario afectado debe re-loguearse con la nueva contraseña.
        await tx.session.deleteMany({
          where: { userId: tu.userId },
        });

      // El super admin NO deja rastro en la auditoría del hotel: está por
      // encima de todos y sus acciones no son actividad del personal. La
      // trazabilidad de quién hizo esto queda en el log del servidor
      // ('[super-admin] …'), que es donde corresponde — es información de la
      // plataforma, no del hotel. Ver src/lib/auditoria-actores.ts.
      });

      return NextResponse.json({ success: true, message: 'Contraseña actualizada y sesiones invalidadas' });
    }

    // ── Extender suscripción ──
    if (action === 'extendSubscription') {
      const { dias } = data;
      const subscription = await db.subscription.findUnique({ where: { tenantId } });
      if (!subscription) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });

      // Dos formas de ajustar el vencimiento:
      //  - `fecha`: se pone esa fecha, tal cual. Es lo que hace falta cuando el
      //    ciclo del hotel es "el 10 de cada mes": una fecha no se acierta
      //    sumando y restando días.
      //  - `dias`: se corre desde el vencimiento actual. Ahora acepta números
      //    NEGATIVOS. Antes rechazaba todo lo que no fuera positivo, así que un
      //    vencimiento que se había pasado de largo no se podía volver atrás
      //    y había que cambiar el plan entero, lo que reiniciaba el reloj.
      const fechaFijada = vencimientoValido(data.fecha);
      let baseDate: Date;
      let detalleAuditoria: string;

      if (fechaFijada) {
        baseDate = fechaFijada;
        detalleAuditoria = `Vencimiento fijado al ${baseDate.toLocaleDateString('es-AR')} por super-admin.`;
      } else {
        const diasNum = Number(dias);
        if (!Number.isInteger(diasNum) || diasNum === 0) {
          return NextResponse.json({ error: 'Indicá una fecha, o una cantidad de días distinta de cero' }, { status: 400 });
        }
        if (Math.abs(diasNum) > 365) {
          return NextResponse.json({ error: 'No se pueden mover más de 365 días por acción' }, { status: 400 });
        }
        // Sumar parte del vencimiento actual (o de hoy si ya se pasó); restar
        // siempre parte del vencimiento actual: si no, restarle días a una
        // suscripción ya vencida la mandaría todavía más atrás sin sentido.
        baseDate = diasNum > 0 && new Date(subscription.fechaVencimiento) <= new Date()
          ? new Date()
          : new Date(subscription.fechaVencimiento);
        baseDate.setDate(baseDate.getDate() + diasNum);

        if (!vencimientoValido(baseDate.toISOString())) {
          return NextResponse.json({ error: 'La fecha que queda es absurda. Revisá el número de días.' }, { status: 400 });
        }
        detalleAuditoria = `Suscripción ${diasNum > 0 ? 'extendida' : 'acortada'} ${Math.abs(diasNum)} día(s) por super-admin. Nuevo vencimiento: ${baseDate.toLocaleDateString('es-AR')}.`;
      }

      const updated = await db.subscription.update({
        where: { tenantId },
        data: { fechaVencimiento: baseDate, estado: 'activa' },
        include: { plan: true },
      });

      // El super admin NO deja rastro en la auditoría del hotel: está por
      // encima de todos y sus acciones no son actividad del personal. La
      // trazabilidad de quién hizo esto queda en el log del servidor
      // ('[super-admin] …'), que es donde corresponde — es información de la
      // plataforma, no del hotel. Ver src/lib/auditoria-actores.ts.

      return NextResponse.json({ success: true, subscription: updated });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/tenants PATCH] Error:', err.message);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}

// DELETE /api/super-admin/tenants — Eliminar un tenant y toda su data
// Requiere confirmación: el body debe incluir { confirmName } que coincida con el nombre del tenant.
export async function DELETE(req: NextRequest) {
  const { error, session } = await requireSuperAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const confirmName = searchParams.get('confirmName');

    if (!tenantId) {
      return NextResponse.json({ error: 'Falta tenantId' }, { status: 400 });
    }

    // Verificar que el tenant existe
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, nombre: true, email: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });
    }

    // Validar confirmación escrita: el nombre debe coincidir exactamente
    if (!confirmName || confirmName.trim() !== tenant.nombre) {
      return NextResponse.json(
        {
          error: `Confirmación requerida: escribí exactamente el nombre del hotel ("${tenant.nombre}") en el campo de confirmación.`,
          expectedName: tenant.nombre,
        },
        { status: 400 }
      );
    }

    const adminEmail = session?.user?.email || 'desconocido';

    // Obtener user IDs asociados al tenant antes de eliminarlo
    const tenantUsers = await db.tenantUser.findMany({
      where: { tenantId },
      select: { userId: true },
    });
    const userIds = [...new Set(tenantUsers.map(tu => tu.userId))];

    // Todo dentro de una transacción para garantizar consistencia
    await db.$transaction(async (tx) => {
      // El borrado no se audita en el hotel, y no podría: Auditoria tiene
      // onDelete: Cascade desde Tenant, así que la entrada se iría junto con
      // el tenant. El rastro queda en el log del servidor y en PlatformConfig,
      // que sobrevive al borrado.

      // Limpiar sesiones manuales (Session.tenantId es string plano, no FK)
      for (const userId of userIds) {
        await tx.session.deleteMany({ where: { userId, tenantId } });
      }

      // Guardar evidencia en PlatformConfig (key-value, sobrevive al delete del tenant)
      await tx.platformConfig.upsert({
        where: { key: `deleted_tenant_${tenantId}` },
        update: {
          value: JSON.stringify({
            tenantId,
            nombre: tenant.nombre,
            email: tenant.email,
            deletedAt: new Date().toISOString(),
            deletedBy: adminEmail,
            userIds,
            stats: {
              usersCount: tenantUsers.length,
              uniqueUsers: userIds.length,
            },
          }),
        },
        create: {
          key: `deleted_tenant_${tenantId}`,
          value: JSON.stringify({
            tenantId,
            nombre: tenant.nombre,
            email: tenant.email,
            deletedAt: new Date().toISOString(),
            deletedBy: adminEmail,
            userIds,
            stats: {
              usersCount: tenantUsers.length,
              uniqueUsers: userIds.length,
            },
          }),
        },
      });

      // Eliminar el tenant (onDelete: Cascade se encarga de TenantUser, Subscription, etc.)
      await tx.tenant.delete({
        where: { id: tenantId },
      });

      // Limpiar usuarios huérfanos (sin otros tenants)
      for (const userId of userIds) {
        const remaining = await tx.tenantUser.count({ where: { userId } });
        if (remaining === 0) {
          // Eliminar sesiones restantes del usuario y luego el usuario
          await tx.session.deleteMany({ where: { userId } });
          // Account se borra en cascada desde User
          await tx.user.delete({ where: { id: userId } });
        }
      }
    });

    // Limpiar el storage de R2 del tenant (fotos de hotel, de cada
    // habitación, logo de factura, etc.) — el tenant ya se borró de la
    // base, así que nada vuelve a apuntar a estos objetos; sin esto
    // quedaban huérfanos en el bucket para siempre.
    await deleteAllTenantObjects(tenantId);

    // Log estructurado (persistente via PlatformConfig)
    console.log(`[super-admin] Tenant eliminado: ${tenant.nombre} (${tenant.email}) por ${adminEmail}. ID: ${tenantId}`);

    return NextResponse.json({
      success: true,
      message: `Tenant "${tenant.nombre}" (${tenant.email}) eliminado correctamente`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[/api/super-admin/tenants DELETE] Error:', err.message);
    return NextResponse.json({ error: 'Error al eliminar el tenant' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
import { FEATURE_FLAGS, parseFeatureFlags, type FeatureFlag } from '@/lib/feature-flags';
import { setFeatureFlag } from '@/lib/feature-flags-server';
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
        // featureFlags: la excepción manual cargada para este hotel (independiente del plan).
        // featureFlagsPlan: lo que trae por defecto su plan actual — para mostrar en la UI
        // cuál de las dos cosas está prendiendo cada integración.
        featureFlags: parseFeatureFlags(t.configuracion?.featureFlags),
        featureFlagsPlan: parseFeatureFlags(sub?.plan?.featureFlags),
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
      const fechaVencimiento = new Date(fechaInicio);
      fechaVencimiento.setMonth(fechaVencimiento.getMonth() + meses);

      const planAnterior = await db.plan.findUnique({ where: { id: subscription.planId } });

      const updated = await db.subscription.update({
        where: { tenantId },
        data: {
          planId,
          estado: 'activa',
          fechaInicio,
          fechaVencimiento,
          trialUsado: true,
        },
        include: { plan: true },
      });

      // Registrar en auditoría del tenant
      await db.auditoria.create({
        data: {
          tenantId,
          tipo: 'Cambio de Plan',
          detalle: `Plan cambiado de "${planAnterior?.nombre || 'desconocido'}" a "${plan.nombre}" por ${meses} mes(es). Vencimiento: ${fechaVencimiento.toLocaleDateString('es-AR')}.`,
          empleado: 'Super Admin',
          empleadoId: null,
        },
      });

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

      // Registrar en auditoría
      await db.auditoria.create({
        data: {
          tenantId,
          tipo: 'Estado de Cuenta',
          detalle: `Tenant ${nuevoEstado ? 'activado' : 'desactivado'} por super-admin. ${nuevoEstado ? '' : 'Todas las sesiones activas fueron invalidadas.'}`,
          empleado: 'Super Admin',
          empleadoId: null,
        },
      });

      return NextResponse.json({ success: true, activo: updated.activo });
    }

    // ── Activar/Desactivar una feature flag ──
    if (action === 'toggleFeatureFlag') {
      const { flag, enabled } = data;
      if (!flag || typeof enabled !== 'boolean' || !(flag in FEATURE_FLAGS)) {
        return NextResponse.json({ error: 'Falta flag válida o enabled (boolean)' }, { status: 400 });
      }

      const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
      if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });

      const flags = await setFeatureFlag(tenantId, flag as FeatureFlag, enabled);

      await db.auditoria.create({
        data: {
          tenantId,
          tipo: 'Feature Flag',
          detalle: `"${FEATURE_FLAGS[flag as FeatureFlag].label}" ${enabled ? 'activada' : 'desactivada'} por super-admin.`,
          empleado: 'Super Admin',
          empleadoId: null,
        },
      });

      return NextResponse.json({ success: true, featureFlags: flags });
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

        // Registrar en auditoría
        await tx.auditoria.create({
          data: {
            tenantId,
            tipo: 'Reset Password',
            detalle: `Contraseña reseteada para el perfil "${tu.nombreCompleto || tu.user.email}" por super-admin. Todas las sesiones del usuario fueron invalidadas.`,
            empleado: 'Super Admin',
            empleadoId: null,
          },
        });
      });

      return NextResponse.json({ success: true, message: 'Contraseña actualizada y sesiones invalidadas' });
    }

    // ── Extender suscripción ──
    if (action === 'extendSubscription') {
      const { dias } = data;
      const diasNum = Number(dias);
      if (!diasNum || diasNum <= 0) {
        return NextResponse.json({ error: 'Falta días o debe ser mayor a 0' }, { status: 400 });
      }
      // Límite de seguridad: no extender más de 365 días en una sola acción
      if (diasNum > 365) {
        return NextResponse.json({ error: 'No se pueden extender más de 365 días por acción' }, { status: 400 });
      }

      const subscription = await db.subscription.findUnique({ where: { tenantId } });
      if (!subscription) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });

      const baseDate = new Date(subscription.fechaVencimiento) > new Date()
        ? new Date(subscription.fechaVencimiento)
        : new Date();
      baseDate.setDate(baseDate.getDate() + diasNum);

      const updated = await db.subscription.update({
        where: { tenantId },
        data: { fechaVencimiento: baseDate, estado: 'activa' },
        include: { plan: true },
      });

      // Registrar en auditoría
      await db.auditoria.create({
        data: {
          tenantId,
          tipo: 'Extensión de Suscripción',
          detalle: `Suscripción extendida ${diasNum} día(s) por super-admin. Nuevo vencimiento: ${baseDate.toLocaleDateString('es-AR')}.`,
          empleado: 'Super Admin',
          empleadoId: null,
        },
      });

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
      // Registrar en auditoría ANTES de borrar el tenant (para que exista la FK)
      // Como el tenant se va a borrar, guardamos el registro en un tenant especial
      // o lo dejamos como string en el detalle. Usamos el detalle para no romper la FK.
      // Auditoria tiene onDelete: Cascade desde Tenant, así que se borraría también.
      // Por eso registramos el evento en un log separado (consola) + un PlatformPayment
      // con nota para que quede rastro en PlatformPayment (que NO tiene onDelete cascade).

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
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/super-admin/auth';
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
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { tenantId, action, ...data } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Falta tenantId' }, { status: 400 });
    }

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

      return NextResponse.json({ success: true, subscription: updated });
    }

    // ── Activar/Desactivar tenant ──
    if (action === 'toggleActive') {
      const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) return NextResponse.json({ error: 'Tenant no encontrado' }, { status: 404 });

      const updated = await db.tenant.update({
        where: { id: tenantId },
        data: { activo: !tenant.activo },
      });

      return NextResponse.json({ success: true, activo: updated.activo });
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
      });
      if (!tu) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 });

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await db.tenantUser.update({
        where: { id: tenantUserId },
        data: { password: hashedPassword },
      });

      return NextResponse.json({ success: true, message: 'Contraseña actualizada' });
    }

    // ── Extender suscripción ──
    if (action === 'extendSubscription') {
      const { dias } = data;
      if (!dias || dias <= 0) {
        return NextResponse.json({ error: 'Falta días o debe ser mayor a 0' }, { status: 400 });
      }

      const subscription = await db.subscription.findUnique({ where: { tenantId } });
      if (!subscription) return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 });

      const baseDate = new Date(subscription.fechaVencimiento) > new Date()
        ? new Date(subscription.fechaVencimiento)
        : new Date();
      baseDate.setDate(baseDate.getDate() + dias);

      const updated = await db.subscription.update({
        where: { tenantId },
        data: { fechaVencimiento: baseDate, estado: 'activa' },
        include: { plan: true },
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
export async function DELETE(req: NextRequest) {
  const { error } = await requireSuperAdmin();
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');

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

    // Obtener user IDs asociados al tenant antes de eliminarlo
    const tenantUsers = await db.tenantUser.findMany({
      where: { tenantId },
      select: { userId: true },
    });
    const userIds = [...new Set(tenantUsers.map(tu => tu.userId))];

    // Todo dentro de una transacción para garantizar consistencia
    await db.$transaction(async (tx) => {
      // Session.tenantId es un string plano (no FK), no se borra por cascade.
      // Limpiar manualmente todas las sesiones que apunten a este tenant.
      for (const userId of userIds) {
        await tx.session.deleteMany({ where: { userId, tenantId } });
      }

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
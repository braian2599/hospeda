import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { db } from '@/lib/db';

// POST /api/auth/setup-hotel
// Crea el Tenant + TenantUser + Subscription para un usuario OAuth (Google)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { hotelNombre } = body;

    if (!hotelNombre || !hotelNombre.trim()) {
      return NextResponse.json({ error: 'Ingresá el nombre del hotel' }, { status: 400 });
    }

    // Verificar que el usuario no tenga ya un hotel
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: {
        tenants: { where: { activo: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (user.tenants.length > 0) {
      return NextResponse.json({
        message: 'Ya tenés un hotel configurado',
        tenantId: user.tenants[0].tenantId,
      });
    }

    // Generar slug único
    const slug = hotelNombre
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const existingTenant = await db.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      return NextResponse.json(
        { error: 'Ya existe un hotel con ese nombre. Probá con otro.' },
        { status: 409 }
      );
    }

    // Crear todo en transacción
    const result = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nombre: hotelNombre.trim(),
          slug,
          email: user.email,
          telefono: user.phone || null,
        },
      });

      await tx.tenantConfig.create({
        data: {
          tenantId: tenant.id,
          hotelNombre: hotelNombre.trim(),
        },
      });

      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          rol: 'owner',
          nombreCompleto: user.name || 'Propietario',
          permisos: [
            'dashboard', 'habitaciones', 'reservas', 'checkin',
            'facturacion', 'limpieza', 'caja', 'clientes',
            'reportes', 'usuarios', 'tarifas',
          ],
        },
      });

      const trialPlan = await tx.plan.findUnique({ where: { type: 'trial' } });
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: trialPlan!.id,
          estado: 'trial',
          fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return { tenant };
    });

    return NextResponse.json({
      message: 'Hotel creado exitosamente',
      tenantId: result.tenant.id,
      tenantNombre: result.tenant.nombre,
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Setup hotel error:', error);
    return NextResponse.json({ error: 'Error al crear el hotel' }, { status: 500 });
  }
}
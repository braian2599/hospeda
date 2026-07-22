import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// POST /api/auth/register
// Crea User + Tenant + TenantUser + Subscription (trial 30 días)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, hotelNombre, phone } = body;

    // Validaciones
    if (!email || !password || !name || !hotelNombre) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: email, contraseña, nombre, nombre del hotel' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      );
    }

    // Verificar que el email no exista
    const existingUser = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email' },
        { status: 409 }
      );
    }

    // Verificar que el slug del hotel no exista
    const slug = hotelNombre
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear todo en una transacción
    const result = await db.$transaction(async (tx) => {
      // 1. Crear User
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          name,
          phone: phone || null,
          emailVerified: null, // Requiere verificación
        },
      });

      // 2. Crear Tenant
      const tenant = await tx.tenant.create({
        data: {
          nombre: hotelNombre,
          slug,
          email: email.toLowerCase(),
          telefono: phone || null,
        },
      });

      // 3. Crear TenantConfig
      await tx.tenantConfig.create({
        data: {
          tenantId: tenant.id,
          hotelNombre,
        },
      });

      // 4. Crear TenantUser (owner)
      await tx.tenantUser.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          rol: 'owner',
          nombreCompleto: name,
          password: hashedPassword,
          permisos: [
            'dashboard', 'habitaciones', 'reservas', 'checkin',
            'facturacion', 'limpieza', 'caja', 'clientes',
            'reportes', 'usuarios', 'tarifas',
          ],
        },
      });

      // 5. Crear Subscription (trial 30 días)
      const trialPlan = await tx.plan.findUnique({ where: { type: 'trial' } });
      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: trialPlan!.id,
          estado: 'trial',
          fechaVencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      return { user, tenant };
    });

    // Generar token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await db.verificationToken.create({
      data: {
        identifier: result.user.email,
        token: verificationToken,
        expires,
      },
    });

    // Enviar email de verificación
    const { sendVerificationEmail, isEmailConfigured } = await import('@/lib/email');
    const emailResult = await sendVerificationEmail(result.user.email, verificationToken);

    const isDev = !isEmailConfigured();

    return NextResponse.json({
      message: 'Cuenta creada. Verificá tu email para comenzar.',
      userId: result.user.id,
      tenantId: result.tenant.id,
      ...(isDev && { _devToken: verificationToken }),
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';

// GET /api/configuracion/hotel (owner-only)
export async function GET() {
  try {
    const tenantId = await requireOwner();
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nombre: true, slug: true, email: true, telefono: true,
        direccion: true, pais: true, moneda: true, timezone: true, logoUrl: true,
        configuracion: {
          select: {
            hotelNombre: true, hotelDireccion: true, hotelCiudad: true,
            hotelPais: true, hotelTelefono: true, hotelEmail: true, hotelLogoUrl: true,
          },
        },
      },
    });
    if (!tenant) return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });

    const config = tenant.configuracion || {};
    return NextResponse.json({
      nombre: tenant.nombre,
      slug: tenant.slug,
      email: tenant.email,
      telefono: tenant.telefono || '',
      direccion: tenant.direccion || '',
      pais: tenant.pais || 'Argentina',
      moneda: tenant.moneda || 'ARS',
      timezone: tenant.timezone || 'America/Argentina/Buenos_Aires',
      logoUrl: tenant.logoUrl || config.hotelLogoUrl || '',
      // Config overrides
      hotelNombre: config.hotelNombre || tenant.nombre,
      hotelDireccion: config.hotelDireccion || tenant.direccion || '',
      hotelCiudad: config.hotelCiudad || '',
      hotelPais: config.hotelPais || tenant.pais || 'Argentina',
      hotelTelefono: config.hotelTelefono || tenant.telefono || '',
      hotelEmail: config.hotelEmail || tenant.email,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('GET /api/configuracion/hotel:', error);
    return NextResponse.json({ error: 'Error al obtener datos' }, { status: 500 });
  }
}

// PUT /api/configuracion/hotel
export async function PUT(req: NextRequest) {
  try {
    const tenantId = await requireOwner();
    const body = await req.json();
    const { nombre, email, telefono, direccion, pais, moneda, timezone, logoUrl } = body;

    // Update Tenant
    const updateData: Record<string, unknown> = {};
    if (nombre?.trim()) updateData.nombre = nombre.trim();
    if (email?.trim()) updateData.email = email.trim().toLowerCase();
    if (telefono !== undefined) updateData.telefono = telefono;
    if (direccion !== undefined) updateData.direccion = direccion;
    if (pais !== undefined) updateData.pais = pais;
    if (moneda !== undefined) updateData.moneda = moneda;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;

    await db.tenant.update({ where: { id: tenantId }, data: updateData });

    // Upsert TenantConfig
    await db.tenantConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        hotelNombre: nombre?.trim(),
        hotelDireccion: direccion,
        hotelPais: pais,
        hotelTelefono: telefono,
        hotelEmail: email?.trim().toLowerCase(),
        hotelLogoUrl: logoUrl,
      },
      update: {
        hotelNombre: nombre?.trim() || undefined,
        hotelDireccion: direccion,
        hotelPais: pais,
        hotelTelefono: telefono,
        hotelEmail: email?.trim().toLowerCase(),
        hotelLogoUrl: logoUrl,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PUT /api/configuracion/hotel:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}
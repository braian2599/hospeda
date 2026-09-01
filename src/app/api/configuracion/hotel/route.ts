import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';
import { parseFeatureFlags } from '@/lib/feature-flags';

// GET /api/configuracion/hotel (owner-only)
export async function GET() {
  try {
    const tenantId = await requireOwner();
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nombre: true, slug: true, email: true, telefono: true,
        direccion: true, ciudad: true, provincia: true, pais: true, moneda: true, timezone: true, logoUrl: true,
        horaCheckin: true, horaCheckout: true, politicaCancelacion: true,
        descripcion: true, fotos: true, servicios: true,
        configuracion: {
          select: {
            hotelNombre: true, hotelDireccion: true, hotelCiudad: true,
            hotelPais: true, hotelTelefono: true, hotelEmail: true, hotelLogoUrl: true,
            featureFlags: true, tarifasPublicas: true, mostrarSeccionAgencias: true, textoAgencias: true,
            modoCobroSena: true, senaWhatsapp: true, senaEmail: true, senaInstrucciones: true,
          },
        },
      },
    });
    if (!tenant) return NextResponse.json({ error: 'Hotel no encontrado' }, { status: 404 });

    const config = (tenant.configuracion || {}) as Record<string, unknown>;
    return NextResponse.json({
      nombre: tenant.nombre,
      slug: tenant.slug,
      email: tenant.email,
      telefono: tenant.telefono || '',
      direccion: tenant.direccion || '',
      ciudad: tenant.ciudad || '',
      provincia: tenant.provincia || '',
      pais: tenant.pais || 'Argentina',
      moneda: tenant.moneda || 'ARS',
      horaCheckin: tenant.horaCheckin || '',
      horaCheckout: tenant.horaCheckout || '',
      politicaCancelacion: tenant.politicaCancelacion || '',
      timezone: tenant.timezone || 'America/Argentina/Buenos_Aires',
      logoUrl: tenant.logoUrl || config.hotelLogoUrl || '',
      descripcion: tenant.descripcion || '',
      fotos: tenant.fotos || [],
      servicios: tenant.servicios || [],
      // Config overrides
      hotelNombre: config.hotelNombre || tenant.nombre,
      hotelDireccion: config.hotelDireccion || tenant.direccion || '',
      hotelCiudad: config.hotelCiudad || '',
      hotelPais: config.hotelPais || tenant.pais || 'Argentina',
      hotelTelefono: config.hotelTelefono || tenant.telefono || '',
      hotelEmail: config.hotelEmail || tenant.email,
      featureFlags: parseFeatureFlags(config.featureFlags),
      tarifasPublicas: (config.tarifasPublicas && typeof config.tarifasPublicas === 'object') ? config.tarifasPublicas : {},
      mostrarSeccionAgencias: !!config.mostrarSeccionAgencias,
      textoAgencias: config.textoAgencias || '',
      modoCobroSena: (config.modoCobroSena as string) || 'mercadopago',
      senaWhatsapp: config.senaWhatsapp || '',
      senaEmail: config.senaEmail || '',
      senaInstrucciones: config.senaInstrucciones || '',
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
    const {
      nombre, email, telefono, direccion, ciudad, provincia, pais, moneda, timezone, logoUrl, descripcion, fotos, servicios,
      horaCheckin, horaCheckout, politicaCancelacion,
      tarifasPublicas, mostrarSeccionAgencias, textoAgencias,
      modoCobroSena, senaWhatsapp, senaEmail, senaInstrucciones,
    } = body;

    if (modoCobroSena !== undefined && modoCobroSena !== 'mercadopago' && modoCobroSena !== 'manual') {
      return NextResponse.json({ error: 'Modo de cobro de seña inválido' }, { status: 400 });
    }

    // Update Tenant
    const updateData: Record<string, unknown> = {};
    if (nombre?.trim()) updateData.nombre = nombre.trim();
    if (email?.trim()) updateData.email = email.trim().toLowerCase();
    if (telefono !== undefined) updateData.telefono = telefono;
    if (direccion !== undefined) updateData.direccion = direccion;
    if (ciudad !== undefined) updateData.ciudad = ciudad;
    if (provincia !== undefined) updateData.provincia = provincia;
    if (pais !== undefined) updateData.pais = pais;
    if (moneda !== undefined) updateData.moneda = moneda;
    if (timezone !== undefined) updateData.timezone = timezone;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (descripcion !== undefined) updateData.descripcion = descripcion;
    if (horaCheckin !== undefined) updateData.horaCheckin = horaCheckin;
    if (horaCheckout !== undefined) updateData.horaCheckout = horaCheckout;
    if (politicaCancelacion !== undefined) updateData.politicaCancelacion = politicaCancelacion;
    if (Array.isArray(fotos)) updateData.fotos = fotos.filter((f: unknown) => typeof f === 'string');
    if (Array.isArray(servicios)) updateData.servicios = servicios.filter((s: unknown) => typeof s === 'string' && s.trim()).map((s: string) => s.trim());

    await db.tenant.update({ where: { id: tenantId }, data: updateData });

    // Campos opcionales de la landing (solo se tocan si vienen en el body)
    const configExtra: Record<string, unknown> = {};
    if (tarifasPublicas && typeof tarifasPublicas === 'object' && !Array.isArray(tarifasPublicas)) {
      configExtra.tarifasPublicas = tarifasPublicas;
    }
    if (mostrarSeccionAgencias !== undefined) configExtra.mostrarSeccionAgencias = !!mostrarSeccionAgencias;
    if (textoAgencias !== undefined) configExtra.textoAgencias = textoAgencias;
    if (modoCobroSena !== undefined) configExtra.modoCobroSena = modoCobroSena;
    if (senaWhatsapp !== undefined) configExtra.senaWhatsapp = senaWhatsapp;
    if (senaEmail !== undefined) configExtra.senaEmail = senaEmail;
    if (senaInstrucciones !== undefined) configExtra.senaInstrucciones = senaInstrucciones;

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
        ...configExtra,
      },
      update: {
        hotelNombre: nombre?.trim() || undefined,
        hotelDireccion: direccion,
        hotelPais: pais,
        hotelTelefono: telefono,
        hotelEmail: email?.trim().toLowerCase(),
        hotelLogoUrl: logoUrl,
        ...configExtra,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PUT /api/configuracion/hotel:', error);
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });
  }
}
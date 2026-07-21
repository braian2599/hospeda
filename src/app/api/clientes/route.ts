import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, AuthError } from '@/lib/auth/utils';

// GET /api/clientes?q=buscar — Listar clientes del tenant con búsqueda opcional
export async function GET(req: NextRequest) {
  try {
    const tenantId = await requirePermission('clientes');
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();

    const where = {
      tenantId,
      ...(q && {
        OR: [
          { nombre: { contains: q, mode: 'insensitive' as const } },
          { dni: { contains: q, mode: 'insensitive' as const } },
        ],
      }),
    };

    const clientes = await db.cliente.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { reservas: true, estadias: true },
        },
      },
    });

    return NextResponse.json(clientes);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET clientes:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

// POST /api/clientes — Crear un nuevo cliente
export async function POST(req: NextRequest) {
  try {
    const tenantId = await requirePermission('clientes');
    const body = await req.json();
    const {
      nombre,
      dni,
      telefono,
      email,
      fechaNacimiento,
      nacionalidad,
      preferencias,
    } = body;

    // Validaciones
    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    if (!dni?.trim()) {
      return NextResponse.json({ error: 'El DNI es obligatorio' }, { status: 400 });
    }
    if (!telefono?.trim()) {
      return NextResponse.json({ error: 'El teléfono es obligatorio' }, { status: 400 });
    }

    // Validar formato de email si se proporciona
    if (email?.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'El formato del email no es válido' }, { status: 400 });
      }
    }

    // Verificar DNI único dentro del tenant
    const existing = await db.cliente.findUnique({
      where: { tenantId_dni: { tenantId, dni: dni.trim() } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un cliente con ese DNI' }, { status: 409 });
    }

    const cliente = await db.cliente.create({
      data: {
        tenantId,
        nombre: nombre.trim(),
        dni: dni.trim(),
        telefono: telefono.trim(),
        ...(email?.trim() && { email: email.trim() }),
        ...(fechaNacimiento && { fechaNacimiento: new Date(fechaNacimiento) }),
        ...(nacionalidad?.trim() && { nacionalidad: nacionalidad.trim() }),
        ...(preferencias !== undefined && { preferencias: String(preferencias) }),
      },
    });

    // Auditoría
    await db.auditoria.create({
      data: {
        tenantId,
        tipo: 'cliente_creado',
        detalle: `Creación: cliente ${nombre.trim()} (DNI: ${dni.trim()})`,
        empleado: 'Sistema',
      },
    });

    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST clientes:', error);
    return NextResponse.json({ error: 'Error al crear cliente' }, { status: 500 });
  }
}
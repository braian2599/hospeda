import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireOwner, AuthError } from '@/lib/auth/utils';

// GET /api/configuracion/fiscal
export async function GET() {
  try {
    const tenantId = await requireOwner();
    const config = await db.tenantConfig.findUnique({
      where: { tenantId },
      select: {
        hotelCuit: true, hotelIva: true, hotelDireccion: true, hotelCiudad: true, puntoVenta: true,
        hotelRazonSocial: true, facturaLogoUrl: true, numeroFactura: true,
      },
    });
    return NextResponse.json({
      cuit: config?.hotelCuit || '',
      iva: config?.hotelIva || '',
      direccionFiscal: config?.hotelDireccion || '',
      ciudad: config?.hotelCiudad || '',
      puntoVenta: config?.puntoVenta || 1,
      razonSocial: config?.hotelRazonSocial || '',
      facturaLogoUrl: config?.facturaLogoUrl || '',
      // Cantidad de comprobantes ya emitidos. numeroInicio solo puede
      // editarse mientras esto sea 0 (ver validación en el PUT).
      numeroFactura: config?.numeroFactura || 0,
    });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('GET /api/configuracion/fiscal:', error);
    return NextResponse.json({ error: 'Error al obtener datos fiscales' }, { status: 500 });
  }
}

// PUT /api/configuracion/fiscal
export async function PUT(req: NextRequest) {
  try {
    const tenantId = await requireOwner();
    const body = await req.json();
    const { cuit, iva, direccionFiscal, ciudad, puntoVenta, razonSocial, facturaLogoUrl, numeroInicio } = body;

    const datosBase = {
      hotelCuit: cuit || null,
      hotelIva: iva || null,
      hotelDireccion: direccionFiscal || null,
      hotelCiudad: ciudad || null,
      puntoVenta: typeof puntoVenta === 'number' ? puntoVenta : undefined,
      hotelRazonSocial: razonSocial || null,
      facturaLogoUrl: facturaLogoUrl || null,
    };

    // numeroInicio fija el PRÓXIMO número a emitir (se guarda como
    // numeroFactura = numeroInicio - 1, ya que el endpoint de emisión
    // incrementa antes de asignar).
    let numeroInicioSolicitado: number | undefined;
    if (numeroInicio !== undefined && numeroInicio !== null && numeroInicio !== '') {
      const inicio = Number(numeroInicio);
      if (!Number.isInteger(inicio) || inicio < 1) {
        return NextResponse.json({ error: 'El número inicial debe ser un entero mayor o igual a 1' }, { status: 400 });
      }
      numeroInicioSolicitado = inicio;
    }

    if (numeroInicioSolicitado !== undefined) {
      const numeroFactura = numeroInicioSolicitado - 1;
      // Solo se permite mientras no se haya emitido ningún comprobante
      // todavía. UPDATE condicional atómico (compare-and-swap a nivel SQL:
      // el WHERE se evalúa junto con el row lock del UPDATE) para que una
      // emisión de comprobante concurrente nunca quede pisada por este
      // cambio, sin depender de un SELECT previo que podría quedar obsoleto.
      const claim = await db.tenantConfig.updateMany({
        where: { tenantId, numeroFactura: 0 },
        data: { ...datosBase, numeroFactura },
      });
      if (claim.count === 0) {
        const existente = await db.tenantConfig.findUnique({ where: { tenantId }, select: { numeroFactura: true } });
        if (existente) {
          return NextResponse.json({ error: 'Ya se emitieron comprobantes: no se puede cambiar el número inicial' }, { status: 400 });
        }
        // No existía el registro todavía → crearlo directamente con el número inicial.
        await db.tenantConfig.create({
          data: { tenantId, ...datosBase, puntoVenta: datosBase.puntoVenta ?? 1, numeroFactura },
        });
      }
    } else {
      await db.tenantConfig.upsert({
        where: { tenantId },
        create: { tenantId, ...datosBase, puntoVenta: datosBase.puntoVenta ?? 1 },
        update: datosBase,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('PUT /api/configuracion/fiscal:', error);
    return NextResponse.json({ error: 'Error al guardar datos fiscales' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { queSeVende, guardarQueSeVende, type Eleccion } from '@/lib/channex/sync';
import { permisoCanales, respuestaDeError } from '@/lib/channex/permiso';
import { checkBodySize } from '@/lib/validation';

// GET /api/canales-venta/que-se-vende — Tipos de habitación y tarifas, y cuáles se venden.
export async function GET(req: NextRequest) {
  try {
    const tenantId = await permisoCanales(req, false);
    return NextResponse.json(await queSeVende(tenantId));
  } catch (error) {
    return respuestaDeError(error, 'canales-venta/que-se-vende GET');
  }
}

// PUT /api/canales-venta/que-se-vende — Guarda lo elegido, lo crea en Channex y manda todo.
export async function PUT(req: NextRequest) {
  try {
    checkBodySize(req);
    const tenantId = await permisoCanales(req, true);
    const body = await req.json().catch(() => ({})) as Partial<Eleccion>;
    const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
    const tipos = Array.isArray(body.tipos)
      ? body.tipos.filter(t => t && esTexto(t.tipo) && typeof t.activo === 'boolean').slice(0, 200)
      : [];
    const tarifas = Array.isArray(body.tarifas)
      ? body.tarifas.filter(t => t && esTexto(t.tipo) && esTexto(t.tarifaId) && typeof t.activo === 'boolean').slice(0, 2000)
      : [];
    if (!tipos.some(t => t.activo)) {
      return NextResponse.json({ error: 'Elegí al menos un tipo de habitación para vender.' }, { status: 400 });
    }
    if (!tarifas.some(t => t.activo && tipos.some(x => x.activo && x.tipo === t.tipo))) {
      return NextResponse.json({ error: 'Elegí al menos una tarifa de un tipo que se vende.' }, { status: 400 });
    }
    await guardarQueSeVende(tenantId, { tipos, tarifas });
    return NextResponse.json(await queSeVende(tenantId));
  } catch (error) {
    return respuestaDeError(error, 'canales-venta/que-se-vende PUT');
  }
}

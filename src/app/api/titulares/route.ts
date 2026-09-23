import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission, tienePermiso, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import {
  PERMISO_CUENTA_CORRIENTE, PERMISOS_TITULAR, SELECT_TITULAR,
  leerDatosTitular, normalizarCuit, formatearCuit, vistaTitular,
} from '@/lib/cuenta-corriente';

// ─────────────────────────────────────────────────────────
// Titulares de cuenta corriente: empresas y personas que pagan después.
// Ver docs/cuenta-corriente.md.
//
// Buscar y cargar un titular lo puede hacer cualquiera con reservas, checkin,
// clientes o comprobantes: el recepcionista lo necesita para derivar una
// deuda, y la ficha del cliente para sus datos fiscales. Pero cuánto debe
// cada uno lo ve solo quien tiene PERMISO_CUENTA_CORRIENTE (ver vistaTitular).
//
// Montos en centavos, igual que Pago.monto.
// ─────────────────────────────────────────────────────────

/**
 * Lo que debe cada titular de la lista. Dos consultas agrupadas para toda la
 * lista, no dos por titular.
 */
async function saldosDe(tenantId: string, ids: string[]): Promise<Map<string, number>> {
  const saldos = new Map<string, number>();
  if (ids.length === 0) return saldos;
  const [cargos, pagos] = await Promise.all([
    db.cargoCuentaCorriente.groupBy({ by: ['titularId'], where: { tenantId, titularId: { in: ids } }, _sum: { monto: true } }),
    db.pagoCuentaCorriente.groupBy({ by: ['titularId'], where: { tenantId, titularId: { in: ids } }, _sum: { monto: true } }),
  ]);
  for (const c of cargos) saldos.set(c.titularId, (saldos.get(c.titularId) ?? 0) + (c._sum.monto ?? 0));
  for (const p of pagos) saldos.set(p.titularId, (saldos.get(p.titularId) ?? 0) - (p._sum.monto ?? 0));
  return saldos;
}

// ─────────────────────────────────────────────────────────
// GET /api/titulares
//   ?q=          busca por nombre o por CUIT (con o sin guiones)
//   ?clienteId=  el titular de la ficha de ese cliente (sus datos fiscales)
//   ?incluirInactivos=1   solo con PERMISO_CUENTA_CORRIENTE
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const ctx = await requirePermission(PERMISOS_TITULAR);
    const { tenantId } = ctx;
    const completo = tienePermiso(ctx, PERMISO_CUENTA_CORRIENTE);
    const { searchParams } = req.nextUrl;

    const q = searchParams.get('q')?.trim() || '';
    const clienteId = searchParams.get('clienteId');
    const incluirInactivos = completo && searchParams.get('incluirInactivos') === '1';

    const where: Prisma.TitularCuentaWhereInput = { tenantId };
    if (clienteId) {
      // La ficha del cliente muestra sus datos fiscales aunque el titular
      // esté desactivado: siguen siendo sus datos.
      where.clienteId = clienteId;
    } else if (!incluirInactivos) {
      // Para derivar solo sirven los activos.
      where.activo = true;
    }
    if (q) {
      // OJO: si q no tiene números, normalizarCuit da '' y "contiene ''"
      // matchea todo. Por eso el CUIT se busca solo si hay dígitos.
      const digitos = normalizarCuit(q);
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        ...(digitos ? [{ cuit: { contains: digitos } }] : []),
      ];
    }

    const titulares = await db.titularCuenta.findMany({
      where,
      select: SELECT_TITULAR,
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      take: 200,
    });

    const saldos = completo ? await saldosDe(tenantId, titulares.map(t => t.id)) : new Map<string, number>();

    return NextResponse.json({
      // Para que la pantalla sepa si puede mostrar saldos sin adivinarlo.
      completo,
      titulares: titulares.map(t => vistaTitular(t, completo, saldos.get(t.id) ?? 0)),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET titulares:', error);
    return NextResponse.json({ error: 'Error al buscar titulares' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/titulares — Alta de un titular
// Body: { tipo, nombre, cuit, condicionIva?, domicilioFiscal?, contacto*?,
//         limiteCredito? (solo PERMISO_CUENTA_CORRIENTE), clienteId? (solo persona) }
// ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ctx = await requirePermission(PERMISOS_TITULAR);
    const { tenantId, actorId, nombre: actorNombre } = ctx;
    const completo = tienePermiso(ctx, PERMISO_CUENTA_CORRIENTE);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const leido = leerDatosTitular(body);
    if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 });
    const { datos } = leido;

    if (!datos.tipo) return NextResponse.json({ error: 'Falta el tipo: empresa o persona.' }, { status: 400 });
    if (!datos.nombre) return NextResponse.json({ error: 'Falta el nombre o la razón social.' }, { status: 400 });
    if (!datos.cuit) return NextResponse.json({ error: 'Falta el CUIT.' }, { status: 400 });

    // Hasta cuánto puede deber alguien es una decisión de quien maneja la
    // cuenta corriente, no del mostrador. Se rechaza en vez de ignorarlo en
    // silencio: si no, el que lo cargó cree que quedó puesto.
    if (datos.limiteCredito != null && !completo) {
      return NextResponse.json({ error: 'El límite de crédito lo fija quien maneja la cuenta corriente.' }, { status: 403 });
    }

    // La ficha del cliente: solo para personas, y tiene que ser de este hotel.
    let clienteId: string | null = null;
    if (body.clienteId) {
      if (datos.tipo !== 'persona') {
        return NextResponse.json({ error: 'Solo una persona se engancha a la ficha de un cliente.' }, { status: 400 });
      }
      const cliente = await db.cliente.findFirst({
        where: { id: String(body.clienteId), tenantId },
        select: { id: true, titularCuenta: { select: { nombre: true } } },
      });
      if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
      if (cliente.titularCuenta) {
        return NextResponse.json({ error: 'Ese cliente ya tiene sus datos fiscales cargados.' }, { status: 409 });
      }
      clienteId = cliente.id;
    }

    // Un CUIT por hotel. Se chequea antes para dar un mensaje que sirva
    // ("ya está cargado como X"); el índice único igual lo frena si dos
    // altas llegan a la vez.
    const existente = await db.titularCuenta.findUnique({
      where: { tenantId_cuit: { tenantId, cuit: datos.cuit } },
      select: { nombre: true, activo: true },
    });
    if (existente) {
      return NextResponse.json({
        error: `Ese CUIT ya está cargado como "${existente.nombre}"${existente.activo ? '' : ' (desactivado)'}.`,
      }, { status: 409 });
    }

    let creado;
    try {
      creado = await db.titularCuenta.create({
        data: {
          tenantId,
          tipo: datos.tipo,
          nombre: datos.nombre,
          cuit: datos.cuit,
          condicionIva: datos.condicionIva ?? null,
          domicilioFiscal: datos.domicilioFiscal ?? null,
          contactoNombre: datos.contactoNombre ?? null,
          contactoTelefono: datos.contactoTelefono ?? null,
          contactoEmail: datos.contactoEmail ?? null,
          limiteCredito: datos.limiteCredito ?? null,
          clienteId,
        },
        select: SELECT_TITULAR,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Ese CUIT (o ese cliente) ya tiene un titular cargado.' }, { status: 409 });
      }
      throw error;
    }

    await auditar(db, {
      tenantId,
      tipo: TIPO.CUENTA_CORRIENTE,
      detalle: `Alta de ${creado.tipo === 'empresa' ? 'la empresa' : 'la persona'} ${creado.nombre} (CUIT ${formatearCuit(creado.cuit)})`,
      actor: { id: actorId, nombre: actorNombre },
    });

    return NextResponse.json(vistaTitular(creado, completo, 0), { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST titulares:', error);
    return NextResponse.json({ error: 'Error al cargar el titular' }, { status: 500 });
  }
}

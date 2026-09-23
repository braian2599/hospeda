import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requirePermission, tienePermiso, AuthError } from '@/lib/auth/utils';
import { auditar, TIPO } from '@/lib/auditoria';
import {
  PERMISO_CUENTA_CORRIENTE, PERMISOS_TITULAR, SELECT_TITULAR,
  leerDatosTitular, formatearCuit, vistaTitular, saldo, estadoDeCuenta, pesos,
} from '@/lib/cuenta-corriente';

// ─────────────────────────────────────────────────────────
// GET /api/titulares/[id] — El estado de cuenta de un titular
//
// Solo PERMISO_CUENTA_CORRIENTE: es exactamente "cuánto debe y de qué".
// Montos en centavos.
// ─────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { tenantId } = await requirePermission(PERMISO_CUENTA_CORRIENTE);
    const { id } = await params;

    const titular = await db.titularCuenta.findFirst({
      where: { id, tenantId },
      select: {
        ...SELECT_TITULAR,
        cargos: {
          select: {
            id: true, monto: true, concepto: true, fecha: true, empleadoNombre: true,
            reserva: { select: { id: true, huesped: true, habitacion: true, checkin: true, checkout: true } },
          },
          orderBy: { fecha: 'asc' },
        },
        pagos: {
          select: {
            id: true, monto: true, metodo: true, nota: true, fecha: true, empleadoNombre: true,
            movimientoCaja: { select: { turno: { select: { estado: true } } } },
          },
          orderBy: { fecha: 'asc' },
        },
      },
    });
    if (!titular) return NextResponse.json({ error: 'Titular no encontrado' }, { status: 404 });

    const deuda = saldo(titular.cargos, titular.pagos);

    return NextResponse.json({
      titular: vistaTitular(titular, true, deuda),
      cargos: titular.cargos,
      pagos: titular.pagos.map(p => ({
        id: p.id, monto: p.monto, metodo: p.metodo, nota: p.nota, fecha: p.fecha, empleadoNombre: p.empleadoNombre,
        // Un cobro se puede anular mientras el turno de caja en que entró
        // siga abierto. Cerrado el turno, esa plata ya se contó.
        anulable: !p.movimientoCaja || p.movimientoCaja.turno.estado === 'abierta',
      })),
      movimientos: estadoDeCuenta(titular.cargos, titular.pagos),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET titulares/[id]:', error);
    return NextResponse.json({ error: 'Error al obtener el estado de cuenta' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────
// PUT /api/titulares/[id] — Editar un titular
//
// Los datos para identificarlo y facturarle los puede corregir cualquiera
// que pueda cargarlo. El límite de crédito y desactivarlo, solo quien tiene
// PERMISO_CUENTA_CORRIENTE.
//
// El CUIT y el tipo se pueden corregir SOLO mientras no tenga movimientos:
// después, cambiarlos sería cambiarle el dueño a una deuda ya anotada. Si
// estaba mal, se desactiva y se carga uno nuevo.
// ─────────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requirePermission(PERMISOS_TITULAR);
    const { tenantId, actorId, nombre: actorNombre } = ctx;
    const completo = tienePermiso(ctx, PERMISO_CUENTA_CORRIENTE);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const leido = leerDatosTitular(body);
    if ('error' in leido) return NextResponse.json({ error: leido.error }, { status: 400 });
    const { datos } = leido;

    if ((datos.limiteCredito !== undefined || datos.activo !== undefined) && !completo) {
      return NextResponse.json({ error: 'El límite de crédito y la baja los maneja quien lleva la cuenta corriente.' }, { status: 403 });
    }

    const actual = await db.titularCuenta.findFirst({
      where: { id, tenantId },
      select: { ...SELECT_TITULAR, _count: { select: { cargos: true, pagos: true } } },
    });
    if (!actual) return NextResponse.json({ error: 'Titular no encontrado' }, { status: 404 });

    const cambiaCuit = datos.cuit !== undefined && datos.cuit !== actual.cuit;
    const cambiaTipo = datos.tipo !== undefined && datos.tipo !== actual.tipo;
    if ((cambiaCuit || cambiaTipo) && (actual._count.cargos > 0 || actual._count.pagos > 0)) {
      return NextResponse.json({
        error: 'Ya tiene movimientos en su cuenta: el CUIT y el tipo no se pueden cambiar. Si estaban mal, desactivalo y cargá uno nuevo.',
      }, { status: 409 });
    }
    if (cambiaTipo && datos.tipo === 'empresa' && actual.clienteId) {
      return NextResponse.json({ error: 'Está enganchado a la ficha de un cliente: no puede pasar a ser empresa.' }, { status: 400 });
    }

    const data: Prisma.TitularCuentaUpdateInput = {};
    if (datos.tipo !== undefined) data.tipo = datos.tipo;
    if (datos.nombre !== undefined) data.nombre = datos.nombre;
    if (datos.cuit !== undefined) data.cuit = datos.cuit;
    if (datos.condicionIva !== undefined) data.condicionIva = datos.condicionIva;
    if (datos.domicilioFiscal !== undefined) data.domicilioFiscal = datos.domicilioFiscal;
    if (datos.contactoNombre !== undefined) data.contactoNombre = datos.contactoNombre;
    if (datos.contactoTelefono !== undefined) data.contactoTelefono = datos.contactoTelefono;
    if (datos.contactoEmail !== undefined) data.contactoEmail = datos.contactoEmail;
    if (datos.limiteCredito !== undefined) data.limiteCredito = datos.limiteCredito;
    if (datos.activo !== undefined) data.activo = datos.activo;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No hay nada para cambiar' }, { status: 400 });
    }

    let editado;
    try {
      editado = await db.titularCuenta.update({ where: { id }, data, select: SELECT_TITULAR });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Ese CUIT ya está cargado en otro titular.' }, { status: 409 });
      }
      throw error;
    }

    // Lo que cambió, dicho para el que lee la auditoría.
    const cambios: string[] = [];
    if (cambiaCuit) cambios.push(`CUIT ${formatearCuit(actual.cuit)} → ${formatearCuit(editado.cuit)}`);
    if (cambiaTipo) cambios.push(`pasa a ser ${editado.tipo}`);
    if (datos.nombre !== undefined && datos.nombre !== actual.nombre) cambios.push(`nombre "${actual.nombre}" → "${editado.nombre}"`);
    if (datos.condicionIva !== undefined && datos.condicionIva !== actual.condicionIva) cambios.push(`IVA: ${editado.condicionIva ?? 'sin dato'}`);
    if (datos.limiteCredito !== undefined && datos.limiteCredito !== actual.limiteCredito) {
      cambios.push(`límite de crédito: ${editado.limiteCredito == null ? 'sin límite' : pesos(editado.limiteCredito)}`);
    }
    if (datos.activo !== undefined && datos.activo !== actual.activo) cambios.push(editado.activo ? 'reactivado' : 'desactivado');
    if (cambios.length === 0) cambios.push('datos de contacto o domicilio');

    await auditar(db, {
      tenantId,
      tipo: TIPO.CUENTA_CORRIENTE,
      detalle: `${editado.nombre}: ${cambios.join(', ')}`,
      actor: { id: actorId, nombre: actorNombre },
    });

    // El saldo solo se calcula si esta persona lo puede ver.
    let deuda = 0;
    if (completo) {
      const [c, p] = await Promise.all([
        db.cargoCuentaCorriente.aggregate({ where: { titularId: id }, _sum: { monto: true } }),
        db.pagoCuentaCorriente.aggregate({ where: { titularId: id }, _sum: { monto: true } }),
      ]);
      deuda = (c._sum.monto ?? 0) - (p._sum.monto ?? 0);
    }

    return NextResponse.json(vistaTitular(editado, completo, deuda));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PUT titulares/[id]:', error);
    return NextResponse.json({ error: 'Error al editar el titular' }, { status: 500 });
  }
}

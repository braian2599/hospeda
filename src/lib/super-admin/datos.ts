// ==================== DATOS COMPARTIDOS DEL SUPER ADMIN ====================
// Consultas que usan varias pantallas del Super Admin (Dashboard, Cuentas,
// Pagos, Configuración y el contador del menú), para que todas cuenten igual.

import { db } from '@/lib/db';
import { proximoDiez } from '@/lib/ciclo-cobro';
import { getMPAccessToken, getMPWebhookSecret } from '@/lib/payments/config';
import { delegacionesPendientes } from '@/lib/afip/delegacion';
import { PREFIJO_TICKET_HOSPEDA } from '@/lib/afip/wsaa';
import { estadoDeHotel, type EstadoHotel } from './estado-hotel';
import { estadoDeConfig, type EstadoConfig } from './estado-config';

const DIA_MS = 86_400_000;

/** Todos los hoteles con lo justo para saber en qué estado están. */
export async function hotelesConEstado(ahora: Date = new Date()) {
  const tenants = await db.tenant.findMany({
    select: {
      id: true, nombre: true, email: true, activo: true, createdAt: true,
      subscription: {
        select: {
          estado: true, origen: true, fechaVencimiento: true, esRecurrente: true,
          mpPreapprovalId: true, proximoCobro: true,
          plan: { select: { id: true, nombre: true, type: true, precioMensual: true } },
        },
      },
    },
  });
  return tenants.map(t => ({
    ...t,
    estado: estadoDeHotel({ activo: t.activo, suscripcion: t.subscription }, ahora) as EstadoHotel,
  }));
}

/**
 * Lo que se va a cobrar el próximo día 10 por débito automático (en centavos).
 * Es una estimación: el monto real lo tiene Mercado Pago. Se usa el precio
 * del plan, o el anterior si el cambio de precio todavía no llegó a ese 10.
 */
export async function cobroDelProximoDiez(ahora: Date = new Date()) {
  const diez = proximoDiez(ahora);
  const subs = await db.subscription.findMany({
    where: {
      esRecurrente: true,
      mpPreapprovalId: { not: null },
      estado: { in: ['activa', 'trial', 'pendiente_pago', 'suspensa'] },
      // Solo los que ese 10 terminan lo que tienen pago (los que siguen en
      // prueba o con una cortesía más larga todavía no pagan).
      fechaVencimiento: { lte: new Date(diez.getTime() + DIA_MS) },
      tenant: { activo: true },
    },
    select: {
      plan: { select: { precioMensual: true, precioAnteriorMensual: true, cambioPrecioDesde: true } },
    },
  });
  let total = 0;
  for (const s of subs) {
    const p = s.plan;
    const usaNuevo = !p.cambioPrecioDesde || p.cambioPrecioDesde.getTime() <= diez.getTime() || p.precioAnteriorMensual == null;
    total += usaNuevo ? p.precioMensual : p.precioAnteriorMensual!;
  }
  return { fecha: diez.toISOString(), total, cantidad: subs.length };
}

/** Estado de cada grupo de Configuración. */
export async function leerEstadoConfig(): Promise<EstadoConfig> {
  const [filas, token, secreto] = await Promise.all([
    db.platformConfig.findMany({ select: { key: true, value: true } }),
    getMPAccessToken(),
    getMPWebhookSecret(),
  ]);
  const valores: Record<string, string> = {};
  for (const f of filas) {
    if (!f.key.startsWith(PREFIJO_TICKET_HOSPEDA)) valores[f.key] = f.value;
  }
  return estadoDeConfig({ tieneToken: !!token, tieneSecreto: !!secreto, valores });
}

/** Números del menú: cosas para resolver y grupos de Configuración incompletos. */
export async function avisosDelMenu() {
  const [hoteles, delegaciones, config] = await Promise.all([
    hotelesConEstado(),
    delegacionesPendientes().catch(() => []),
    leerEstadoConfig(),
  ]);
  return {
    paraResolver: hoteles.filter(h => h.estado.paraResolver).length + delegaciones.length,
    configIncompleta: config.incompletos,
  };
}

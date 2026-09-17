// ==================== LO QUE HOSPI SABE DE ESTE HOTEL ====================
// Hasta acá el asistente no sabía NADA del hotel, y se notaba:
//
//   "¿Por qué no veo Reportes?"  → "Fijate en la página de Precios."
//
// Podía contestar "tu plan no incluye Reportes" y no lo hacía. Peor: a una
// persona de recepción le explicaba paso a paso cómo dar de alta un usuario,
// y recién al final chocaba con que no tiene el permiso.
//
// ── POR QUÉ NO SE CONSULTA LA BASE DE DATOS ──
// Una consulta a Postgres por cada pregunta al asistente mantendría la base
// despierta todo el día. Neon cobra por tiempo despierto y suspende recién a
// los 5 minutos de inactividad, así que una sola consulta suelta cuesta 5
// minutos. Con el hotel preguntando durante la jornada, eso es la diferencia
// entre una base que duerme y una que no duerme nunca.
//
// ── ENTONCES DE DÓNDE SALEN LOS DATOS ──
// El ROL sale del JWT: es del servidor, no se puede falsear.
//
// El plan y los módulos los manda la pantalla, pero NO se usan como texto:
// se validan contra las listas cerradas del sistema (los tipos de plan que
// existen, los módulos que existen) y lo que no está en la lista se descarta.
// Por eso nada de lo que mande el navegador puede terminar escrito en el
// prompt: entra un identificador conocido, o no entra nada.
//
// El peor caso si alguien falsea su plan desde el navegador es que Hospi le
// describa a esa persona un plan que no tiene. No abre ninguna puerta: los
// módulos y las integraciones los sigue controlando el servidor, acá y en
// todos los demás endpoints.

import { PLANES, type PlanTipo } from '@/lib/plan-config';
import { MODULOS_SISTEMA, type ModuloId } from '@/lib/types';
import { nombreDeModulo } from './sugerencias';

/** Los roles del sistema (enum RolTenant en prisma/schema.prisma). */
const NOMBRE_DE_ROL: Record<string, string> = {
  owner: 'dueño',
  admin: 'administrador',
  recepcion: 'recepción',
  limpieza: 'limpieza',
};

/** Solo administran el hotel estos dos. */
const ADMINISTRAN = new Set(['owner', 'admin']);

const IDS_DE_MODULO = new Set<string>([...MODULOS_SISTEMA.map(m => m.id), 'configuracion']);

function planValido(crudo: unknown): PlanTipo | null {
  return typeof crudo === 'string' && crudo in PLANES ? (crudo as PlanTipo) : null;
}

function rolValido(crudo: unknown): string | null {
  return typeof crudo === 'string' && crudo in NOMBRE_DE_ROL ? crudo : null;
}

/**
 * Filtra la lista de módulos contra los que existen de verdad.
 *
 * Se descarta lo desconocido en vez de rechazar todo: si mañana se agrega un
 * módulo y una pestaña vieja todavía manda la lista sin él, el asistente
 * sigue funcionando con lo que sí reconoce.
 */
function modulosValidos(crudo: unknown): ModuloId[] {
  if (!Array.isArray(crudo)) return [];
  const vistos = new Set<string>();
  for (const m of crudo) {
    if (typeof m === 'string' && IDS_DE_MODULO.has(m)) vistos.add(m);
  }
  return MODULOS_SISTEMA.map(m => m.id).filter(id => vistos.has(id))
    .concat(vistos.has('configuracion') ? ['configuracion' as ModuloId] : []);
}

export interface DatosDelHotel {
  plan?: unknown;
  rol?: unknown;
  modulos?: unknown;
}

/**
 * El pedazo de prompt con lo que sabemos del hotel, o null si no sabemos nada.
 */
export function contextoDelHotel({ plan, rol, modulos }: DatosDelHotel): string | null {
  const elPlan = planValido(plan);
  const elRol = rolValido(rol);
  const visibles = modulosValidos(modulos);
  if (!elPlan && !elRol && visibles.length === 0) return null;

  const lineas: string[] = ['## Este hotel y quién está preguntando'];

  if (elPlan) lineas.push(`- Plan contratado: ${PLANES[elPlan].nombre}.`);
  if (elRol) lineas.push(`- Rol de quien pregunta: ${NOMBRE_DE_ROL[elRol]}.`);

  if (visibles.length > 0) {
    const nombres = visibles.map(m => nombreDeModulo(m));
    const faltan = [...MODULOS_SISTEMA.map(m => m.id), 'configuracion' as ModuloId]
      .filter(id => !visibles.includes(id))
      .map(id => nombreDeModulo(id));
    lineas.push(`- Módulos que esta persona tiene a la vista: ${nombres.join(', ')}.`);
    if (faltan.length > 0) lineas.push(`- Módulos que NO ve: ${faltan.join(', ')}.`);
  }

  lineas.push('');
  lineas.push('Cómo usar esto:');
  lineas.push('- Si pregunta por algo de un módulo que no ve, no le expliques cómo hacerlo: explicale por qué no lo ve. Puede ser por el plan contratado del hotel, o por los permisos de su rol.');
  lineas.push('- No inventes cuál de los dos motivos es. Si no lo podés distinguir con lo de arriba, decí las dos posibilidades.');

  if (elRol && !ADMINISTRAN.has(elRol)) {
    lineas.push('- Quien pregunta NO administra el hotel. Los cambios de plan, de usuarios y de configuración los hace el dueño o el administrador: mandale a pedírselo, no le expliques cómo hacerlo.');
  }

  lineas.push('- Esto es lo ÚNICO que sabés de este hotel. Sus reservas, habitaciones, tarifas, caja y números siguen sin estar a tu alcance: esas preguntas se contestan mandando a la pantalla que corresponde.');

  return lineas.join('\n');
}

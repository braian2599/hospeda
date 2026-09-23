// ==================== CUENTA CORRIENTE ====================
//
// Empresas y clientes habituales que se hospedan ahora y pagan después.
// Las decisiones están en docs/cuenta-corriente.md; acá están las reglas que
// usan las rutas, sin base de datos para poder probarlas solas.
//
// LAS DOS ACCIONES Y POR QUÉ NINGUNA ES UN "PAGO"
//   derivar → CargoCuentaCorriente. La deuda de la reserva pasa a la cuenta
//             del titular. No entró plata: no toca la caja.
//   cobrar  → PagoCuentaCorriente. El titular paga (todo o parte). Entró
//             plata: exige turno abierto y deja su espejo en la caja.
// /api/pagos no sirve para ninguna de las dos: mete todo en la caja y rechaza
// reservas con check-out, que es justo cuando se deriva.
//
// EL SALDO NO SE GUARDA. Es la suma de los cargos menos la suma de los pagos,
// calculada cada vez. Un total guardado se desincroniza; uno calculado no.

/**
 * El permiso de lo fiscal: la lista de titulares con lo que debe cada uno,
 * los estados de cuenta y el cobro. Es 'comprobantes' a propósito —ya es "lo
 * de ARCA, para algunos empleados"—; si algún día hace falta separar "ve
 * facturas" de "ve cuánto debe cada empresa", se cambia acá y en ningún otro
 * lado.
 */
export const PERMISO_CUENTA_CORRIENTE = 'comprobantes';

/**
 * Quién puede BUSCAR y CARGAR un titular. Cargar un CUIT no es un acto fiscal:
 * lo hace el recepcionista al derivar una deuda, o en la ficha del cliente.
 * Lo que ve sin PERMISO_CUENTA_CORRIENTE es solo el nombre y el CUIT, nunca
 * cuánto debe.
 */
export const PERMISOS_TITULAR = [PERMISO_CUENTA_CORRIENTE, 'reservas', 'checkin', 'clientes'];

/** Quién puede pasar el saldo de una reserva a cuenta corriente. */
export const PERMISOS_DERIVAR = ['reservas', 'checkin'];

/**
 * Las condiciones de IVA de quien RECIBE la factura. Son las mismas que ya
 * ofrece Comprobantes al emitir una nota: no se inventa un vocabulario nuevo.
 * Cuando llegue el padrón de ARCA (Fase CC-5), lo que devuelva se traduce a
 * una de estas.
 */
export const CONDICIONES_IVA = ['Responsable Inscripto', 'Monotributista', 'Exento', 'Consumidor Final'] as const;
export type CondicionIva = typeof CONDICIONES_IVA[number];

export function esCondicionIva(v: unknown): v is CondicionIva {
  return typeof v === 'string' && (CONDICIONES_IVA as readonly string[]).includes(v);
}

// ── Lo que llega en el body ──

/**
 * Un texto opcional del body, limpio.
 *   undefined → no vino (en un PUT: no se toca)
 *   null      → vino vacío (en un PUT: se borra)
 */
export function textoOpcional(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== 'string') return undefined;
  const limpio = v.trim().slice(0, max);
  return limpio || null;
}

export interface DatosTitular {
  tipo?: 'empresa' | 'persona';
  nombre?: string;
  cuit?: string;
  condicionIva?: CondicionIva | null;
  domicilioFiscal?: string | null;
  contactoNombre?: string | null;
  contactoTelefono?: string | null;
  contactoEmail?: string | null;
  limiteCredito?: number | null;
  activo?: boolean;
}

/**
 * Lee y valida los datos de un titular que llegan en el body. Lo usan el alta
 * y la edición, para que las dos validen exactamente igual.
 *
 * Lo que no vino queda undefined (en una edición: no se toca). Que falte lo
 * obligatorio del alta lo chequea el alta, no esto.
 */
export function leerDatosTitular(body: Record<string, unknown>): { datos: DatosTitular } | { error: string } {
  const datos: DatosTitular = {};

  if (body.tipo !== undefined) {
    if (body.tipo !== 'empresa' && body.tipo !== 'persona') return { error: 'El tipo tiene que ser empresa o persona.' };
    datos.tipo = body.tipo;
  }

  if (body.nombre !== undefined) {
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim().slice(0, 200) : '';
    if (!nombre) return { error: 'Falta el nombre o la razón social.' };
    datos.nombre = nombre;
  }

  if (body.cuit !== undefined) {
    const error = validarCuit(typeof body.cuit === 'string' ? body.cuit : String(body.cuit ?? ''));
    if (error) return { error };
    datos.cuit = normalizarCuit(String(body.cuit));
  }

  if (body.condicionIva !== undefined) {
    if (body.condicionIva === null || body.condicionIva === '') datos.condicionIva = null;
    else if (esCondicionIva(body.condicionIva)) datos.condicionIva = body.condicionIva;
    else return { error: `La condición de IVA tiene que ser una de: ${CONDICIONES_IVA.join(', ')}.` };
  }

  datos.domicilioFiscal = textoOpcional(body.domicilioFiscal, 300);
  datos.contactoNombre = textoOpcional(body.contactoNombre, 200);
  datos.contactoTelefono = textoOpcional(body.contactoTelefono, 50);
  datos.contactoEmail = textoOpcional(body.contactoEmail, 200);
  if (datos.contactoEmail && !datos.contactoEmail.includes('@')) {
    return { error: 'El email de contacto no es válido.' };
  }

  if (body.limiteCredito !== undefined) {
    if (body.limiteCredito === null || body.limiteCredito === '') {
      datos.limiteCredito = null;
    } else {
      const n = Number(body.limiteCredito);
      if (!Number.isFinite(n) || n < 0) return { error: 'El límite de crédito tiene que ser un monto positivo.' };
      datos.limiteCredito = Math.round(n);
    }
  }

  if (body.activo !== undefined) {
    if (typeof body.activo !== 'boolean') return { error: 'activo tiene que ser verdadero o falso.' };
    datos.activo = body.activo;
  }

  return { datos };
}

// ── CUIT ──

/** Solo los dígitos. "30-71234567-8" → "30712345678". */
export function normalizarCuit(cuit: string): string {
  return (cuit || '').replace(/\D/g, '');
}

/** "30712345678" → "30-71234567-8". Si no tiene 11 dígitos, lo devuelve igual. */
export function formatearCuit(cuit: string): string {
  const d = normalizarCuit(cuit);
  if (d.length !== 11) return cuit;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

const PESOS_CUIT = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * null si el CUIT es válido; si no, por qué no lo es, dicho para el que lo
 * está cargando.
 *
 * Chequea el dígito verificador, el mismo cálculo que hace ARCA. No confirma
 * que el CUIT exista (eso es el padrón, Fase CC-5), pero agarra el error más
 * común: un dígito mal tipeado. Y ese error importa: el CUIT es lo único que
 * se le pide al titular, y con uno mal la factura sale a nombre de otro.
 *
 * NO se exige que una empresa empiece con 30 ni una persona con 20: un
 * unipersonal factura con el CUIT de la persona y se lo puede cargar como
 * empresa.
 */
export function validarCuit(cuit: string): string | null {
  const d = normalizarCuit(cuit);
  if (d.length !== 11) return 'El CUIT tiene que tener 11 números.';
  const digitos = d.split('').map(Number);
  const suma = PESOS_CUIT.reduce((acc, peso, i) => acc + peso * digitos[i], 0);
  const resto = 11 - (suma % 11);
  // 11 → 0. 10 no puede pasar en un CUIT real: ARCA cambia el prefijo
  // (a 23 o 33) justamente para que no pase.
  const verificador = resto === 11 ? 0 : resto;
  if (verificador === 10 || verificador !== digitos[10]) {
    return 'El CUIT no es válido: revisá que no haya un número mal tipeado.';
  }
  return null;
}

// ── Cargos ──

function diaMes(fecha: Date): string {
  // En UTC: las fechas de la reserva se guardan a medianoche UTC, y en hora
  // argentina el 15 a las 00:00 UTC es el 14 a la noche.
  const iso = fecha.toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * La línea del estado de cuenta, tal como queda anotada al derivar:
 * "Juan Pérez — Hab. 203 — 15/09 al 18/09/2026".
 *
 * Se guarda como texto y no se recalcula: es lo que se le anotó al titular.
 * Tiene el huésped porque el titular tiene que poder reconocer cada línea
 * ("¿quién es este y por qué me lo cobran?").
 */
export function conceptoDeCargo(reserva: {
  huesped: string;
  habitacion: string;
  checkin: Date;
  checkout: Date;
}): string {
  const anio = reserva.checkout.toISOString().slice(0, 4);
  return `${reserva.huesped} — Hab. ${reserva.habitacion} — ${diaMes(reserva.checkin)} al ${diaMes(reserva.checkout)}/${anio}`;
}

/**
 * Lo que queda por pagar de una reserva: el total menos lo que ya se cobró.
 * Es lo que se deriva, entero: "el que anota fiado anota todo".
 * null si la reserva no tiene total cargado: no se puede derivar lo que no
 * se sabe cuánto es.
 */
export function saldoDeReserva(total: number | null, pagos: readonly { monto: number }[]): number | null {
  if (total == null) return null;
  const pagado = pagos.reduce((s, p) => s + p.monto, 0);
  return total - pagado;
}

// ── Saldo y estado de cuenta ──

interface Movimiento {
  id: string;
  monto: number;
  fecha: Date;
}

/** Cargos menos pagos. En centavos. Positivo = el titular debe. */
export function saldo(cargos: readonly { monto: number }[], pagos: readonly { monto: number }[]): number {
  const debe = cargos.reduce((s, c) => s + c.monto, 0);
  const pago = pagos.reduce((s, p) => s + p.monto, 0);
  return debe - pago;
}

export interface LineaEstadoDeCuenta {
  id: string;
  tipo: 'cargo' | 'pago';
  fecha: Date;
  detalle: string;
  /** Centavos. Positivo en los cargos, negativo en los pagos. */
  importe: number;
  /** Lo que debía el titular después de esta línea. */
  saldo: number;
}

/**
 * Cargos y pagos mezclados en orden, con el saldo que quedaba después de
 * cada uno. Como el resumen de una tarjeta.
 *
 * Si un cargo y un pago tienen la misma fecha exacta, va primero el cargo:
 * no se puede pagar algo que todavía no se debía.
 */
export function estadoDeCuenta(
  cargos: readonly (Movimiento & { concepto: string })[],
  pagos: readonly (Movimiento & { metodo: string; nota: string })[],
): LineaEstadoDeCuenta[] {
  const lineas: Omit<LineaEstadoDeCuenta, 'saldo'>[] = [
    ...cargos.map(c => ({ id: c.id, tipo: 'cargo' as const, fecha: c.fecha, detalle: c.concepto, importe: c.monto })),
    ...pagos.map(p => ({
      id: p.id,
      tipo: 'pago' as const,
      fecha: p.fecha,
      detalle: p.nota ? `Pago (${p.metodo}) — ${p.nota}` : `Pago (${p.metodo})`,
      importe: -p.monto,
    })),
  ];

  lineas.sort((a, b) => {
    const t = a.fecha.getTime() - b.fecha.getTime();
    if (t !== 0) return t;
    if (a.tipo !== b.tipo) return a.tipo === 'cargo' ? -1 : 1;
    return 0;
  });

  let acumulado = 0;
  return lineas.map(l => {
    acumulado += l.importe;
    return { ...l, saldo: acumulado };
  });
}

/**
 * Si con esta deuda nueva el titular pasa su límite de crédito.
 *
 * SOLO INFORMA. Todavía no se decidió si el límite bloquea la derivación o
 * solo avisa (docs/cuenta-corriente.md, "Pendiente de decidir"), así que las
 * rutas lo devuelven para que la pantalla avise, y no frenan nada.
 */
export function superaLimite(saldoResultante: number, limiteCredito: number | null): boolean {
  return limiteCredito != null && saldoResultante > limiteCredito;
}

// ── Lo que devuelve la API ──

export interface TitularDeLaBase {
  id: string;
  tipo: string;
  nombre: string;
  cuit: string;
  condicionIva: string | null;
  domicilioFiscal: string | null;
  contactoNombre: string | null;
  contactoTelefono: string | null;
  contactoEmail: string | null;
  limiteCredito: number | null;
  clienteId: string | null;
  activo: boolean;
}

/** Los campos que se piden a la base para armar la vista. */
export const SELECT_TITULAR = {
  id: true, tipo: true, nombre: true, cuit: true, condicionIva: true, domicilioFiscal: true,
  contactoNombre: true, contactoTelefono: true, contactoEmail: true,
  limiteCredito: true, clienteId: true, activo: true,
} as const;

/**
 * Un titular como lo devuelve la API.
 *
 * QUIÉN VE QUÉ, en un solo lugar: los datos para identificarlo y facturarle
 * (nombre, CUIT, condición de IVA, contacto) los ve cualquiera que pueda
 * buscar titulares, porque los necesita para derivar una deuda o para la
 * ficha del cliente. Cuánto debe y hasta cuánto puede deber, SOLO quien tiene
 * PERMISO_CUENTA_CORRIENTE. Los montos van en centavos, igual que Pago.monto.
 */
export function vistaTitular(t: TitularDeLaBase, completo: boolean, saldoCentavos = 0) {
  const base = {
    id: t.id,
    tipo: t.tipo,
    nombre: t.nombre,
    cuit: t.cuit,
    cuitFormateado: formatearCuit(t.cuit),
    condicionIva: t.condicionIva,
    domicilioFiscal: t.domicilioFiscal,
    contactoNombre: t.contactoNombre,
    contactoTelefono: t.contactoTelefono,
    contactoEmail: t.contactoEmail,
    clienteId: t.clienteId,
    activo: t.activo,
  };
  if (!completo) return base;
  return {
    ...base,
    limiteCredito: t.limiteCredito,
    saldo: saldoCentavos,
    superaLimite: superaLimite(saldoCentavos, t.limiteCredito),
  };
}

// ── Para las pantallas ──

/**
 * Si esta persona maneja la cuenta corriente (ve saldos, cobra, fija el
 * límite). La misma regla que tienePermiso del servidor, para decidir qué
 * MOSTRAR; el permiso de verdad lo sigue chequeando la API.
 */
export function manejaCuentaCorriente(usuario: { rol?: string | null; permisos?: string[] | null } | null | undefined): boolean {
  if (!usuario) return false;
  if (usuario.rol === 'owner' || usuario.rol === 'admin') return true;
  return (usuario.permisos || []).includes(PERMISO_CUENTA_CORRIENTE);
}

/**
 * La API trabaja en centavos (como la base); el store y las pantallas, en
 * pesos. Se convierte SOLO con estas dos, en el borde, para que un monto no
 * termine cien veces más grande por haberse convertido dos veces.
 */
export const aPesos = (centavos: number): number => centavos / 100;
export const aCentavos = (pesos: number): number => Math.round(pesos * 100);

/** "$180.000" para la auditoría y los mensajes. Recibe centavos. */
export function pesos(centavos: number): string {
  return `$${(centavos / 100).toLocaleString('es-AR')}`;
}

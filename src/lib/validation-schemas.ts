import { z } from 'zod';

/**
 * Schemas de validación para los endpoints más críticos.
 *
 * Estos schemas se usan ANTES de las validaciones manuales existentes
 * (que se mantienen como fallback). Si Zod falla, se devuelve 400 con
 * el mensaje de error específico.
 *
 * Convenciones:
 * - Los campos opcionales llevan `.optional()` o vienen con default.
 * - Los strings que no deben exceder cierto largo llevan `.max(N)`.
 * - Los enums usan `z.enum([...])` para valores cerrados.
 * - Para passwords, replicamos las reglas de `validatePassword()` en regex
 *   (min 8, 1 mayúscula, 1 número) para que el schema sea self-contained.
 */

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  email: z.email('Email inválido'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-ZÁÉÍÓÚÑ]/, 'La contraseña debe tener al menos una letra mayúscula')
    .regex(/[0-9]/, 'La contraseña debe tener al menos un número'),
  name: z
    .string()
    .min(1, 'El nombre es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
  hotelNombre: z
    .string()
    .min(1, 'El nombre del hotel es obligatorio')
    .max(120, 'El nombre del hotel es demasiado largo'),
  phone: z.string().max(40, 'El teléfono es demasiado largo').optional(),
  acceptedTerms: z.literal(true, 'Debés aceptar los Términos y Condiciones y la Política de Privacidad'),
});

// ─────────────────────────────────────────────────────────────
// Login (CredentialsProvider)
// ─────────────────────────────────────────────────────────────
// No validamos complejidad: solo que estén presentes.
export const loginSchema = z.object({
  email: z.email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

// ─────────────────────────────────────────────────────────────
// POST /api/reservas
// ─────────────────────────────────────────────────────────────
// Validamos solo los campos críticos; el resto se valida en la ruta
// (disponibilidad de habitación, solapamiento de fechas, etc.).
const isoDateString = z.string().min(1, 'Fecha requerida');

export const createReservaSchema = z.object({
  clienteId: z.string().min(1).optional().nullable(),
  huesped: z
    .string()
    .min(1, 'El nombre del huésped es obligatorio')
    .max(120, 'El nombre del huésped es demasiado largo'),
  dni: z
    .string()
    .min(1, 'El DNI es obligatorio')
    .max(40, 'El DNI es demasiado largo'),
  telefono: z.string().max(40).optional(),
  email: z.string().max(120).optional().nullable(),
  domicilio: z.string().max(200).optional().nullable(),
  habitacion: z
    .string()
    .min(1, 'La habitación es obligatoria')
    .max(40, 'El número de habitación es demasiado largo'),
  checkin: isoDateString,
  checkout: isoDateString,
  personas: z.union([z.number(), z.string()]).optional(),
  ninos: z.union([z.number(), z.string()]).optional().nullable(),
  total: z.union([z.number(), z.string()]).optional().nullable(),
  tipoTarifa: z.string().max(60).optional().nullable(),
  metodoPagoId: z.string().max(100).optional().nullable(),
  cuotas: z.union([z.number(), z.string()]).optional().nullable(),
  recargoPorcentaje: z.union([z.number(), z.string()]).optional().nullable(),
  notas: z.string().max(2000).optional(),
  observacionesHuesped: z.string().max(2000).optional().nullable(),
  agenciaNombre: z.string().max(120).optional().nullable(),
  agenciaConvenio: z.string().max(120).optional().nullable(),
  agenciaVendedor: z.string().max(120).optional().nullable(),
  contactoEmergenciaNombre: z.string().max(120).optional().nullable(),
  contactoEmergenciaTel: z.string().max(40).optional().nullable(),
  acompanantes: z
    .array(
      z.object({
        nombre: z.string().min(1).max(120),
        dni: z.string().min(1).max(40),
        celular: z.string().max(40).optional(),
      })
    )
    .max(50, 'Demasiados acompañantes')
    .optional(),
  datosAdicionales: z.record(z.string(), z.unknown()).optional().nullable(),
});

// ─────────────────────────────────────────────────────────────
// POST /api/caja/movimiento
// ─────────────────────────────────────────────────────────────
export const cajaMovimientoSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso'], {
    message: 'El tipo debe ser "ingreso" o "egreso"',
  }),
  monto: z
    .union([z.number(), z.string()])
    .refine((v) => !isNaN(Number(v)), { message: 'El monto debe ser numérico' })
    .refine((v) => Number(v) > 0, { message: 'El monto debe ser positivo' }),
  descripcion: z
    .string()
    .min(1, 'La descripción es obligatoria')
    .max(500, 'La descripción es demasiado larga'),
  metodo: z.string().max(40).optional(),
  reservaId: z.string().max(100).optional().nullable(),
  categoriaGastoNombre: z.string().max(120).optional().nullable(),
});

/**
 * Formatea los errores de Zod en un mensaje único.
 * Devuelve solo el primer mensaje para mostrar al usuario.
 */
export function formatZodError(error: z.ZodError): string {
  const issues = error.issues;
  if (issues.length === 0) return 'Datos inválidos';
  const first = issues[0];
  return first.message || 'Datos inválidos';
}

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateReservaInput = z.infer<typeof createReservaSchema>;
export type CajaMovimientoInput = z.infer<typeof cajaMovimientoSchema>;

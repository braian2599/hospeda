// ==================== PAYMENT VALIDATION HELPERS ====================
// Funciones para validar que un pago recibido via webhook sea legítimo:
// - El monto pagado debe coincidir con el precio del plan
// - El plan solicitado debe existir y ser válido
// - Tolerancia de 1% para redondeos de MP (conversiones de centavos)

import { db } from '@/lib/db';
import type { PlanTipo } from '@/lib/plan-config';

export interface PaymentValidationResult {
  valid: boolean;
  reason?: string;
  plan?: { id: string; type: string; nombre: string; precioMensual: number };
}

/**
 * Valida que el monto pagado coincida con el precio del plan.
 * Permite una tolerancia del 1% para cubrir redondeos de conversión de moneda
 * (MP puede devolver el monto con decimales distintos a los centavos exactos).
 *
 * @param planTipo - Tipo de plan ('profesional', 'premium', 'elite')
 * @param amountPaidInCents - Monto pagado en CENTAVOS
 * @returns { valid, reason, plan }
 */
export async function validatePaymentAmount(
  planTipo: string,
  amountPaidInCents: number
): Promise<PaymentValidationResult> {
  // Validar que el planTipo sea válido (no permitir 'trial' ni 'basico', retirado de la venta)
  const VALID_PLAN_TYPES: PlanTipo[] = ['profesional', 'premium', 'elite'];
  if (!VALID_PLAN_TYPES.includes(planTipo as PlanTipo)) {
    return { valid: false, reason: `Tipo de plan inválido: ${planTipo}` };
  }

  // Buscar el plan en la BD
  const plan = await db.plan.findFirst({ where: { type: planTipo } });
  if (!plan) {
    return { valid: false, reason: `Plan no encontrado: ${planTipo}` };
  }

  // Validar monto mínimo (no se permiten pagos de $0 o negativos)
  if (!amountPaidInCents || amountPaidInCents <= 0) {
    return { valid: false, reason: `Monto pagado inválido: ${amountPaidInCents}`, plan: { id: plan.id, type: plan.type, nombre: plan.nombre, precioMensual: plan.precioMensual } };
  }

  // Tolerancia del 1% para redondeos
  const tolerance = Math.max(plan.precioMensual * 0.01, 100); // mínimo 1 peso de tolerancia
  const minAllowed = plan.precioMensual - tolerance;
  const maxAllowed = plan.precioMensual + tolerance;

  if (amountPaidInCents < minAllowed) {
    return {
      valid: false,
      reason: `Monto pagado insuficiente: $${(amountPaidInCents / 100).toLocaleString('es-AR')} — el plan ${plan.nombre} cuesta $${(plan.precioMensual / 100).toLocaleString('es-AR')}`,
      plan: { id: plan.id, type: plan.type, nombre: plan.nombre, precioMensual: plan.precioMensual },
    };
  }

  // Si pagó más del máximo, es sospechoso pero permitido (puede ser un error de MP)
  // — lo registramos en logs pero no bloqueamos
  if (amountPaidInCents > maxAllowed) {
    console.warn(`[payment-validation] Monto pagado superior al precio del plan: $${(amountPaidInCents / 100).toLocaleString('es-AR')} > $${(plan.precioMensual / 100).toLocaleString('es-AR')}`);
  }

  return {
    valid: true,
    plan: { id: plan.id, type: plan.type, nombre: plan.nombre, precioMensual: plan.precioMensual },
  };
}

/**
 * Valida que un preapproval de Mercado Pago tenga el monto correcto del plan.
 * Usado en handlePreapprovalEvent para validar suscripciones recurrentes.
 *
 * @param planTipo - Tipo de plan ('profesional', 'premium', 'elite')
 * @param transactionAmount - Monto del auto_recurring.transaction_amount (en pesos, NO centavos)
 * @returns { valid, reason, plan }
 */
export async function validatePreapprovalAmount(
  planTipo: string,
  transactionAmount: number
): Promise<PaymentValidationResult> {
  // MP usa decimales (pesos), no centavos — convertir
  const amountInCents = Math.round(transactionAmount * 100);
  return validatePaymentAmount(planTipo, amountInCents);
}

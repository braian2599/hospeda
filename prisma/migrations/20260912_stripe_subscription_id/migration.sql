-- ═════════════════════════════════════════════════════════════════════
-- MIGRACIÓN SEGURA: solo agrega una columna nueva (NULLABLE) + su índice
-- único. No modifica ni borra nada existente — no afecta a los hoteles
-- que usan Mercado Pago (que es el 100% de los actuales, Stripe todavía
-- no está configurado en esta instancia).
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

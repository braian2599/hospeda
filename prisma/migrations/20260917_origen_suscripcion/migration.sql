-- Origen de la suscripción: de dónde salió el plan que tiene cada hotel.
-- Por defecto 'cortesia' a propósito: si un camino nuevo se olvida de
-- setearlo, el sistema avisa de más en vez de prometer en silencio una
-- renovación automática que no existe.
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "origen" TEXT NOT NULL DEFAULT 'cortesia';

-- Backfill de lo que ya existe, de lo más general a lo más específico.

-- 1) Cuentas que todavía están en la prueba de 30 días.
UPDATE "Subscription" SET "origen" = 'trial'
 WHERE "estado" = 'trial';

-- 2) Pagos por transferencia que alguien registró a mano y que cubren un
--    período que todavía no terminó.
UPDATE "Subscription" s SET "origen" = 'transferencia'
 WHERE s."origen" = 'cortesia'
   AND EXISTS (
     SELECT 1 FROM "PlatformPayment" p
      WHERE p."tenantId" = s."tenantId"
        AND p."estado" = 'pagado'
        AND p."metodo" <> 'mercadopago'
        AND p."periodoHasta" >= NOW()
   );

-- 3) Cualquier rastro de Mercado Pago gana: suscripción recurrente, preapproval
--    o un pago único registrado por el webhook.
UPDATE "Subscription" SET "origen" = 'mercadopago'
 WHERE "esRecurrente" = true
    OR "mpPreapprovalId" IS NOT NULL
    OR "paymentProviderId" IS NOT NULL;

-- 4) Stripe.
UPDATE "Subscription" SET "origen" = 'stripe'
 WHERE "stripeSubscriptionId" IS NOT NULL;

-- Lo que quedó en 'cortesia' es exactamente eso: planes que dio la plataforma
-- sin que nadie pagara. Es el caso que hoy figuraba como "suscripto".

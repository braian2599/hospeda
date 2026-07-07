# Hospedá — Worklog

---
Task ID: 7
Agent: Main Agent
Task: Paso 7 — Integración de pagos con Mercado Pago y Stripe

Work Log:
- Explorado estado actual: schema (22 modelos, Subscription con paymentProviderId), plan-config.ts, TrialBanner, ModuleLockedDialog, landing page
- Instalados SDKs: mercadopago@3.2.0 y stripe@22.3.0
- Creados tipos TypeScript completos en src/lib/payments/types.ts (PaymentProvider, PaymentStatus, CheckoutRequest/Response, webhook payloads, metadata)
- Creada configuración centralizada en src/lib/payments/config.ts (MP + Stripe env vars, currency, grace period)
- Creados provider functions: src/lib/payments/mercadopago.ts (createMercadoPagoCheckout, getMercadoPagoPayment, verifySignature) y src/lib/payments/stripe.ts (createStripeCheckout, getStripeSession, verifyWebhook, cancelSubscription, createPortalSession)
- Creadas 4 API routes:
  - GET /api/payments/plans — Lista planes públicos (verificado con curl, devuelve JSON correcto)
  - POST /api/payments/create-checkout — Crea sesión MP o Stripe con validaciones
  - POST /api/payments/stripe/webhook — Maneja checkout.completed, invoice.payment_succeeded/failed, subscription.deleted
  - POST /api/payments/mercadopago/webhook — Maneja IPN con estados approved/pending/rejected/refunded/cancelled
  - GET /api/payments/status — Consulta estado de pago por sessionId
- Creados 4 UI components:
  - PlanCard.tsx — Card reutilizable con precio, límites, módulos, CTA (usado en landing y sidebar)
  - CheckoutDialog.tsx — Flow de 5 pasos: método de pago → email → processing → success → error
  - PaymentStatusBadge.tsx — Badge con icono según estado del pago
  - PlanIndicator.tsx — Dropdown en sidebar para ver plan actual y upgrade rápido
- Actualizada landing page: Plans section ahora usa PlanCard + CheckoutDialog (reemplazó HTML estático)
- Actualizado TrialBanner: ahora abre CheckoutDialog directamente (ya no redirige a /)
- Actualizado ModuleLockedDialog: botón "Suscribirme" abre CheckoutDialog con el plan recomendado
- Agregadas variables de entorno documentadas en .env (MERCADOPAGO_ACCESS_TOKEN, STRIPE keys, etc.)
- Verificación con browser: landing page renderiza correctamente, PlanCards visibles, CheckoutDialog se abre al hacer click en plan, muestra opciones MP y Stripe, email step funciona
- Sin errores de lint en los archivos nuevos

Stage Summary:
- Integración completa de pagos con Mercado Pago y Stripe (server + client)
- Flujo de checkout completo: selección de plan → método de pago → email → redirect al provider
- Webhooks preparados para ambos providers con handlers para los eventos principales
- UI integrada en landing page, trial banner y module locked dialog
- TODO para producción: configurar API keys reales, implementar verificación de firma MP, conectar actualización de DB en webhooks
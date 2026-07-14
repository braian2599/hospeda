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

---
Task ID: 8
Agent: Main Agent
Task: Fix 6 problemas post-deploy (Google OAuth, password recovery, setup hotel)

Work Log:
- Analizado error redirect_uri_mismatch: es configuración en Google Cloud Console
- Creado flujo completo de recuperación de contraseña:
  - API POST /api/auth/forgot-password (genera token, envía email)
  - API POST /api/auth/reset-password (valida token, cambia contraseña)
  - Página /forgot-password (form email → success)
  - Página /reset-password (nueva contraseña con confirmación → success)
  - Función sendPasswordResetEmail() en src/lib/email/index.ts
- Actualizado enlace "¿Olvidaste tu contraseña?" en LoginContent.tsx (ahora linkea a /forgot-password)
- Creado flujo setup-hotel para usuarios Google OAuth sin hotel:
  - API POST /api/auth/setup-hotel (crea Tenant + TenantUser + Subscription trial)
  - Página /setup-hotel (formulario simple: nombre del hotel)
  - Actualizado (app)/layout.tsx: SessionLoader redirige a /setup-hotel si needsSetup=true
- Mejorado manejo de errores OAuth: getErrorMessage() mapea códigos de error a mensajes claros en español
- Verificado: build exitoso, todas las rutas nuevas aparecen correctamente

Stage Summary:
- Problema 1 (Google en registro): Ya existía en el código, el botón está presente
- Problema 2 (Recuperar contraseña): Flujo completo implementado con páginas y APIs
- Problema 3 (Sistema no aparece post-Google login): Fix con redirección a /setup-hotel
- Problema 4 (Google OAuth redirect_uri_mismatch): Error de config en Google Cloud Console (instrucciones para el usuario)
- Problema 5 (Pagos): Pendiente explicación al usuario
- Problema 6 (Logo/colores): Pendiente imagen del usuario
---
Task ID: 8
Agent: Main Agent
Task: Configurar metodo de pago Mercado Pago — checkout, webhook, pagina de suscripcion

Work Log:
- Agregado campo Webhook Secret al SuperAdminConfig (UI + API)
- Creado SuscripcionModule: pagina completa con estado actual, 3 planes, transferencia bancaria
- Agregado boton "Suscripcion" en sidebar (desktop + mobile, owner-only)
- Simplificado CheckoutDialog: solo Mercado Pago, sin Stripe
- Corregido webhook: ahora usa getMPAccessToken() async desde BD, no solo env vars
- Agregada idempotencia al webhook: verifica si el pago ya fue procesado
- verifyMercadoPagoSignature ahora es async y lee secret desde BD
- Creado PaymentResultBanner: muestra notificacion al volver de MP (success/failure/pending)
- Simplificado create-checkout: solo MP, obtiene nombre del hotel de la BD
- Corregido subscription route: requireTenantId -> requireOwner

Stage Summary:
- Flujo de pago completo: owner ve planes -> click pagar -> MP checkout -> webhook activa suscripcion
- El webhook lee credenciales de PlatformConfig en BD (no solo env vars)
- Idempotencia previene pagos duplicados por reintentos de MP
- Transferencia bancaria como alternativa con datos de cuenta copiables
- Archivos nuevos: SuscripcionModule.tsx, PaymentResultBanner.tsx
- Archivos modificados: Sidebar.tsx, app/page.tsx, CheckoutDialog.tsx, mercadopago.ts, webhook/route.ts, create-checkout/route.ts, SuperAdminConfig.tsx, super-admin/config/route.ts, subscription/route.ts

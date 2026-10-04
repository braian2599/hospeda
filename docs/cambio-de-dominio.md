# Cambio al dominio www.mihospeda.com

Plan del cambio de `hospeda-delta.vercel.app` a `https://www.mihospeda.com`.
Fecha prevista: domingo 04/10/2026 a las 00:00 (Argentina), cuando nadie usa el sistema.

## Cómo quedó el dominio en Vercel

| Dirección | Qué hace |
|---|---|
| `www.mihospeda.com` | Principal: ahí abre el sistema. |
| `mihospeda.com` | Redirige (308) a `www`. |
| `hospeda-delta.vercel.app` | Sigue funcionando igual. **No borrarla ni redirigirla.** |

Siempre se usa `https://www.mihospeda.com` (con www): sin www hay una
redirección y Mercado Pago y Google no siempre la siguen (sobre todo los avisos).

La dirección vieja tiene que seguir andando porque quedó guardada afuera:
los calendarios iCal que los hoteles pegaron en Booking y Airbnb
(`/api/ical/...`), las señas ya pedidas por Mercado Pago (su
`notification_url`), el cron externo que llama a `/api/cron/expirar-reservas`
y los links a `/h/<hotel>` ya compartidos.

## Orden

Regla: **primero se agrega la dirección nueva afuera (sin sacar la vieja), recién
después se cambia Vercel.** Al revés, el inicio de sesión con Google y la
conexión de Mercado Pago de los hoteles fallan en el medio.

### 1. Servicios externos (agregar, no sacar)

1. **Google Cloud** → APIs y servicios → Credenciales → cliente OAuth:
   - Origen autorizado: `https://www.mihospeda.com`
   - URI de redirección: `https://www.mihospeda.com/api/auth/callback/google`
2. **Mercado Pago** → Tus integraciones → la aplicación:
   - Redirección (conectar Mercado Pago de los hoteles, para señas):
     `https://www.mihospeda.com/api/configuracion/mercadopago/callback`
   - Sitio de la aplicación (si tiene uno): `https://www.mihospeda.com`
     (el `back_url` de la suscripción tiene que coincidir).
   - Webhooks: `https://www.mihospeda.com/api/payments/mercadopago/webhook`,
     eventos "Pagos" y "Planes y suscripciones". Simular: tiene que dar 200.
3. **Cloudflare R2** → bucket → Settings → CORS policy: agregar
   `https://www.mihospeda.com` a los orígenes permitidos (las fotos y logos se
   suben directo desde el navegador).

### 2. Vercel (solo Production)

| Variable | Valor nuevo |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://www.mihospeda.com` |
| `NEXTAUTH_URL` | `https://www.mihospeda.com` |

Las demás variables no cambian. Después: **Redeploy** (`NEXT_PUBLIC_APP_URL`
se fija al compilar).

### 3. Código (commit listo, se sube junto con el paso 2)

`src/app/layout.tsx`, `src/app/sitemap.ts`, `public/robots.txt`,
`public/og-image.svg` y `public/og-image.png` decían `hospeda.com` (que no es
nuestro); pasan a `www.mihospeda.com`.

### 4. Probar (entrando por www.mihospeda.com)

1. Iniciar sesión con email y contraseña, y con Google.
2. Simular el webhook en Mercado Pago: 200 (confirmar en los registros de Vercel).
3. Subir una foto en Configuración.
4. Elegir un plan y llegar hasta la pantalla de pago de Mercado Pago (sin pagar).

Quien tenía la sesión abierta en la dirección vieja tiene que volver a iniciar
sesión en la nueva (cada dirección guarda su sesión).

## Después, sin apuro

- Cambiar la dirección en el cron externo de `expirar-reservas` (la vieja sigue andando).
- Google Cloud → Pantalla de consentimiento OAuth: agregar `mihospeda.com` como
  dominio autorizado y poner los links de inicio, `/privacidad` y `/terminos`
  con el dominio nuevo.

## Pendiente: emails con Resend (quedó esperando el dominio)

Configuración:
- En Resend agregar el dominio de envío (subdominio, p. ej. `mail.mihospeda.com`)
  y cargar sus registros (SPF, DKIM y DMARC) en el DNS de Vercel.
- Variable `RESEND_FROM_DOMAIN` en Vercel. `RESEND_API_KEY` ya está cargada.
- Hoy, como hay clave pero el dominio no está verificado, los emails que el
  sistema intenta mandar (verificación al registrarse) fallan sin avisar.
- Recibir emails en `soporte@mihospeda.com` necesita un reenvío aparte (Resend
  manda; para recibir hay que configurar un servicio de reenvío o casilla).

Emails a hacer:
1. ~~**Recuperar la contraseña.**~~ Hecho: la de la cuenta y la del perfil
   del dueño, por separado.
2. ~~**Verificar el email al registrarse.**~~ Hecho.
3. ~~**Suscripción.**~~ Hecho (04/10): débito activado, cobro aprobado
   (comprobante), cobro rechazado, fin de la prueba o cortesía, cambio de
   precio y débito cancelado. Ver `src/lib/payments/avisos-suscripcion.ts`.
   Necesita la tabla `EmailEnviado`
   (`prisma/migrations/20261004_email_enviado/migration.sql`).
4. ~~**Avisos de la plataforma.**~~ Hecho (04/10): Super Admin → Avisos
   (mantenimiento, novedad o importante; a todos o por plan; prueba antes de
   mandar; historial). Necesita la tabla `AvisoPlataforma`
   (`prisma/migrations/20261004_aviso_plataforma/migration.sql`).
5. ~~**Invitación a usuarios del hotel.**~~ No va (04/10): los perfiles del
   hotel entran siempre con el email de la cuenta del hotel, no con uno propio.
6. ~~**Reservas de la página web.**~~ Hecho (04/10): al huésped "reserva
   confirmada" (Mercado Pago o cuando el hotel confirma la seña) y "falta la
   seña" (cobro manual, solo con el botón de WhatsApp del hotel); al hotel
   "nueva reserva" (a confirmar o seña pagada). Ver `src/lib/avisos-reserva.ts`.
   El formulario de la web pide ahora WhatsApp con código de país y email
   obligatorios (`src/lib/telefono.ts`).

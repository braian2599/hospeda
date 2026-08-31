# Módulo: Configuración

Fuente: `src/components/configuracion/ConfiguracionModule.tsx`. Actualizar
este archivo cada vez que se toque. **Acceso exclusivo del owner** —
ningún otro rol puede entrar acá.

Navegación por secciones (sidebar/menú), no todas visibles siempre:

1. **Hotel Info**: nombre, email, teléfono, dirección, país, moneda, zona
   horaria, logo e imagen de portada.
2. **Fiscal**: CUIT/CUIL/RUT (con validación del dígito verificador),
   condición frente al IVA, punto de venta. La numeración de facturas que
   se ve acá es solo de referencia visual, no se aplica realmente todavía.
3. **Habitaciones**: solo un resumen de lectura (la carga real de
   habitaciones se hace en el módulo Habitaciones, no acá).
4. **Landing (Fotos)** — *solo visible si el plan incluye landing page
   pública (plan Elite)*: descripción del hotel, servicios, fotos
   generales y por habitación, precios públicos (requiere tener tarifas
   activas creadas primero), y una sección para agencias.
5. **Integraciones** — *solo visible si el hotel tiene activado el cobro
   con seña online o la sincronización con Booking/Airbnb*:
   - Cobro de seña: Mercado Pago (conectar cuenta) o manual (WhatsApp/email/instrucciones).
   - Sincronización iCal con Booking.com/Airbnb, por habitación y canal
     (ver detalle del estado real de esta integración: hoy es solo
     bloqueo de disponibilidad, no tiempo real).
6. **Cuenta y Contraseña**: datos de la cuenta y cambio de contraseña
   (mínimo 6 caracteres).
7. **Datos / Export**: descargar CSV de reservas, clientes, pagos, o un
   backup completo en JSON.
8. **Suscripción**: plan actual, uso vs límites del plan, comparativa de
   planes y pago (Mercado Pago o transferencia bancaria).
9. **Soporte**: formulario de contacto.

## Reglas importantes
- Es la única pantalla donde se cambia el plan contratado — si el dueño
  pregunta por qué no ve un módulo o función, la respuesta casi siempre
  está acá (Suscripción) o depende de si tiene el feature flag activo.
- Las secciones "Landing" e "Integraciones" no las controla el dueño desde
  cero: dependen de qué incluye su plan.

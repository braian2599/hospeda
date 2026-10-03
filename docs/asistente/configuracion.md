# Módulo: Configuración

Fuente: `src/components/configuracion/ConfiguracionModule.tsx`. Actualizar
este archivo cada vez que se toque. **Acceso exclusivo del owner** —
ningún otro rol puede entrar acá.

Navegación por secciones (sidebar/menú), no todas visibles siempre:

1. **Hotel Info**: nombre, email, teléfono, dirección, país, moneda, zona
   horaria, logo e imagen de portada.
2. **Facturación** (antes eran dos pestañas, "Fiscal" y "AFIP/ARCA"):
   arriba, los datos de quien factura, que salen en cada comprobante: CUIT
   (con validación del dígito verificador), razón social, condición frente
   al IVA, dirección fiscal y logo; el botón **"Traer de ARCA"** los completa
   con el CUIT. El punto de venta aparece solo si el hotel factura con ARCA.
   La numeración inicial queda escondida detrás de "¿Venías usando otro
   talonario?": solo la necesita quien viene de otro talonario. Abajo, si el
   plan incluye facturación con ARCA, la conexión con ARCA.
3. **Habitaciones**: solo un resumen de lectura (la carga real de
   habitaciones se hace en el módulo Habitaciones, no acá).
4. **Landing (Fotos)** — *solo visible si el plan incluye landing page
   pública (plan Elite)*: descripción del hotel, servicios, fotos
   generales y por habitación, precios (para cada tipo de habitación, una o
   varias tarifas, una por período; no deja guardar dos que valgan el mismo
   día y avisa si quedan días sin tarifa), promociones (salen las tarifas
   marcadas "Mostrar en la página web"), y una sección para agencias. Si
   algún tipo tiene días sin tarifa en la web, arriba de Configuración hay
   un aviso con "Revisar precios".
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
   planes y pago (Mercado Pago o transferencia bancaria). El débito
   automático de Mercado Pago cobra el día 10 de cada mes; el primer cobro
   es el primer 10 después de que termina la prueba (o lo que ya tiene pago);
   si un cobro falla hay 3 días de gracia (10, 11 y 12) y el 13 se bloquea.
   Reglas en `src/lib/ciclo-cobro.ts`; avisos de Mercado Pago y revisión
   diaria en `src/lib/payments/cobros-suscripcion.ts`.
9. **Soporte**: formulario de contacto.

## Reglas importantes
- Es la única pantalla donde se cambia el plan contratado — si el dueño
  pregunta por qué no ve un módulo o función, la respuesta casi siempre
  está acá (Suscripción) o depende de si tiene el feature flag activo.
- Las secciones "Landing" e "Integraciones" no las controla el dueño desde
  cero: dependen de qué incluye su plan.

# Canales de venta (Channex)

Booking.com, Airbnb, Expedia y otros se conectan por su API a través de
Channex (channel manager). No se usa iCal (se descartó el 04/10/2026).

Hoy funciona en **modo prueba**, contra el servidor de pruebas de Channex.

## Variables (en Vercel, nunca en el código)

- `CHANNEX_API_KEY`: la clave de la cuenta de Channex.
- `CHANNEX_API_URL`: `https://staging.channex.io/api/v1` (prueba) o
  `https://secure.channex.io/api/v1` (real). Mientras no sea `secure`, la
  pantalla dice "Modo prueba".

## Quién lo ve

La integración "Canales de venta" (`canalesVenta` en `feature-flags.ts`) se
prende por plan o por hotel desde Super Admin. Reemplazó a "Sincronización
Booking.com" y "Sincronización Airbnb" (la migración `20261004_channex` pasó
las dos a esta). Solo el dueño entra a Configuración → Canales de venta.

## Cómo funciona

Código en `src/lib/channex/`:

- `api.ts`: lo único que habla con Channex.
- `ari.ts` (puro): disponibilidad y precios por día, 500 días hacia adelante,
  y qué cambió desde el último envío.
- `sync.ts`: conectar el hotel, qué se vende y el envío de disponibilidad y
  precios. `avisarCambio(tenantId)` se llama después de cada cambio en
  reservas, habitaciones, mantenimiento y tarifas: manda solo lo que cambió,
  un envío por hotel a la vez (lock).
- `reservas.ts`: las reservas que llegan (nuevas, modificadas, canceladas).

Tablas: `ChannexConexion` (el hotel en Channex), `ChannexTipo` (tipo de
habitación = room type), `ChannexTarifa` (tarifa por tipo = rate plan) y
`ChannexReserva` (cada novedad recibida y qué se hizo).

### Reglas

- Ocupan lugar las reservas Confirmada, CheckIn y A confirmar (las de la web
  sin seña también, para no vender dos veces la misma habitación).
- No se venden: Fuera de servicio, Mantenimiento con "sacar de
  disponibilidad" (hasta su fecha), ni las habitaciones compartidas.
- Precio por grupo o por cama → un precio según cuántas personas; por
  habitación → un solo precio. Fuera de las fechas de la tarifa, cerrada.
- Una reserva que llega se ubica en la primera habitación libre del tipo. Si
  no hay, no se pisa nada: queda "Sin lugar" en Reservas recibidas y en la
  actividad del hotel.

### Cuándo entran las reservas

- Al momento: Channex avisa a `/api/public/channex/webhook?token=…` (el token
  es un secreto de cada hotel) y Hospi las lee de Channex.
- Botón "Buscar reservas nuevas" en Reservas recibidas.
- Una vez por día: `/api/cron/channex` (también suma el día nuevo al final de
  los 500).

## Falta para pasar a real

- Probar en el servidor de pruebas de Channex (reservas de prueba).
- Certificación de Channex y cambiar `CHANNEX_API_URL` a `secure`.
- Sacar lo que queda del iCal viejo (`CanalExterno`, `/api/integraciones/canales`,
  `/api/cron/ical-sync`).

# Channel manager (Booking.com / Airbnb)

## Estado actual

Sync vía iCal (`src/lib/ical.ts`, `src/lib/ical-sync.ts`, `CanalExterno` en Prisma):
solo disponibilidad (bloqueo de fechas), una URL por habitación y por canal, sin
tarifas ni push de reservas en tiempo real. Es el fallback mientras no haya
presupuesto para un channel manager con API.

Booking.com y Airbnb no dan acceso directo a la Connectivity/Partner API a un
PMS chico sin invitación (ver contexto de la conversación que originó este doc).
El camino viable es un agregador white-label que ya tiene esas partnerships.

## Decisión: Channex.io cuando haya presupuesto

Evaluado contra Rentals United, Su (ex Staah) y NextPax — Channex es el único
con precio público apto para reventa multi-tenant:

- Base: USD 130/mes + USD 7/mes por hotel con al menos un canal activo.
- Sin costo de setup, sin permanencia.
- REST API + webhooks: tarifas, disponibilidad y reservas en tiempo real
  para Booking.com, Airbnb, Expedia y 60+ canales más, con una sola integración.

Rentals United y Su son candidatos de segunda instancia si el volumen de
hoteles conectados crece mucho (piden cotización, no tienen precio público).
NextPax queda descartado por el piso de USD 250/mes.

## Dónde engancha en el código actual

`CanalExterno` ya está desacoplado del feature flag (`bookingSync` /
`airbnbSync` en `feature-flags.ts`) y no asume iCal en su forma pública —
la ruta `/api/integraciones/canales` habla en términos de "canal", no de
mecanismo de sync. Cuando haya presupuesto para Channex, la sync real
(`syncCanalExterno` en `ical-sync.ts`) se reemplaza por llamadas a la API de
Channex; el resto (flags, permisos por plan, UI de conexión) no debería
necesitar cambios grandes.

No se agregaron campos ni código para Channex todavía — no hay nada que
mapear sin una cuenta real, y hacerlo antes es código muerto.

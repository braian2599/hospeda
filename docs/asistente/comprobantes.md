# Módulo: Comprobantes

Fuente: `src/components/modules/ComprobantesModule.tsx`. Actualizar este
archivo cada vez que se toque. (Antes esta guía se llamaba `facturacion.md`
y describía un módulo "Facturación" que ya no existe.)

**Desde acá NO se factura.** Facturar, emitir presupuestos y notas de
crédito o débito es del módulo ARCA (ver `arca.md`), que tiene su propio
permiso. Arriba de todo hay un aviso: "Para facturar, andá al módulo ARCA".

Arriba, 4 tarjetas fijas: Total Pendiente, Cobrado Hoy, Cobros este Mes,
Promedio por Reserva. Debajo, 4 pestañas: **Cobros pendientes**, **Historial
de pagos**, **Comprobantes emitidos** y **Cuenta corriente**.

## Cobros pendientes
Las reservas con saldo pendiente (sin canceladas ni con check-out hecho),
con barra de progreso de pago. Por cada una: **"Cobrar"** (registrar un
pago) y ver el recibo o la cotización.

### Registrar un pago
- Monto (obligatorio, se precarga con el saldo pendiente).
- Método de pago (obligatorio).
- Nota (opcional).
- No se puede cobrar más que el saldo pendiente.
- **La caja tiene que estar abierta** (módulo Caja).

## Historial de pagos
Filtros: huésped/DNI/número de reserva, método, rango de fechas. Cada pago
muestra la fecha y la hora en que se cobró ("10:35 · hace 20 min"), el
huésped con su número de reserva (#0012), la habitación, el método, el
monto y el saldo de esa reserva. Las fechas son las de Argentina.

## Recibo / Cotización
Documento imprimible por reserva. Es "Recibo" con el check-out hecho, o
antes si la reserva ya está cobrada completa; si no, "Cotización". No tiene
botón para facturar: eso se hace en ARCA → Para facturar.

## Comprobantes emitidos
Solo para ver y descargar: facturas (las que tienen CAE de ARCA),
presupuestos y notas de crédito y débito. No se emite ni se anula nada acá.

## Cuenta corriente
Quién debe y cuánto (solo con el permiso Comprobantes). Por cada empresa:
estado de cuenta, **registrar un pago**, **anular un cobro** mal cargado
(mientras la caja en que entró siga abierta) y **anular un pase a cuenta
corriente** hecho por error (si la reserva no está facturada y la cuenta
todavía debe ese cargo entero; la reserva vuelve a tener su saldo).
Las empresas NO se cargan acá: se cargan en Clientes → Empresas (hay un
botón que lleva ahí).

## Reglas importantes
- Solo pasan a cuenta corriente las reservas con el check-out hecho y SIN
  NINGÚN PAGO; va el total entero. Si pagaron una seña, el resto se cobra.
- El límite de crédito de una empresa solo avisa: no frena nada.
- Todo cobro depende de que haya una caja abierta.
- Cada pago genera automáticamente un ingreso en Caja.

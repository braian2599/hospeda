# Módulo: Facturación

Fuente: `src/components/modules/FacturacionModule.tsx`. Actualizar este
archivo cada vez que se toque.

Arriba, 4 tarjetas fijas: Total Pendiente, Cobrado Hoy, Cobros este Mes,
Promedio por Reserva. Debajo, 2 pestañas: **Cobros pendientes** e
**Historial de pagos**.

## Cobros pendientes
Lista las reservas con saldo pendiente (excluye canceladas y ya
finalizadas), con barra de progreso de pago. Por cada una: botón
**"Cobrar"** (registrar un pago) y un botón para ver el recibo/cotización.

### Registrar un pago
- Monto (obligatorio, se precarga automáticamente con el saldo pendiente).
- Método de pago (obligatorio, de los configurados en Tarifas).
- Nota (opcional).
- No se puede cobrar más que el saldo pendiente.
- **La caja tiene que estar abierta** para poder registrar un cobro — si
  está cerrada, el sistema no deja avanzar y pide abrirla primero (módulo Caja).

## Historial de pagos
Filtros: huésped/DNI, método, rango de fechas. Lista todos los pagos
registrados con fecha, huésped, habitación, método, monto y saldo restante
de esa reserva.

## Recibo / Cotización
Se genera un documento imprimible por reserva. Antes del check-out se
titula "Cotización"; después del check-out, "Recibo de pago". **No es un
comprobante fiscal** (no tiene numeración legal ni CAE de ARCA/AFIP) — es
solo un documento interno.

## Reglas importantes
- El estado de pago de cada reserva (Pendiente / Parcial / Pagado) se
  recalcula solo, en base a los pagos registrados.
- Todo cobro depende de que haya una caja abierta (módulo Caja) — es la
  dependencia más importante a tener en cuenta si algo no deja cobrar.
- Cada pago genera automáticamente un movimiento de ingreso en Caja.

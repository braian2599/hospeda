# Módulo: Caja

Fuente: `src/components/modules/CajaModule.tsx`. Actualizar este archivo
cada vez que se toque.

## Si la caja está cerrada
Solo se puede "Abrir caja", indicando el monto inicial en efectivo
(obligatorio). Se muestra la fecha del último cierre, si existe.

## Si la caja está abierta
4 KPIs: Saldo Inicial, Ingresos Hoy, Egresos Hoy, Saldo Actual. Barra con
hora de apertura, cajero, y botón **"Cerrar caja"**.

### Registrar movimientos
Botones "Ingreso" y "Egreso": monto (obligatorio), método de pago
(default Efectivo), categoría de gasto (**obligatoria si es un egreso**),
descripción (opcional, se autogenera si se deja vacía). El sistema sugiere
una categoría automáticamente según palabras del texto escrito.

Los movimientos se pueden filtrar (tipo, método, categoría, fechas,
texto), y solo owner/admin pueden editar o eliminar uno ya cargado.

## Cerrar la caja (wizard de 4 pasos)
1. **Denominaciones**: conteo físico de billetes y monedas.
2. **Otros métodos**: confirmar/ajustar el total contado de cada método
   distinto a efectivo.
3. **Comparación vs sistema**: esperado vs contado, con la diferencia total.
4. **Resumen y cierre**: si la diferencia (a favor o en contra) supera
   $100, es **obligatorio** escribir una explicación de al menos 5
   caracteres — si no, no se puede cerrar el turno. Desde acá también se
   puede imprimir el comprobante de cierre.

## Reglas importantes
- El "saldo en efectivo" mostrado solo cuenta movimientos en efectivo; los
  demás métodos se controlan aparte en el paso 2 del cierre.
- No se puede abrir la caja si ya está abierta, ni cargar/editar/eliminar
  movimientos si está cerrada.
- Un egreso categorizado genera automáticamente un "Gasto" vinculado
  (visible en el módulo Reportes, pestaña Gastos).
- **Dependencia clave con Facturación**: si la caja está cerrada, no se
  pueden registrar cobros de reservas — hay que abrirla primero acá.

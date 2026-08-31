# Módulo: Reportes

Fuente: `src/components/modules/ReportesModule.tsx`. Actualizar este
archivo cada vez que se toque.

Filtro de fechas global arriba de todo (Desde/Hasta, o atajos "7d"/"30d"/"1a"),
con botones "Exportar CSV", "Exportar PDF" e "Imprimir" (el contenido
exportado depende de qué pestaña esté abierta). Debajo, KPIs generales
siempre visibles (Ingresos, Gastos, Ganancia Neta, Reservas, Ocupación,
ADR, RevPAR, Ticket Promedio) y 7 pestañas:

1. **Financiero**: ingresos diarios, desglose por método de pago, tabla de pagos.
2. **Gastos**: distribución por categoría, tabla de gastos, botón
   "Agregar" gasto (tipo, descripción y monto son obligatorios).
3. **Auditoría**: registro de acciones del sistema (check-ins, check-outs,
   pagos), filtrable por tipo/empleado/turno.
4. **Caja**: historial de turnos de caja cerrados, con detalle de apertura,
   cierre, saldo esperado vs contado y diferencia de cada uno.
5. **Habitaciones**: ocupación diaria, distribución por estado, tabla de
   habitaciones con % de ocupación.
6. **Clientes**: cliente destacado (mayor gasto), clientes frecuentes
   ordenados por gasto total, nuevos del mes.
7. **Empleados**: actividad por empleado (check-ins, check-outs, pagos,
   gastos, reservas gestionadas) — cruzando la lista de usuarios con el registro de auditoría.

## Cómo se calculan los indicadores clave
- **ADR** (tarifa promedio diaria) = ingresos totales ÷ noches vendidas.
- **RevPAR** (ingreso por habitación disponible) = ingresos totales ÷
  noches disponibles en el período (habitaciones × días).
- Las "noches vendidas" cuentan reservas que se superponen con el rango
  elegido (no solo las que arrancan adentro), recortadas a los límites del período.

## Reglas importantes
- Este módulo es de solo consulta/exportación — no se cargan datos
  operativos acá, salvo el alta rápida de un Gasto.
- Los gráficos vienen ocultos por defecto en celular (se pueden mostrar
  con un botón), y visibles por defecto en desktop.

# Módulo: Dashboard

Fuente: `src/components/modules/DashboardModule.tsx`. Actualizar este
archivo cada vez que se toque ese componente.

Es la pantalla de inicio ("Panel Ejecutivo"). No tiene pestañas, es todo
scroll vertical, de arriba a abajo:

1. **Header**: reloj en vivo y clima.
2. **4 tarjetas KPI**: Ocupación (%), Check-ins pendientes hoy, Check-outs
   pendientes hoy, Reservadas — con mini-gráficos de los últimos 7 días.
3. **Accesos rápidos**: "Nueva Reserva" (va a Reservas), "Check-in" (va a
   Check-in), "Abrir Caja" (va a Caja; dice "Ir a Caja" si la caja ya está
   abierta), "Ver Reportes" (va a Reportes). Cada botón aparece solo si la
   persona tiene ese módulo; si no tiene ninguno, la fila no se muestra.
   **Mientras no estabas**: lo que pasó en el hotel antes de que la persona
   entrara (o en las últimas 12 horas). Muestra los últimos 4 movimientos y
   un botón "Ver N más" para desplegar el resto. "Ocultar" pliega la tarjeta
   entera y se recuerda. Debajo, **Reservas de la web** si entraron reservas
   por la página del hotel.
4. **Calendario Gantt de Ocupación**: vista tipo diagrama de Gantt por
   habitación y día. Navegación con flechas semana anterior/siguiente,
   botón "Hoy", selector de rango "2 sem"/"1 mes", y toggle "Historial"
   (muestra/oculta reservas ya finalizadas). Click en una barra abre el
   detalle de esa reserva (huésped, fechas, tarifa, monto, saldo, menores).
5. **Actividad de hoy** (salidas y llegadas del día; la hora se muestra solo
   si está registrada, si no dice "Sale" o "Llega") y **Distribución por
   tipo de habitación** (barras por tipo), lado a lado.
6. **Estado de habitaciones**: grilla tipo heatmap con tooltip por habitación.
7. **Estado General** (contadores de limpieza/mantenimiento) y **Alertas
   Pendientes**: habitaciones para limpiar, en mantenimiento y caja abierta
   hace 8 horas o más. Los check-ins y check-outs del día NO van como
   alerta: están en las tarjetas del final. El botón "Ir" (a Habitaciones)
   aparece solo si la persona tiene ese módulo.
8. **Reservas online (landing)**: solo relevante si el hotel tiene la
   landing page activa (plan Elite). Cambia según cómo cobre la seña:
   - Cobro por Mercado Pago: muestra los próximos check-ins ya confirmados.
   - Cobro manual: muestra reservas "A confirmar", esperando que el
     personal confirme el pago de la seña a mano.
9. **Check-ins de hoy** y **Check-outs de hoy**: el botón de check-in
   redirige al módulo Check-in (no lo hace desde acá); el botón de
   check-out sí hace el check-out desde el Dashboard, pero antes pide
   confirmación y avisa si el huésped tiene saldo pendiente. Ambos botones
   aparecen solo si la persona tiene el permiso de Check-In/Out. Cada
   check-out muestra la habitación y la cantidad de noches.

## Reglas importantes
- Aparece una alerta si una caja lleva 8 horas o más abierta, con el nombre
  de quien la abrió.
- El Gantt distingue habitaciones "Compartida" (dormis/hostels): puede
  mostrar varias reservas simultáneas en la misma habitación con carriles
  separados.
- El Dashboard es de solo lectura/navegación, salvo el check-out rápido —
  para cargar o editar algo, siempre termina redirigiendo al módulo correspondiente.

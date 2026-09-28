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
4. **Calendario Gantt de Ocupación** (código en
   `src/components/modules/dashboard/CalendarioGantt.tsx`): vista tipo
   diagrama de Gantt por habitación y día. Navegación con flechas semana
   anterior/siguiente, botón "Hoy", selector de rango "2 sem"/"1 mes", y
   toggle "Historial" (muestra/oculta reservas ya finalizadas).
   - Cada barra muestra el número de reserva (#0012) y el huésped. Un punto
     rojo = tiene saldo pendiente. Un candado = facturada.
   - Tocar una barra abre el detalle (número, huésped, fechas, noches,
     tarifa, total, saldo). Se cierra tocando afuera, con Escape o con la X.
   - Filtro por tipo de habitación (si hay más de un tipo) y buscador por
     huésped o número; abajo lista las reservas que coinciden y tocándolas
     lleva a esa semana.
   - Solo con el módulo Reservas: tocar un día libre abre la **reserva
     rápida** (`dashboard/ReservaRapidaDialog.tsx`). A la izquierda: huésped
     (nombre, DNI y teléfono, obligatorios; si el cliente ya vino aparece al
     escribir el nombre o el DNI; "+ Más datos" para email, nacionalidad,
     nacimiento y domicilio), tarifa, adultos (y niños si la tarifa los
     cobra aparte), campos propios de la tarifa, y cobro: Sin cobro ahora /
     Seña (mínimo 30%) / Total, con forma de pago y cuotas. A la derecha un
     resumen: habitación, entrada, noches (hasta donde esté libre), salida,
     huésped, personas, tarifa, forma de pago, detalle del precio, total,
     cobrado ahora y saldo, y el botón Crear reserva. Mismas reglas que
     Reservas (capacidad, caja abierta, recargo por cuotas). "Formulario
     completo" abre Reservas con todo lo escrito: para dos habitaciones o
     tarifas con acompañante sin cargo. Arrastrar una barra la mueve a
     otra habitación u otros días; tirar de su borde derecho cambia la
     salida. Siempre pide confirmar y muestra el total antes y después: el
     precio se recalcula SIEMPRE con la tarifa de la reserva (misma cuenta
     que al editarla en Reservas).
   - No deja mover: reservas facturadas o terminadas; a una habitación
     ocupada esas noches o con menos capacidad; a días que ya pasaron; si
     el huésped ya hizo el check-in, solo se puede cambiar la salida (no la
     habitación ni la entrada); si la tarifa no tiene precios; si el total
     está pasado a cuenta corriente y el precio cambia (primero se anula el
     pase); si lo cobrado supera el total nuevo (eso se hace desde Reservas,
     donde se corrigen los pagos). En celular no se arrastra.
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

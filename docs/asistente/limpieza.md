# Módulo: Limpieza y Mantenimiento

Fuente: `src/components/modules/LimpiezaModule.tsx`. Actualizar este
archivo cada vez que se toque.

No tiene pestañas de navegación. Secciones, de arriba a abajo:
1. Banner de alerta si hay habitaciones en mantenimiento, con botón "Ir a
   Habitaciones".
2. Dos columnas: **Cola de limpieza** y **En mantenimiento**.
3. Card colapsable **"Reportar mantenimiento"**.
4. **Historial de Mantenimiento** con filtros y tabla paginada.

## Marcar una habitación como limpia
Botón "Limpia" en la tarjeta de la cola de limpieza — la pasa a "Disponible".

## Reportar un problema de mantenimiento
Se abre con "Abrir formulario": elegís la habitación (solo lista las que no
están ya en Mantenimiento o Fuera de servicio) y escribís una descripción
— ambos campos son obligatorios. Botón "Reportar mantenimiento".

**Importante**: si esa habitación tiene reservas activas (confirmadas o con
check-in ya hecho), el sistema **las cancela automáticamente** al reportar
el problema. Por eso el botón cambia a "Confirmar y reportar" y muestra
cuántas reservas se van a cancelar antes de dejar seguir.

## Resolver un mantenimiento
Botón "Resolver" en la tarjeta correspondiente, abre un modal:
- Descripción de la reparación (obligatoria).
- Monto de la reparación (opcional, default $0).
- Si el monto es mayor a $0, hay que elegir el origen del pago: **"De
  caja"** (genera un egreso en la caja del turno activo — necesita que haya
  una caja abierta) o **"Pago aparte"** (se registra el gasto sin tocar la caja).
- Al confirmar, la habitación vuelve a "Disponible" automáticamente.

## Historial de Mantenimiento
Filtros: rango de fechas (por defecto, solo hoy), habitación, texto de
descripción, monto mínimo. Se pagina de a 15 registros.

## Reglas importantes
- Prioridad visual en la cola de limpieza según el tiempo desde el
  check-out: "Urgente" (borde rojo) a partir de 2 horas, ámbar entre 1 y 2
  horas, celeste antes de 1 hora.
- Reportar mantenimiento con reservas activas es "todo o nada": si falla
  cancelar alguna reserva, no se crea el reporte ni cambia el estado de la
  habitación.
- Resolver con "De caja" impacta directamente en el módulo Caja (como
  egreso) y en Gastos.

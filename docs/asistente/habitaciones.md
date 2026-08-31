# Módulo: Habitaciones

Fuente: `src/components/modules/HabitacionesModule.tsx` (vista Mapa en
`RoomStatusMap.tsx`). Actualizar este archivo cada vez que se toque.

No tiene pestañas, pero sí un toggle de vista: **Lista** / **Mapa** (arriba
de la pantalla).

## Pantalla principal
- Banner con total de habitaciones y % de ocupación.
- "Distribución por tipo": ingresos y cantidad por tipo de habitación.
- Leyenda de estados con contador por estado.
- Listado agrupado — **automáticamente por piso** si hay habitaciones en
  más de un piso, o **por tipo** si no hay ese patrón — en grupos que se
  pueden colapsar/expandir.

## Acciones
- **"Exportar CSV"**: descarga número, tipo, estado, piso y precio por
  cama de todas las habitaciones.
- **"Nueva Habitación"**: abre el formulario de alta.
- Por cada habitación (al pasar el mouse): **Editar**, **Enviar a
  limpieza / Marcar como limpia** (se cambia directo, sin formulario), y
  **Eliminar**.
- Click en el estado de una habitación abre un selector con las 6 opciones:
  Disponible, Ocupada, Limpieza, Mantenimiento, Reservada, Fuera de
  servicio. Cambiar a "Fuera de servicio" o "Mantenimiento" pide
  confirmación extra, porque son estados que bloquean la habitación.

## Formulario Nueva / Editar habitación
- **Número** — único campo obligatorio (sin esto no se puede guardar).
- Piso — opcional, si se deja vacío se infiere del primer dígito del número.
- Tipo — Simple, Doble, Triple, Cuádruple o Compartida (selector visual).
- Capacidad — solo se puede editar a mano si el tipo es "Compartida"
  (dormis/hostels); el resto de los tipos tiene capacidad fija según el tipo elegido.
- Camas matrimoniales y camas individuales — numéricos, sin mínimo obligatorio.

## Eliminar una habitación
Pide confirmación y avisa explícitamente: "Las reservas futuras serán canceladas."

## Reglas importantes
- El agrupamiento (por piso o por tipo) es automático, no se elige a mano.
- Solo las habitaciones "Compartida" tienen capacidad configurable — las
  demás usan una capacidad estándar según el tipo.

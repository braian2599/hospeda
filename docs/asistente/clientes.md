# Módulo: Clientes

Fuente: `src/components/modules/ClientesModule.tsx`. Actualizar este
archivo cada vez que se toque.

Pantalla única, sin pestañas:
1. Header con botones "Exportar CSV" y "Agregar Cliente".
2. 4 tarjetas de estadísticas: Total Clientes, Recurrentes, Nuevos este
   Mes, Estadías por Cliente (promedio).
3. Buscador (por nombre, DNI o email — recién busca a partir de 2
   caracteres escritos).
4. Grilla de tarjetas de clientes, paginada (12 por página).

## Acciones
- **"Exportar CSV"**: descarga Nombre, DNI, Email, Teléfono y Dirección de
  la lista filtrada actual.
- **"Agregar Cliente"**: abre el alta.
- Por cada tarjeta (al pasar el mouse): ver detalle, **"Nueva reserva"**
  (abre directo el formulario de Reservas con este cliente precargado), eliminar.
- En el detalle de un cliente: botones Crear Reserva, Editar, Eliminar.

## Formulario Crear/Editar
Nombre completo y DNI/Pasaporte son obligatorios. Teléfono, email,
nacionalidad, fecha de nacimiento, domicilio y preferencias son opcionales.

## Reglas importantes
- Cada cliente tiene una "categoría" automática según su historial de
  estadías (no editable a mano): 0-1 estadías = Nuevo, 2-3 = Habitual, 4-6
  = Frecuente, 7+ = VIP.
- El detalle del cliente muestra total de estadías, total gastado,
  promedio por estadía, duración promedio y última visita — todo calculado
  automáticamente a partir de sus reservas pasadas, no se carga a mano.
- Eliminar un cliente es irreversible y **no** valida si tiene reservas
  activas o historial (a diferencia de eliminar una tarifa o método de
  pago, acá no hay bloqueo).
- "Nueva reserva" desde acá abre el módulo Reservas con ese cliente ya
  seleccionado, para no tener que buscarlo de nuevo.

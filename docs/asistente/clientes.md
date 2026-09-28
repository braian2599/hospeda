# Módulo: Clientes

Fuente: `src/components/modules/ClientesModule.tsx`. Actualizar este
archivo cada vez que se toque.

Dos pestañas: **Personas** (los huéspedes) y **Empresas**.

Header con los botones "Exportar CSV" (solo en Personas), "Nueva persona" y
"Nueva empresa".

Pestaña Personas:
1. 4 tarjetas de estadísticas: Total Clientes, Recurrentes, Nuevos este
   Mes, Estadías por Cliente (promedio).
2. Buscador (por nombre, DNI o email — recién busca a partir de 2
   caracteres escritos).
3. Grilla de tarjetas de clientes, paginada (12 por página).

Pestaña Empresas:
- Tabla con razón social, CUIT, condición de IVA, domicilio fiscal y
  contacto. Quien tiene el permiso Comprobantes ve además si debe algo en
  cuenta corriente.
- Buscador por razón social o CUIT. Tocar una fila abre sus datos para
  editarlos.
- **Es el único lugar donde se cargan empresas.** En Comprobantes → Cuenta
  corriente ya no se crean: ahí solo se ve quién debe y se cobra.

## Acciones
- **"Exportar CSV"**: descarga Nombre, DNI, Email, Teléfono y Dirección de
  la lista filtrada actual.
- **"Nueva persona"**: abre el alta de un huésped.
- **"Nueva empresa"**: pide el CUIT; el botón **"Traer de ARCA"** completa
  razón social, domicilio y condición de IVA (solo si el hotel tiene la
  facturación con ARCA). Lo que falte se completa a mano.
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

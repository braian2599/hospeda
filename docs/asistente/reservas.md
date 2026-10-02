# Módulo: Reservas

Fuente: `src/components/modules/ReservasModule.tsx`. Actualizar este archivo
cada vez que se toque ese componente — es lo que usa el asistente de IA
para guiar al dueño del hotel, y desactualizado genera respuestas incorrectas.

## Crear una reserva nueva

El formulario tiene 3 pestañas, en este orden: **Disponibilidad → Cliente → Pago**.

### 1. Disponibilidad
- Fechas de check-in y check-out.
- **Cantidad de personas** (campo "Personas" de búsqueda) — se carga acá, no después.
- **Tarifa** — también se elige en este paso, no al final. La lista muestra
  solo las tarifas que valen para las fechas elegidas (la que está vigente el
  día de salida; ver `docs/asistente/tarifas.md`); abajo dice cuáles no valen
  y por qué. Cualquier tipo de habitación se puede cobrar con cualquier tarifa.
  Al editar, la reserva conserva su tarifa mientras no cambien las fechas.
- **Datos a pedir**: los de toda reserva de esa tarifa y los de cada
  promoción que se aplica (niños, noches gratis, acompañante).
- Checkbox opcional "Solo habitaciones con cama matrimonial".
- Botón "Buscar habitaciones" (deshabilitado hasta que haya fechas).
- Resultado: tarjetas con las habitaciones disponibles (número, tipo, capacidad, camas).
  - Al elegir una habitación, la reserva queda con las personas buscadas
    (con el tope de la habitación); se pueden ajustar en "Pers.:".
  - Compartidas: cada persona ocupa una cama. Aparecen solo si les quedan
    camas libres para todas las personas buscadas en esas fechas, y "Pers.:"
    no deja pasar de las camas libres.
  - Si ninguna habitación individual alcanza para la cantidad de personas
    buscada, el sistema **sugiere combinaciones de 2 habitaciones** (reserva
    múltiple) que sumen la capacidad necesaria.
  - Al seleccionar una habitación, se puede ajustar la cantidad de personas
    puntual para esa habitación (tope: su capacidad máxima).

### 2. Cliente
- Buscador de cliente existente (por nombre, DNI o email) — si lo encuentra,
  autocompleta los datos.
- Si es un huésped nuevo: nombre completo, DNI/pasaporte y teléfono son
  obligatorios. Email, nacionalidad, fecha de nacimiento y domicilio son opcionales.

### 3. Pago
- Desglose de precio itemizado (noches, recargos, promociones si corresponden).
- Total (o "Total combinado" si es una reserva múltiple de 2 habitaciones).
- Forma de pago, con 3 opciones en un selector: **Sin pago / Parcial / Total**.
  - Parcial: se pide un monto con mínimo 30% del total y máximo el total
    completo; muestra el saldo restante en vivo a medida que se escribe.
  - Total: cobra el monto completo de la reserva.
- Método de pago (selector). Si el método tiene recargo por cuotas, aparece
  además un selector de cuotas.

## Reserva múltiple (una sola habitación no alcanza)
Cuando la cantidad de personas buscada supera la capacidad de cualquier
habitación individual disponible, el sistema calcula automáticamente
combinaciones de 2 habitaciones cuya capacidad sumada alcance. Se elige la
combinación como si fuera una única reserva: personas y tarifa se cargan
para cada habitación, y en Pago se ve el total combinado de ambas.

## La lista de reservas
Una tarjeta por reserva (código: `src/components/reservas/TarjetaReserva.tsx`,
reglas en `src/lib/reservas-lista.ts`):
- Arriba: número (#0012) y estado: Llega hoy, Confirmada, Por confirmar,
  Alojado, Sale hoy, Terminada o Cancelada.
- Huésped; habitación, personas, fechas y noches; y el pago: "Debe $X" con
  una barrita de lo cobrado, "Pagada" (y "Facturada" si corresponde) o la
  cuenta corriente.
- Abajo, siempre a la vista, la acción que toca: Confirmar pago (por
  confirmar), Check-in (desde un día antes de la entrada), Check-out
  (alojado), Cobrar (si debe) o A cuenta corriente. El check-in y el
  check-out desde acá piden confirmar; para cargar llave, acompañantes o
  menores hay que ir a Check-In/Out.
- El resto está en el menú "⋯": Ver detalle, Editar reserva, Registrar pago,
  Corregir pagos, Pasar a cuenta corriente y Cancelar reserva (solo lo que
  se puede hacer con esa reserva). Tocar la tarjeta abre el detalle.
- Arriba de la lista: buscador (nombre, DNI o número; con "#" busca solo el
  número) y filtros rápidos con la cantidad: Todas, Hoy, Alojados, Próximas,
  Con saldo y Terminadas. Estado, tipo de habitación, estado de pago y fechas
  están en "Más filtros".
- Orden: primero alojados, por confirmar y confirmadas (de la entrada más
  cercana a la más lejana), después terminadas y canceladas (la más nueva
  primero).

## Editar una reserva
- Cada reserva tiene un número corto por hotel (#0012), que se ve en la
  lista, en el detalle, en "Editar reserva #0012" y en los comprobantes.
- En la pestaña Pago se ven los pagos cargados y se puede **corregir el
  monto** de cada uno; la caja se ajusta sola. Solo mientras siga abierto el
  turno de caja donde se cobró: cerrado ese turno, el monto queda fijo.
  $0 elimina el pago.
- Con el check-out hecho solo se corrigen los montos, y solo si la reserva
  no tiene saldo. Si pasó a cuenta corriente, no se corrigen.
- **Una reserva facturada no se modifica**: no aparecen Editar, Cancelar ni
  Pago, y lleva la etiqueta "Facturada". Se corrige con una nota de crédito
  (módulo ARCA).

## Check-out antes de tiempo
Si el huésped se va antes de la fecha reservada, la reserva guarda el día
en que se fue (nunca antes de una noche después de la entrada). Si se va el
día previsto o después, queda la fecha reservada. Una reserva facturada no
cambia de fechas.

## Cuenta corriente
Con el check-out hecho y saldo pendiente, el botón "A cuenta corriente"
pasa el total a la cuenta de una empresa. Solo si la reserva NO tiene
ningún pago: si pagaron una seña, el resto se cobra.

## Reglas importantes
- No se puede cargar más personas que la capacidad máxima de la habitación
  elegida (el sistema lo valida y muestra un error si se excede).
- La tarifa aplicada depende de lo elegido en el paso 1 — no se puede
  cambiar de tipo de tarifa después de seleccionar habitación sin resetear
  esa selección.
- Un cliente recurrente se busca en el paso "Cliente" para no recargar sus
  datos a mano cada vez.

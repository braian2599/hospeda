# Módulo: Reservas

Fuente: `src/components/modules/ReservasModule.tsx`. Actualizar este archivo
cada vez que se toque ese componente — es lo que usa el asistente de IA
para guiar al dueño del hotel, y desactualizado genera respuestas incorrectas.

## Crear una reserva nueva

El formulario tiene 3 pestañas, en este orden: **Disponibilidad → Cliente → Pago**.

### 1. Disponibilidad
- Fechas de check-in y check-out.
- **Cantidad de personas** (campo "Personas" de búsqueda) — se carga acá, no después.
- **Tarifa** — también se elige en este paso, no al final. El sistema filtra
  los tipos de tarifa disponibles según el tipo de habitación que se busque
  (por cama si es compartida, por grupo si es privada).
- Checkbox opcional "Solo habitaciones con cama matrimonial".
- Botón "Buscar habitaciones" (deshabilitado hasta que haya fechas).
- Resultado: tarjetas con las habitaciones disponibles (número, tipo, capacidad, camas).
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

## Reglas importantes
- No se puede cargar más personas que la capacidad máxima de la habitación
  elegida (el sistema lo valida y muestra un error si se excede).
- La tarifa aplicada depende de lo elegido en el paso 1 — no se puede
  cambiar de tipo de tarifa después de seleccionar habitación sin resetear
  esa selección.
- Un cliente recurrente se busca en el paso "Cliente" para no recargar sus
  datos a mano cada vez.

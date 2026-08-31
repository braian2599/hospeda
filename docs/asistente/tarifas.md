# Módulo: Tarifas

Fuente: `src/components/modules/TarifasModule.tsx`. Actualizar este
archivo cada vez que se toque.

3 pestañas, en este orden: **Tarifas → Métodos de Pago → Categorías de Gastos**.

## Pestaña Tarifas
Grilla de tarjetas, una por tarifa. Botones de cabecera: "Nueva Tarifa",
"Comparar" (mínimo 2 seleccionadas, máximo 3), "Limpiar" selección. Por
tarjeta: Editar, Duplicar, Exportar CSV, Eliminar.

El alta/edición es un **wizard de 3 pasos**:
1. **Información básica**: nombre (obligatorio) y modo de cobro
   (obligatorio) — "Por grupo", "Por habitación" o "Por cama".
2. **Rangos de precios**: uno o más rangos de mín/máx personas + precio.
   Si el modo es "Por habitación" o "Por cama", el precio es fijo (un solo
   rango, no se pueden agregar ni quitar).
3. **Promociones** (todas opcionales): "Acompañante sin cargo", "Niños con
   precio diferenciado", "Noches de cortesía" (cada X noches / a partir de
   X noches / un día de la semana gratis). También acá se definen los
   "Campos adicionales" personalizados que después se piden al elegir esa
   tarifa en una reserva.

Hay una vista previa en vivo de la tarjeta mientras se completa el wizard.

## Pestaña Métodos de Pago
Tabla con Nombre, Tipo, si permite recargo por cuotas. Botón "Agregar
Método". El método "Efectivo" no se puede eliminar.

## Pestaña Categorías de Gastos
Tabla simple con Nombre y cantidad de gastos asociados. Botón "Agregar Categoría".

## Reglas importantes
- No se pueden repetir nombres de tarifa (sin importar mayúsculas/minúsculas).
- **No se puede eliminar una tarifa** si hay reservas activas usándola.
- **No se puede eliminar un método de pago** si es "Efectivo", si ya tiene
  pagos registrados, o si hay reservas activas que lo usan.
- **No se puede eliminar una categoría de gastos** que ya tenga gastos asociados.
- Cambiar el modo de cobro de una tarifa reorganiza automáticamente los
  rangos de precio (puede perder datos cargados si no se revisa antes de guardar).
- Duplicar una tarifa exige cambiar el nombre antes de poder guardarla.
- Las tarifas y métodos de pago configurados acá son los que se usan al
  crear una reserva en el módulo Reservas.

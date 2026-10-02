# Módulo: Tarifas

Fuente: `src/components/modules/TarifasModule.tsx` (pestañas) y
`src/components/tarifas/TarifasTab.tsx` (pestaña Tarifas). Reglas de fechas:
`src/lib/tarifa-vigencia.ts`. Actualizar este archivo cada vez que se toque.

3 pestañas, en este orden: **Tarifas → Métodos de pago → Categorías de gastos**.
Sin íconos ni emojis (pedido del dueño).

## Pestaña Tarifas
Tabla, una fila por tarifa: nombre (y en qué tipos de habitación la cobra la
web, o "Solo desde el panel"), cómo se cobra, precio por noche, vigencia,
promociones y estado. Filtros: **Vigentes, Programadas, Vencidas, Todas** (y
Desactivadas si hay alguna). Buscador. Tildando 2 o 3 filas, "Comparar".
Menú "···" de cada fila: Editar, Duplicar, Exportar CSV, Desactivar/Activar,
Eliminar. Tocar la fila abre la edición.

### Ventana de crear o editar
Mediana, alto fijo, sin scroll. Menú a la izquierda con 3 secciones y, abajo,
un resumen con dos ejemplos de precio:
1. **Datos y vigencia**: nombre, activa, vale desde, hasta (incluye la
   salida; vacío = sin límite) y los **datos a pedir en toda reserva**
   (por ejemplo, la patente).
2. **Precios por noche**: cómo se cobra — por grupo (una fila por cantidad
   de personas; la última puede quedar "o más"), por habitación (un precio
   fijo) o por cama (un precio por persona).
3. **Promociones**, cada una se despliega con sus campos y sus propios
   datos a pedir: precio para niños, noches de cortesía (cada X noches / desde
   X noches / un día de la semana), acompañante sin cargo; y **Página web**:
   "Mostrar en la página web como promoción" (apagado por defecto) y el texto.
Al crear: Anterior / Siguiente / Crear tarifa. Al editar: Guardar desde
cualquier sección. Si falta algo, la sección se marca en rojo.

### Duplicar
Ventana chica: nombre y fechas de la copia (si la original tenía fechas,
propone las mismas un año después). Copia precios, promociones y datos a
pedir; la copia no se muestra en la web. Después abre la copia para revisar
precios.

## Reglas de las fechas
- Una tarifa vale para una estadía si está activa y vigente el **día de
  salida**; entonces cobra la estadía entera, sin mezclar tarifas.
- Reservas y reserva rápida muestran solo las tarifas que valen para las
  fechas; el calendario no mueve una reserva a fechas donde su tarifa no
  vale. El servidor tampoco deja crear una reserva con una tarifa que no
  vale para su salida.
- Las reservas hechas conservan su tarifa y su precio aunque venza.
- Si se cambia el nombre de una tarifa, se cambia también en sus reservas.
- Si la tarifa está en la web y con las fechas nuevas se pisa con otra del
  mismo tipo de habitación, no deja guardar.

## Datos a pedir
Los de toda reserva se piden siempre. Los de cada promoción, solo cuando se
aplica: niños si la reserva trae niños; noches de cortesía si tiene alguna
noche gratis; acompañante sin cargo siempre. Lo calcula `camposAPedir`
(`src/lib/tarifa-calc.ts`), igual en el panel y en la web.

## Pestaña Métodos de pago
Tabla con Nombre, Tipo, si permite recargo por cuotas. Botón "Agregar
Método". El método "Efectivo" no se puede eliminar.

## Pestaña Categorías de gastos
Tabla simple con Nombre y cantidad de gastos asociados. Botón "Agregar Categoría".

## Otras reglas
- No se pueden repetir nombres de tarifa (sin importar mayúsculas/minúsculas).
- **No se puede eliminar una tarifa** si hay reservas activas usándola (se
  puede desactivar).
- **No se puede eliminar un método de pago** si es "Efectivo", si ya tiene
  pagos registrados, o si hay reservas activas que lo usan.
- **No se puede eliminar una categoría de gastos** que ya tenga gastos asociados.
- Cambiar el modo de cobro reorganiza los precios (por habitación y por cama
  tienen un solo precio).

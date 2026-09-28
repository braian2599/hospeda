# Módulo: ARCA

Fuente: `src/components/modules/ArcaModule.tsx` (y `src/components/arca/`).
Actualizar este archivo cada vez que se toque.

Todo lo que se factura y se emite. Lo trae todo plan que tiene
Comprobantes. **Permiso aparte:** el dueño y los administradores lo ven
siempre; un empleado, solo si le dan el permiso "ARCA" en Usuarios. Así se
puede cobrar (Comprobantes) sin poder facturar.

Si el hotel no tiene activa la facturación con ARCA, lo dice arriba y solo
funcionan los presupuestos.

Arriba: cuántas reservas hay cobradas sin facturar y lo facturado en el mes.
Pestañas: **Para facturar**, **Facturas**, **Notas de crédito**, **Notas de
débito** y **Presupuestos**. (Los remitos se sacaron del sistema.)

## Para facturar
Aparecen solas todas las reservas **cobradas completas** que todavía no
tienen factura: con el huésped alojado, ya ido o que pagó por adelantado.
Una reserva en cuenta corriente cuenta como cobrada (lo cobrado más lo
anotado en la cuenta). Filtro por cuándo se terminó de cobrar: últimos 30
días, 90 días o cualquier fecha. No hay opción "No facturar": las que no
se facturan quedan en la lista.
- **Facturar** (una): se elige a nombre de quién. El huésped (Consumidor
  Final, con su DNI) o una empresa o persona con CUIT de Clientes →
  Empresas. La de cuenta corriente va siempre a nombre de su empresa.
- **Varias juntas**: se tildan y "Facturar las N". Cada una a nombre de su
  huésped (o de su empresa si está en cuenta corriente).
- La letra sale sola: hotel Monotributista o Exento → C; hotel Responsable
  Inscripto → A a otro Responsable Inscripto, B a los demás. A discrimina
  el IVA 21%; B lleva la leyenda de IVA contenido (Ley 27.743).

## Facturas
Las autorizadas por ARCA (con CAE), con su estado: Vigente, "Queda $X" (si
tiene notas de crédito parciales) o Anulada. Por cada factura: Ver/PDF,
**Nota de crédito** y **Nota de débito**.

## Notas de crédito y débito
Con CAE de ARCA y la misma letra que la factura. Se emiten desde la factura
o desde su pestaña, eligiendo la factura de la lista.
- **Crédito**: anula todo lo que queda de la factura o una parte. Nunca más
  de lo que queda. Si anula todo, la factura queda Anulada.
- **Débito**: suma un importe (por ejemplo, consumos que no se incluyeron).
- Piden un motivo. La A discrimina el IVA; la Nota de Crédito B lleva la
  leyenda de IVA contenido.

## Presupuestos
Sin validez fiscal (no pasan por ARCA). Se elige el cliente o la empresa de
la lista, se carga una empresa nueva o se escribe a mano. Líneas con
cantidad y precio. Se pueden anular.

## Reglas importantes
- Una reserva se factura recién cuando está cobrada completa. Una seña sola
  no se factura.
- Una reserva facturada ya no se modifica (fechas, datos, pagos, ni se
  cancela), aunque tenga una nota de crédito.
- La fecha de la factura es la del día en Argentina en que ARCA da el CAE.

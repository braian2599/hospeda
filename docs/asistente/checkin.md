# Módulo: Check-In / Check-Out

Fuente: `src/components/modules/CheckInModule.tsx`. Actualizar este
archivo cada vez que se toque.

No tiene pestañas: son dos columnas paralelas, "Check-Ins Pendientes"
(reservas en estado "Confirmada") y "Check-Outs Pendientes" (reservas ya
con check-in hecho), más un resumen "Actividad de hoy" arriba (check-ins
completados hoy, check-outs completados hoy, estadías activas).

## Hacer un check-in
Botón "Check-In" en la reserva → abre un modal:
- Muestra el estado de cuenta (total, pagado, saldo).
- Si la reserva tiene menores a cargo, pide obligatoriamente sus datos:
  nombre completo, documento, edad y parentesco (uno por cada menor
  declarado en la reserva).
- Checkboxes opcionales "Documento verificado" y "Conformidad del huésped".
- **Número de llave** — es el único campo realmente obligatorio para poder
  confirmar (junto con los datos de menores, si aplica).
- Contacto de emergencia y observaciones — opcionales.
- Acompañantes: se pueden agregar/quitar (nombre, DNI, celular).
- Botón "Confirmar Check-In".

Si falla, el mensaje de error es genérico (puede ser que la reserva ya no
esté en estado "Confirmada", que falten datos de menores, o un problema de
conexión) — no siempre indica la causa exacta.

## Hacer un check-out
Botón "Check-Out" en la reserva → abre un modal con habitación, tarifa,
fechas, noches, ocupación, y el resumen financiero (Total, Pagado, Saldo).
Si hay saldo pendiente se avisa en rojo, **pero no bloquea** el check-out —
se puede completar igual con deuda pendiente.

## Reglas importantes
- El check-in siempre requiere pasar por este modal completo — no hay
  atajo desde otras pantallas.
- El check-out se puede hacer también directo desde el Dashboard (ver
  `dashboard.md`), no solo desde acá.
- Al confirmar el check-out, la habitación pasa a estado "Limpieza"
  automáticamente (impacta en Habitaciones y en las alertas del Dashboard).
- Al confirmar el check-in, la reserva pasa de "Confirmada" a "Check-In
  realizado" y la habitación aparece como ocupada en Habitaciones y en el
  Gantt del Dashboard.

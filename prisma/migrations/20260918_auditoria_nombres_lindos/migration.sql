-- Renombra los tipos técnicos de la auditoría a los nombres que ve el hotel.
--
-- Convivían dos vocabularios en la misma columna: el navegador escribía
-- 'Reserva' y el servidor 'reserva_creada' para el MISMO hecho. Ahora escribe
-- solo el servidor, con los nombres lindos (ver src/lib/auditoria.ts).
--
-- Esto empareja lo que ya estaba escrito. NO borra nada: las filas duplicadas
-- de antes del cambio siguen ahí, ahora con el mismo nombre. Borrar historial
-- es irreversible y no hace falta.

UPDATE "Auditoria" SET "tipo" = 'Reserva'   WHERE "tipo" IN ('reserva_creada', 'reserva_editada', 'reserva_cancelada');
UPDATE "Auditoria" SET "tipo" = 'Check-In'  WHERE "tipo" = 'checkin_realizado';
UPDATE "Auditoria" SET "tipo" = 'Check-Out' WHERE "tipo" = 'checkout_realizado';
UPDATE "Auditoria" SET "tipo" = 'Pago'      WHERE "tipo" IN ('pago_registrado', 'pago_eliminado');
UPDATE "Auditoria" SET "tipo" = 'Cliente'   WHERE "tipo" IN ('cliente_creado', 'cliente_editado', 'cliente_eliminado');

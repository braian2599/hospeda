# Módulo: Usuarios

Fuente: `src/components/modules/UsuariosModule.tsx`. Actualizar este
archivo cada vez que se toque. Solo lo pueden modificar el owner o
usuarios con permiso "usuarios".

Pantalla única: stats (total, en línea, por rol, invitaciones pendientes),
grilla de tarjetas de usuario, y log de actividad reciente.

## Roles disponibles
- **Owner** (Administrador Principal) — no se puede eliminar ni asignar a
  otro usuario nuevo, es fijo por hotel.
- **Admin** — mismo acceso a módulos que el owner.
- **Recepción** — acceso a Dashboard, Habitaciones, Reservas, Check-in,
  Clientes, Tarifas.
- **Limpieza** — acceso a Dashboard, Habitaciones, Limpieza.

Los permisos por módulo se pueden ajustar a mano por usuario (no quedan
fijos solo por el rol).

## Crear un usuario
Botón "Crear usuario": nombre del perfil y contraseña (mínimo 8
caracteres) son obligatorios, más el rol y los módulos a los que va a
tener acceso.

## Invitar un usuario
Botón "Invitar": nombre y rol (no puede ser owner), con una contraseña
temporal auto-generada (se puede regenerar).

## Otras acciones (menú ⋮ de cada tarjeta)
- **Editar**: cambiar nombre, rol o permisos.
- **Restablecer contraseña**: genera una nueva contraseña temporal.
- **Suspender**: no borra al usuario, solo le bloquea el acceso (sus datos
  quedan conservados). No está disponible para el owner.

## Reglas importantes
- Solo el propio owner puede cambiar su propia contraseña.
- Un usuario con rol owner solo puede ser editado por otro owner.
- El indicador "en línea" es en tiempo real (presencia), no un dato fijo.

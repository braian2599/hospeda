# Cuenta corriente (saldos de empresas y clientes habituales)

Documento de decisiones. Todo lo que está acá se discutió y se cerró con el
dueño del producto antes de escribir código. Si algo del código contradice
este documento, el que manda es el documento: preguntar antes de "corregirlo".

## El problema

Algunos hoteles trabajan con empresas (y con algunos clientes habituales) que
no pagan en el momento: se hospedan, se anota la deuda, y pagan a fin de mes.
El sistema no tenía dónde anotar esa deuda.

## Por qué NO es un método de pago más

Es lo primero que se pensó y está descartado, por tres hechos del código:

1. `POST /api/pagos` crea SIEMPRE un `MovimientoCaja` de tipo ingreso, y exige
   un turno de caja abierto (`CajaCerradaError`). Anotar una deuda como pago
   metería en la caja plata que nunca entró.
2. `POST /api/caja/cerrar` separa `metodo === 'Efectivo'` (se cuenta) del resto
   (`totalOtrosEsperado`, lo declara el cajero). Con cualquier nombre de método,
   el cierre queda con una diferencia que nadie puede explicar.
3. `POST /api/pagos` RECHAZA pagos sobre reservas con `Checkout_realizado`.
   Cuando la empresa paga, la reserva ya cerró hace semanas.

Conclusión: derivar la deuda y cobrarla son dos acciones distintas, y ninguna
de las dos es un `Pago` de reserva.

## Decisiones cerradas

### Quién puede tener cuenta corriente
Un **titular de cuenta**: empresa o persona. No se llama "empresa" porque
también hay clientes habituales que pagan a mes.

- **Empresa:** razón social, CUIT, condición de IVA. No se hospeda nunca, así
  que no tiene ficha de `Cliente`.
- **Persona:** se engancha a su ficha de `Cliente` existente (`clienteId`)
  para no tener a la misma persona dos veces.

### Solo se pide el CUIT
A empresas y a personas que piden factura se les pide SOLO el CUIT. Con eso
ARCA devuelve razón social, domicilio fiscal y condición de IVA (monotributo,
responsable inscripto, exento...). El CUIT es obligatorio para crear un
titular: sin CUIT no hay datos fiscales y no tiene sentido.

La persona común sin condición frente al IVA no pasa por acá: se le hace
factura a Consumidor Final como hasta ahora, con el DNI.

### La deuda se deriva COMPLETA, nunca parcial
"Nadie que anota fiado deja un pago parcial: saca fiado todo y deja anotado
todo." Una reserva se deriva una sola vez y por el saldo total. Nada de
"la habitación a la empresa y el minibar lo paga el huésped".

(El COBRO sí puede ser parcial: la empresa puede pagar $50.000 de una deuda
de $180.000. Lo que no se parte es la derivación.)

### Cuándo se deriva
En la reserva con saldo pendiente. El check-out ya permite cerrar con saldo
(no hay bloqueo) y Reservas ya muestra el badge rojo "Saldo: $X". Ahí mismo va
el botón "Pasar a cuenta corriente": se elige el titular (o se carga uno nuevo)
y listo. Derivar NO toca la caja: no entró plata.

### Cómo se cobra
Cada hotel decide la forma de pago al cobrar, igual que en una reserva
(efectivo, tarjeta, transferencia...). Es un cobro normal: exige turno de caja
abierto y genera su `MovimientoCaja`. Pero va en su propia tabla, porque no
está atado a UNA reserva (puede saldar tres estadías juntas) y la reserva ya
está cerrada.

### El saldo
Nunca se guarda: se calcula siempre como cargos menos pagos. Un total guardado
se desincroniza; uno calculado no.

### Quién ve qué (esto es importante, hubo una confusión)
- **Cualquier recepcionista:** emite el Recibo interno del check-out, que NO
  tiene validez fiscal (`notaSinValidezFiscal`). Puede derivar un saldo a
  cuenta corriente (derivar no es un acto fiscal) y cargar el CUIT en la ficha
  de un cliente.
- **Solo algunos empleados (permiso `comprobantes`):** TODO lo que toca ARCA.
  Factura A, B y C, Notas de Crédito y Débito, la lista de titulares, los
  estados de cuenta y el cobro de las deudas.

La Factura B/C NO la maneja cualquier recepcionista. Hoy ya es así:
`facturar-afip` exige `comprobantes`; el recepcionista solo emite el Recibo.

Se reusa el permiso `comprobantes` en vez de crear uno nuevo, porque ya es
exactamente "lo fiscal, para algunos empleados". Si algún día hace falta
separar "ve facturas" de "ve cuánto debe cada empresa", se crea
`cuentaCorriente` aparte.

### Notas de Crédito y Débito
Son necesarias. Se usan para empresas y para clientes habituales, que son
justamente los titulares de cuenta corriente.

### Datos fiscales en la ficha del cliente
La ficha del cliente tiene dos pestañas: "Datos" (con los que reservó, lo de
siempre) y "Datos fiscales" (el CUIT y lo que devuelve ARCA). La segunda es el
`TitularCuenta` enganchado a ese cliente, mostrado ahí. No se agregan campos
fiscales a `Cliente`: el 95% de los huéspedes nunca pide factura, y la razón
social fiscal puede ser distinta del nombre del huésped (el monotributista con
nombre de fantasía).

Aparte, en la sección de Cuenta Corriente hay un botón "Nueva empresa" que
carga una empresa trayendo los datos de ARCA por CUIT.

### Qué letra lleva la factura
No depende solo del que recibe: se cruza con la condición del hotel.

| Hotel (emisor)          | Receptor                                   | Factura |
|-------------------------|--------------------------------------------|---------|
| Responsable Inscripto   | Responsable Inscripto                      | A       |
| Responsable Inscripto   | Monotributo / Exento / Consumidor Final    | B       |
| Monotributo / Exento    | Cualquiera                                 | C       |

Hoy `tipoComprobantePorCondicionIva` mira solo al hotel. La Factura A NO
existe: está marcada como fuera de alcance en `src/lib/afip/config.ts`.

### Facturación: una factura por estadía
No se junta el mes en una sola factura. Se factura por estadía como siempre;
lo que cambia es a nombre de quién (el titular, no el huésped). La empresa
junta sus facturas para pagar; eso lo hace su contadora, no el hotel.

### Facturar no registra el ingreso otra vez
Verificado en `facturar-afip/route.ts`: pide el CAE, lo guarda en la reserva y
lo refleja en `Comprobante`. No toca `MovimientoCaja` ni crea un `Pago`. El
ingreso se registra al cobrar, no al facturar.

## Modelo de datos

- `TitularCuenta`: tipo (empresa/persona), nombre, CUIT (obligatorio, único
  por hotel), condición de IVA, domicilio fiscal, contacto, límite de crédito
  (opcional; todavía no se decidió si bloquea o solo avisa), `clienteId`
  (solo persona), activo.
- `CargoCuentaCorriente`: la deuda derivada de una reserva. `reservaId` único:
  una reserva se deriva una sola vez. No toca la caja.
- `PagoCuentaCorriente`: el cobro. Genera un `MovimientoCaja` espejo, con el
  mismo patrón que ya usa `Gasto` (`gastoId`).
- `MovimientoCaja.pagoCuentaCorrienteId`: el vínculo del espejo.
- `Comprobante.titularCuentaId`: para listar "todas las facturas de esta
  empresa" sin buscar por texto.

## Endpoints

Construidos en CC-2. Montos siempre en centavos, igual que `Pago.monto`.
La lógica sin base de datos está en `src/lib/cuenta-corriente.ts`.

| Endpoint                                        | Qué hace                                         | Permiso                                   |
|-------------------------------------------------|--------------------------------------------------|-------------------------------------------|
| `GET /api/titulares`                            | Buscar (`?q=` nombre o CUIT, `?clienteId=`)      | reservas, checkin, clientes o comprobantes |
| `POST /api/titulares`                           | Alta                                             | reservas, checkin, clientes o comprobantes |
| `GET /api/titulares/[id]`                       | Estado de cuenta: saldo, cargos, pagos           | comprobantes                              |
| `PUT /api/titulares/[id]`                       | Editar (límite y baja: solo comprobantes)        | reservas, checkin, clientes o comprobantes |
| `POST /api/reservas/[id]/cuenta-corriente`      | Derivar el saldo completo                        | reservas o checkin                        |
| `POST /api/titulares/[id]/pagos`                | Cobrar (turno abierto + ingreso en caja)         | comprobantes                              |
| `DELETE /api/titulares/[id]/pagos/[pagoId]`     | Anular un cobro mal cargado                      | comprobantes                              |

Buscar y cargar titulares no es solo de `comprobantes`, como decía el plan:
el recepcionista necesita elegir a quién derivar, y la ficha del cliente
cargar su CUIT. Lo que sí es solo de `comprobantes`: cuánto debe cada uno,
el límite, la baja, el estado de cuenta y cobrar. Esa regla está en un solo
lugar, `vistaTitular`.

El buscador por CUIT contra ARCA es `GET /api/titulares/arca?cuit=` (CC-5).

### Decisiones tomadas al construir CC-2

- **Se deriva solo con el check-out hecho.** Una reserva con check-out ya no
  se puede editar, cancelar, ni sumarle o borrarle pagos: su saldo es
  definitivo. Antes todavía se mueve. La pantalla (CC-3) hace el check-out y
  enseguida ofrece pasar el saldo a cuenta corriente.
- **El cobro no se toca desde Caja.** Caja permitía editar el monto o borrar
  cualquier movimiento del turno abierto; con un cobro de cuenta corriente,
  la deuda quedaba como cobrada y la plata fuera de la caja. Ahora Caja lo
  rechaza, y se corrige anulando el cobro, que borra los dos juntos. Solo
  mientras el turno siga abierto (la misma regla que Caja).
- **Dos cobros a la vez no pueden pasarse de la deuda.** Se bloquea la fila
  del titular durante el cobro. Probado: sin el bloqueo, dos cobros de
  $100.000 sobre una deuda de $150.000 pasaban los dos.
- **El CUIT se valida con el dígito verificador**, el mismo cálculo de ARCA.
  No confirma que exista (eso es CC-5), pero agarra el número mal tipeado.
- **El CUIT y el tipo se corrigen solo mientras no haya movimientos.**
  Después sería cambiarle el dueño a una deuda anotada: se desactiva y se
  carga uno nuevo.
- **El aviso de límite de crédito lo ve solo quien tiene `comprobantes`.**
  No frena nada (sigue pendiente de decidir).
- **La factura a nombre del titular pasa a CC-4.** Hoy `facturar-afip`
  factura lo que PAGÓ el huésped, a su nombre (ver `emitirComprobanteAfip`).
  Para una reserva derivada eso no factura nada mal: la seña del huésped va
  al huésped, y lo derivado todavía no se factura. Facturarle al titular
  depende de la Factura A y de una pregunta abierta (abajo).

## Fases

- **CC-1 — Modelo de datos:** tablas, campos y migración.
- **CC-2 — Backend:** los endpoints.
- **CC-3 — Frontend:** pestaña Cuenta Corriente dentro de Comprobantes, botón
  en Reservas, pestaña "Datos fiscales" en Cliente.
- **CC-4 — Factura A y facturar al titular:** tipo 1 en `afip/config.ts` y
  `wsfe.ts`, con la regla cruzada emisor/receptor; y facturarle lo derivado
  al titular con su CUIT. **Decidido por el dueño: una cuenta corriente no
  tiene seña; va a la cuenta el total de la reserva, y se hace UNA factura al
  titular por el total.** Verificar en la documentación de ARCA si hoy exige
  la condición de IVA del receptor al pedir el CAE: el `wsfe.ts` actual no la
  manda (visto al revisar CC-2, sin verificar contra ARCA).
- **CC-5 — Padrón de ARCA:** botón "Traer de ARCA" al cargar un titular.
  Servicio `ws_sr_constancia_inscripcion` (Constancia de Inscripción),
  operación `getPersona_v2`. Reusa el certificado de facturar.

CC-1 a CC-3 ya dejan el sistema andando (anotar la deuda, cobrarla, ver el
saldo) sin tocar nada nuevo de ARCA.

## Cómo se trabaja

- Todo va a la rama `PREVIEW`. A `main` (que despliega a producción) recién
  cuando el dueño termine las pruebas y lo apruebe.
- Vercel despliega `PREVIEW` solo, con su propia URL.
- Preview tiene su propia base: una rama `preview` de Neon (`DATABASE_URL`
  de Preview en Vercel, solo para la rama `PREVIEW`). Las migraciones se
  corren primero ahí y, antes de pasar a `main`, en la base de producción.
  Las demás claves (email, Mercado Pago...) siguen compartidas: probar solo
  con el hotel ficticio.
- Las migraciones se escriben a mano, idempotentes, y el SQL se pasa en el
  chat antes de correrlo. Las corre el dueño.
- Toda migración tiene que ser aditiva (tablas y
  columnas nuevas, opcionales): tiene que poder correrse con `main` en
  producción sin romper nada.

## Estado

- **CC-1:** schema y migración `20260923_cuenta_corriente` escritos y
  probados contra un Postgres con el schema de main y datos: corre dos veces
  sin error, no toca los datos existentes, queda idéntico al schema (cero
  diferencias), frena borrar reservas/titulares con deuda y deja borrar un
  hotel entero en cascada. **Corrida en Neon por el dueño.**
- **CC-2:** endpoints construidos. Probados contra un Postgres real con el
  schema de main + la migración (90 pruebas): permisos de cada uno,
  aislamiento entre hoteles, validaciones, las dos carreras (derivar y cobrar
  a la vez), el ingreso en caja, el bloqueo en Caja, anular, y borrar el
  hotel entero.
- **CC-3:** pantallas hechas y probadas con la app andando (Postgres local +
  navegador automático, como dueño y como recepcionista):
  - `PreguntaCuentaCorriente` (montada una sola vez en `app/page.tsx`): después
    de un check-out con saldo pregunta si va a cuenta corriente, se haga desde
    Reservas, Check-in o Dashboard. La dispara `realizarCheckOut` en el store.
  - Reservas: la derivada muestra "Cta. corriente: X" en vez del saldo en rojo;
    las cerradas con saldo tienen el botón "A cuenta corriente"; filtro nuevo.
  - Comprobantes → pestaña "Cuenta corriente": quién debe y cuánto, estado de
    cuenta, cobrar, anular, editar, nueva empresa/persona.
  - Clientes → ficha → pestaña "Datos fiscales": cargar el CUIT del cliente.
  - Caja: el cobro de cuenta corriente no muestra editar/borrar.

### Decisiones tomadas al construir CC-3

- **Solo aparece si el plan del hotel tiene Comprobantes.** El Básico no lo
  tiene: si se anotara una deuda ahí, nadie en el hotel podría verla ni
  cobrarla. (La API no controla el plan en ningún lado, solo la pantalla: es
  el criterio que ya usa todo el sistema.)
- **Solo si la reserva tiene el total cargado.** Sin total, la pantalla lo
  estima por tarifa y el servidor no deriva: se mostraría un número que
  después no se anota.
- **El botón "Pago" del celular ya no aparece en reservas con check-out.** La
  API rechaza pagos ahí; la tabla de compu ya lo ocultaba, el celular no.
- La tarjeta de derivar la ve el recepcionista con nombre y CUIT, nunca montos.

### Encontrado al probar CC-3, y arreglado después

- `prisma/seed.ts` tenía su propia copia de los planes y se había quedado
  atrás ('facturacion' en vez de 'comprobantes', otros límites, sin Elite).
  Ahora los lee de `src/lib/plan-config.ts` y solo crea los que faltan: nunca
  pisa lo que se editó desde Super Admin.
- Tres pantallas del personal pedían `/api/configuracion/hotel`, que es solo
  del dueño: a los demás les daba 403 y usaban el valor por defecto (el aviso
  del límite de reservas web no aparecía, el indicador de señas asumía
  Mercado Pago aunque se cobrara a mano, el recibo salía sin teléfono ni
  email). Ahora piden `/api/configuracion/operativa`, con solo esos datos.
- `/api/configuracion/fiscal` también era solo del dueño, y Comprobantes lo
  pide para imprimir: los empleados de 'comprobantes' imprimían sin razón
  social, CUIT, IVA ni dirección. Leerlo ahora pide 'comprobantes';
  modificarlo sigue siendo del dueño.

- **CC-5:** hecho. Migración `20260924_padron_arca` (tres columnas nuevas en
  `TenantAfip`).
  - **Por qué columnas nuevas:** ARCA da un ticket de acceso (WSAA) distinto
    por servicio y no entrega otro mientras el anterior siga vigente
    (`coe.alreadyAuthenticated`). Si la consulta de CUIT usara las columnas
    del ticket de facturar, se pisarían y el siguiente login fallaría hasta
    12 h. `getWsaaTicket(tenantId, servicio)` guarda cada uno en las suyas;
    `SIN_TICKETS_WSAA` los borra todos al cambiar certificado o ambiente.
  - **Datos que trae:** razón social (o apellido y nombre), tipo (JURIDICA →
    empresa, FISICA → persona), domicilio fiscal y condición de IVA. La
    regla del IVA es la de pyafipws: impuesto 32 → Exento; 30 (sin 33/34) →
    Responsable Inscripto; monotributo → Monotributista; si no, Consumidor
    Final. Si ARCA devuelve errores en la constancia, la condición de IVA NO
    se completa (puede faltar un bloque y la regla diría Consumidor Final sin
    serlo): se muestran los avisos y se elige a mano.
  - **"No existe persona con ese Id"** llega como SOAP fault con HTTP 500:
    se responde "ARCA no tiene a nadie con ese CUIT".
  - **El botón** aparece si el plan incluye `facturacionArca`. Si falta el
    certificado o el servicio no está habilitado, la API lo explica al tocarlo.
  - **Cada hotel tiene que habilitar el servicio en ARCA**, con el mismo
    certificado de facturar: Administrador de Relaciones de Clave Fiscal →
    Adherir servicio → ARCA → Webservices → "Servicio Consulta Constancia de
    Inscripción". Sin eso ARCA responde "Computador no autorizado a acceder
    al servicio" y la pantalla dice cómo habilitarlo.
  - **Preview y producción comparten el certificado del hotel.** Si uno de los
    dos pidió el ticket, el otro recibe `coe.alreadyAuthenticated` hasta que
    venza (máx. 12 h): la pantalla lo explica. Pasa igual con facturar.
  - **Probado sin ARCA:** el sandbox no llega a los servidores de ARCA. Se
    probó la lectura con respuestas armadas según el WSDL oficial (empresa
    RI, monotributista, exento, constancia con errores, CUIT inactiva,
    respuesta vacía, fault "No existe"). La primera consulta real se prueba
    en Preview con un hotel que tenga el certificado y el servicio habilitado.

## Pendiente de decidir (no bloquea)

- Límite de crédito: ¿bloquea la derivación o solo avisa?
- ¿Se puede anular un cargo derivado por error? (Por ahora no.)
- **Para CC-4:** si el huésped pagó una seña y el resto se derivó a una
  empresa, ¿cómo se factura? Hoy una reserva tiene UN solo comprobante.
  Opciones: una factura al huésped por la seña y otra a la empresa por lo
  derivado, o una sola a la empresa por el total.

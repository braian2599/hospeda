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

| Endpoint                                   | Qué hace                                   | Permiso                  |
|--------------------------------------------|--------------------------------------------|--------------------------|
| `POST /api/titulares`                      | Crear titular                              | comprobantes             |
| `GET /api/titulares`                       | Buscar/listar                              | comprobantes             |
| `GET /api/titulares/[id]`                  | Detalle, saldo, cargos y pagos             | comprobantes             |
| `POST /api/titulares/buscar-cuit`          | Consulta ARCA para autocompletar           | comprobantes             |
| `POST /api/reservas/[id]/cuenta-corriente` | Derivar el saldo completo a un titular     | reservas / checkin       |
| `POST /api/titulares/[id]/pagos`           | Cobrar (turno abierto + MovimientoCaja)    | comprobantes             |

`/api/reservas/[id]/comprobante` y `facturar-afip` usan los datos del titular
cuando la reserva tiene un cargo.

## Fases

- **CC-1 — Modelo de datos:** tablas, campos y migración.
- **CC-2 — Backend:** los endpoints.
- **CC-3 — Frontend:** pestaña Cuenta Corriente dentro de Comprobantes, botón
  en Reservas, pestaña "Datos fiscales" en Cliente.
- **CC-4 — Factura A:** tipo 1 en `afip/config.ts` y `wsfe.ts`, con la regla
  cruzada emisor/receptor.
- **CC-5 — Padrón de ARCA:** buscar por CUIT. Va último; mientras tanto se
  carga a mano. Reusa el certificado y el login WSAA que ya existen. Hay que
  verificar en la documentación de ARCA qué versión del padrón corresponde.

CC-1 a CC-3 ya dejan el sistema andando (anotar la deuda, cobrarla, ver el
saldo) sin tocar nada nuevo de ARCA.

## Cómo se trabaja

- Todo va a la rama `PREVIEW`. A `main` (que despliega a producción) recién
  cuando el dueño termine las pruebas y lo apruebe.
- Vercel despliega `PREVIEW` solo, con su propia URL.
- La base de datos es LA MISMA para Preview y Producción (`DATABASE_URL`
  apunta a las dos). Las pruebas se hacen con un hotel ficticio que ya existe
  en la base, sin tocar los demás. Decisión del dueño.
- Las migraciones se escriben a mano, idempotentes, y el SQL se pasa en el
  chat antes de correrlo. Las corre el dueño.
- Como la base es compartida, toda migración tiene que ser aditiva (tablas y
  columnas nuevas, opcionales): tiene que poder correrse con `main` en
  producción sin romper nada.

## Pendiente de decidir (no bloquea)

- Límite de crédito: ¿bloquea la derivación o solo avisa?
- ¿Se puede anular un cargo derivado por error? (Por ahora no.)

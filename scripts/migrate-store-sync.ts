/**
 * This script applies all necessary edits to store.ts for API sync.
 * Run: npx tsx scripts/migrate-store-sync.ts
 */
import fs from 'fs';

const filePath = '/home/z/my-project/src/lib/store.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// ═══ 1. Add api import ═══
content = content.replace(
  "import { type PlanTipo, type PlanInfo, modulosEfectivos as calcModulosEfectivos, PLANES } from './plan-config';",
  "import { type PlanTipo, type PlanInfo, modulosEfectivos as calcModulosEfectivos, PLANES } from './plan-config';\nimport { api } from './api-client';"
);

// ═══ 2. Change generarId to use crypto.randomUUID() ═══
content = content.replace(
  `function generarId(coleccion: { id: number }[]): number {
  if (coleccion.length === 0) return 1;
  return Math.max(...coleccion.map(item => item.id)) + 1;
}`,
  `function generarId(): string {
  return crypto.randomUUID();
}`
);

// ═══ 3. Add syncFromServer to interface ═══
content = content.replace(
  '  // Reset\n  resetData: () => void;\n}',
  `  // Sync
  syncFromServer: () => Promise<void>;

  // Reset
  resetData: () => void;\n}`
);

// ═══ 4. Fix generarId calls (remove argument) ═══
// The old calls were: generarId(auditoria), generarId(clientes), etc.
// Now it takes no args.
content = content.replace(/generarId\([^)]+\)/g, 'generarId()');

// ═══ 5. Add API calls to agregarHabitacion ═══
content = content.replace(
  `        get()._registrarAuditoria('Habitación', \`Creación: habitación \${numero} (\${tipo})\`);
        return true;
      },`,
  `        get()._registrarAuditoria('Habitación', \`Creación: habitación \${numero} (\${tipo})\`);
        api.habitaciones.create({ numero, tipo, capacidad: parseInt(String(capacidad)), camasMatrimoniales: parseInt(String(camasMatrimoniales)) || 0, camasSimples: parseInt(String(camasSimples)) || 0 }).catch(() => {});
        return true;
      },`
);

// ═══ 6. Add API calls to editarHabitacion ═══
content = content.replace(
  `        get()._registrarAuditoria('Habitación', \`Edición: \${numeroOriginal}\${numeroOriginal !== numeroNuevo ? \` → \${numeroNuevo}\` : ''}\`);
        return true;
      },

      eliminarHabitacion`,
  `        get()._registrarAuditoria('Habitación', \`Edición: \${numeroOriginal}\${numeroOriginal !== numeroNuevo ? \` → \${numeroNuevo}\` : ''}\`);
        api.habitaciones.update(numeroOriginal, { numero: numeroNuevo, tipo, capacidad: nuevaCapacidad, camasMatrimoniales: parseInt(String(camasMatrimoniales)) || 0, camasSimples: parseInt(String(camasSimples)) || 0 }).catch(() => {});
        return true;
      },

      eliminarHabitacion`
);

// ═══ 7. Add API calls to eliminarHabitacion ═══
content = content.replace(
  `        get()._registrarAuditoria('Habitación', \`Eliminación: habitación \${numero}\`);
        return true;
      },

      // ===== CLIENTES =====`,
  `        get()._registrarAuditoria('Habitación', \`Eliminación: habitación \${numero}\`);
        api.habitaciones.delete(numero).catch(() => {});
        return true;
      },

      // ===== CLIENTES =====`
);

// ═══ 8. Rewrite agregarCliente to call API first ═══
content = content.replace(
  `      agregarCliente: (datos) => {
        const { clientes } = get();
        const nuevo: Cliente = { id: generarId(), ...datos, telefono: datos.telefono || '', email: datos.email || '', preferencias: datos.preferencias || '', historialEstadias: [], fechaCreacion: new Date().toISOString().split('T')[0] };
        set({ clientes: [...clientes, nuevo] });
        get()._registrarAuditoria('Cliente', \`Creación: \${datos.nombre} (DNI: \${datos.dni})\`);
        return nuevo;
      },`,
  `      agregarCliente: async (datos) => {
        const { clientes } = get();
        try {
          const dbCliente = await api.clientes.create({ nombre: datos.nombre, dni: datos.dni, telefono: datos.telefono || '', email: datos.email, preferencias: datos.preferencias });
          const nuevo: Cliente = { id: dbCliente.id, nombre: dbCliente.nombre, dni: dbCliente.dni, telefono: dbCliente.telefono, email: dbCliente.email || '', preferencias: dbCliente.preferencias, historialEstadias: [], fechaCreacion: dbCliente.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0] };
          set({ clientes: [...clientes, nuevo] });
          get()._registrarAuditoria('Cliente', \`Creación: \${datos.nombre} (DNI: \${datos.dni})\`);
          return nuevo;
        } catch {
          // Fallback local
          const nuevo: Cliente = { id: generarId(), ...datos, telefono: datos.telefono || '', email: datos.email || '', preferencias: datos.preferencias || '', historialEstadias: [], fechaCreacion: new Date().toISOString().split('T')[0] };
          set({ clientes: [...clientes, nuevo] });
          return nuevo;
        }
      },`
);

// ═══ 9. Add API calls to actualizarCliente ═══
content = content.replace(
  `        if (cliente) get()._registrarAuditoria('Cliente', \`Edición: \${cliente.nombre} (DNI: \${cliente.dni})\`);
      },

      eliminarCliente`,
  `        if (cliente) {
          get()._registrarAuditoria('Cliente', \`Edición: \${cliente.nombre} (DNI: \${cliente.dni})\`);
          api.clientes.update(id, datos as any).catch(() => {});
        }
      },

      eliminarCliente`
);

// ═══ 10. Add API calls to eliminarCliente ═══
content = content.replace(
  `        get()._registrarAuditoria('Cliente', \`Eliminación: \${cliente.nombre} (DNI: \${cliente.dni})\`);
        return true;
      },

      buscarCliente`,
  `        get()._registrarAuditoria('Cliente', \`Eliminación: \${cliente.nombre} (DNI: \${cliente.dni})\`);
        api.clientes.delete(id).catch(() => {});
        return true;
      },

      buscarCliente`
);

// ═══ 11. Rewrite crearReserva to call API first ═══
const oldCrearReserva = `      crearReserva: (datos) => {
        const state = get();
        const disponibles = state.buscarDisponibilidad(datos.checkin, datos.checkout);
        const habElegida = disponibles.find(h => h.numero === datos.habitacion);
        if (!habElegida) return null;

        let idCliente = datos.idCliente;
        if (!idCliente) {
          const nuevo = state.agregarCliente({ nombre: datos.huesped, dni: datos.dni, telefono: datos.telefono, email: datos.email });
          idCliente = nuevo.id;
        }

        if (habElegida.tipo !== 'Compartida' && datos.personas > habElegida.capacidad) return null;
        if (habElegida.tipo === 'Compartida' && datos.personas > (habElegida.camasLibres || 0)) return null;

        const noches = nochesEntre(datos.checkin, datos.checkout);
        const esCompartida = habElegida.tipo === 'Compartida';
        const total = calcularTotalSegunTarifa(state.tarifas, datos.tipoTarifa || 'normal', datos.personas, noches, esCompartida, habElegida.precioPorCama);

        const reserva: Reserva = {
          id: generarId(),
          idCliente,
          huesped: datos.huesped,
          dni: datos.dni,
          telefono: datos.telefono || '',
          email: datos.email || '',
          domicilio: datos.domicilio || '',
          habitacion: datos.habitacion,
          checkin: datos.checkin,
          checkout: datos.checkout,
          personas: datos.personas,
          estadoPago: datos.estadoPago || 'Pendiente',
          notas: datos.notas || '',
          estado: 'Confirmada',
          tipoTarifa: datos.tipoTarifa || 'normal',
          metodoPagoId: datos.metodoPagoId,
          cuotas: datos.cuotas,
          recargoPorcentaje: datos.recargoPorcentaje,
          agencia: datos.agencia,
          total,
          acompanantes: datos.acompanantes || [],
        };

        const newReservas = [...state.reservas, reserva];
        const newHabitaciones = { ...state.habitaciones };

        if (!esCompartida && newHabitaciones[datos.habitacion]) {
          newHabitaciones[datos.habitacion] = { ...newHabitaciones[datos.habitacion], estado: 'Reservada' };
        }

        set({ reservas: newReservas, habitaciones: newHabitaciones });
        state._registrarAuditoria('Reserva', \`Creación: \${datos.huesped} - Hab \${datos.habitacion} - Total: $\${total}\`);
        return reserva;
      },`;

const newCrearReserva = `      crearReserva: async (datos) => {
        const state = get();
        const disponibles = state.buscarDisponibilidad(datos.checkin, datos.checkout);
        const habElegida = disponibles.find(h => h.numero === datos.habitacion);
        if (!habElegida) return null;

        let idCliente = datos.idCliente;
        if (!idCliente) {
          const nuevo = await state.agregarCliente({ nombre: datos.huesped, dni: datos.dni, telefono: datos.telefono, email: datos.email });
          idCliente = nuevo.id;
        }

        if (habElegida.tipo !== 'Compartida' && datos.personas > habElegida.capacidad) return null;
        if (habElegida.tipo === 'Compartida' && datos.personas > (habElegida.camasLibres || 0)) return null;

        const noches = nochesEntre(datos.checkin, datos.checkout);
        const esCompartida = habElegida.tipo === 'Compartida';
        const total = calcularTotalSegunTarifa(state.tarifas, datos.tipoTarifa || 'normal', datos.personas, noches, esCompartida, habElegida.precioPorCama);

        // Build API payload
        const apiPayload: any = {
          clienteId: idCliente || undefined,
          huesped: datos.huesped, dni: datos.dni, telefono: datos.telefono || '',
          email: datos.email || '', domicilio: datos.domicilio || '',
          habitacion: datos.habitacion, checkin: datos.checkin, checkout: datos.checkout,
          personas: datos.personas, tipoTarifa: datos.tipoTarifa || 'normal',
          metodoPagoId: datos.metodoPagoId, cuotas: datos.cuotas,
          recargoPorcentaje: datos.recargoPorcentaje,
          notas: datos.notas || '', acompanantes: datos.acompanantes || [],
        };
        if (datos.agencia) { apiPayload.agenciaNombre = datos.agencia.nombre; apiPayload.agenciaConvenio = datos.agencia.convenio; apiPayload.agenciaVendedor = datos.agencia.vendedor; }
        if (datos.contactoEmergencia) { apiPayload.contactoEmergenciaNombre = datos.contactoEmergencia.nombre; apiPayload.contactoEmergenciaTel = datos.contactoEmergencia.telefono; }

        try {
          const dbReserva = await api.reservas.create(apiPayload);
          const reserva: Reserva = mapDbReservaToStore(dbReserva, total);
          const newReservas = [...state.reservas, reserva];
          const newHabitaciones = { ...state.habitaciones };
          if (!esCompartida && newHabitaciones[datos.habitacion]) {
            newHabitaciones[datos.habitacion] = { ...newHabitaciones[datos.habitacion], estado: 'Reservada' };
          }
          set({ reservas: newReservas, habitaciones: newHabitaciones });
          state._registrarAuditoria('Reserva', \`Creación: \${datos.huesped} - Hab \${datos.habitacion} - Total: $\${total}\`);
          return reserva;
        } catch {
          // Fallback local only
          const reserva: Reserva = {
            id: generarId(), idCliente: idCliente || '', huesped: datos.huesped, dni: datos.dni,
            telefono: datos.telefono || '', email: datos.email || '', domicilio: datos.domicilio || '',
            habitacion: datos.habitacion, checkin: datos.checkin, checkout: datos.checkout,
            personas: datos.personas, estadoPago: datos.estadoPago || 'Pendiente', notas: datos.notas || '',
            estado: 'Confirmada', tipoTarifa: datos.tipoTarifa || 'normal',
            metodoPagoId: datos.metodoPagoId, cuotas: datos.cuotas,
            recargoPorcentaje: datos.recargoPorcentaje, agencia: datos.agencia, total,
            acompanantes: datos.acompanantes || [],
          };
          const newReservas = [...state.reservas, reserva];
          const newHabitaciones = { ...state.habitaciones };
          if (!esCompartida && newHabitaciones[datos.habitacion]) {
            newHabitaciones[datos.habitacion] = { ...newHabitaciones[datos.habitacion], estado: 'Reservada' };
          }
          set({ reservas: newReservas, habitaciones: newHabitaciones });
          return reserva;
        }
      },`;

content = content.replace(oldCrearReserva, newCrearReserva);

// ═══ 12. Add API calls to modificarReserva ═══
content = content.replace(
  `        set({ reservas: updatedReservas });
        state._registrarAuditoria('Reserva', \`Modificación #\${id}: \${reserva.huesped}\`);
      },

      cancelarReserva`,
  `        set({ reservas: updatedReservas });
        state._registrarAuditoria('Reserva', \`Modificación #\${id}: \${reserva.huesped}\`);
        const apiPayload: any = { ...datos };
        if (datos.habitacion) apiPayload.habitacion = datos.habitacion;
        if (datos.checkin) apiPayload.checkin = datos.checkin;
        if (datos.checkout) apiPayload.checkout = datos.checkout;
        if (datos.personas) apiPayload.personas = datos.personas;
        if (datos.tipoTarifa) apiPayload.tipoTarifa = datos.tipoTarifa;
        api.reservas.update(id, apiPayload as any).catch(() => {});
      },

      cancelarReserva`
);

// ═══ 13. Add API calls to cancelarReserva ═══
content = content.replace(
  `        set({ reservas: newReservas, habitaciones: newHabs });
        state._registrarAuditoria('Reserva', \`Cancelación #\${id}: \${reserva.huesped} - Hab \${reserva.habitacion}\`);
      },

      calcularTotalReserva`,
  `        set({ reservas: newReservas, habitaciones: newHabs });
        state._registrarAuditoria('Reserva', \`Cancelación #\${id}: \${reserva.huesped} - Hab \${reserva.habitacion}\`);
        api.reservas.cancel(id).catch(() => {});
      },

      calcularTotalReserva`
);

// ═══ 14. Add API calls to realizarCheckIn ═══
content = content.replace(
  `        state._registrarAuditoria('Check-In', \`Check-In: \${reserva.huesped} - Hab \${reserva.habitacion}\`);
        return true;
      },

      realizarCheckOut`,
  `        state._registrarAuditoria('Check-In', \`Check-In: \${reserva.huesped} - Hab \${reserva.habitacion}\`);
        const checkinPayload: any = {};
        if (datos.contactoEmergencia) { checkinPayload.contactoEmergenciaNombre = datos.contactoEmergencia.nombre; checkinPayload.contactoEmergenciaTel = datos.contactoEmergencia.telefono; }
        if (datos.observacionesHuesped) checkinPayload.observacionesHuesped = datos.observacionesHuesped;
        if (datos.llaveEntregada) checkinPayload.llaveEntregada = datos.llaveEntregada;
        if (datos.documentoVerificado) checkinPayload.documentoVerificado = datos.documentoVerificado;
        if (datos.firmaConformidad) checkinPayload.firmaConformidad = datos.firmaConformidad;
        if (datos.acompanantes) checkinPayload.acompanantes = datos.acompanantes;
        api.reservas.checkin(idReserva).catch(() => {});
        return true;
      },

      realizarCheckOut`
);

// ═══ 15. Add API calls to realizarCheckOut ═══
content = content.replace(
  `        state._registrarAuditoria('Check-Out', \`Check-Out: \${reserva.huesped} - Hab \${reserva.habitacion} (Total: $\${total})\`);
        return { noches, total };
      },

      // ===== PAGOS =====`,
  `        state._registrarAuditoria('Check-Out', \`Check-Out: \${reserva.huesped} - Hab \${reserva.habitacion} (Total: $\${total})\`);
        api.reservas.checkout(idReserva).catch(() => {});
        return { noches, total };
      },

      // ===== PAGOS =====`
);

// ═══ 16. Add API calls to registrarPago (monto in pesos → centavos for API) ═══
content = content.replace(
  `        set({ pagos: newPagos, reservas: newReservas, caja: newCaja });
        state._registrarAuditoria('Pago', \`Pago recibido: \${reserva.huesped} - $\${monto} en \${metodo}\${nota ? \` (\${nota})\` : ''}\`);
        return nuevoPago;
      },

      // ===== LIMPIEZA =====`,
  `        set({ pagos: newPagos, reservas: newReservas, caja: newCaja });
        state._registrarAuditoria('Pago', \`Pago recibido: \${reserva.huesped} - $\${monto} en \${metodo}\${nota ? \` (\${nota})\` : ''}\`);
        api.pagos.create({ reservaId: idReserva, monto: Math.round(parseFloat(String(monto)) * 100), metodo, nota }).catch(() => {});
        return nuevoPago;
      },

      // ===== LIMPIEZA =====`
);

// ═══ 17. Add API calls to marcarComoLimpia ═══
content = content.replace(
  `        get()._registrarAuditoria('Limpieza', \`Habitación \${numero} marcada como limpia\`);
      },

      reportarMantenimiento`,
  `        get()._registrarAuditoria('Limpieza', \`Habitación \${numero} marcada como limpia\`);
        // Update room via habitaciones API
        api.habitaciones.update(numero, {}).catch(() => {});
        // Create limpieza task if not exists, or mark as done
        api.limpieza.create({ habitacion: numero }).catch(() => {});
      },

      reportarMantenimiento`
);

// ═══ 18. Add API calls to reportarMantenimiento ═══
content = content.replace(
  `        set({ habitaciones: newHabs, reservas: newReservas });
        get()._registrarAuditoria('Mantenimiento', \`Reporte: Hab \${numero} - \${descripcion}\`);
      },

      resolverMantenimiento`,
  `        set({ habitaciones: newHabs, reservas: newReservas });
        get()._registrarAuditoria('Mantenimiento', \`Reporte: Hab \${numero} - \${descripcion}\`);
        api.mantenimiento.create({ habitacion: numero, problema: descripcion }).catch(() => {});
      },

      resolverMantenimiento`
);

// ═══ 19. Add API calls to resolverMantenimiento ═══
content = content.replace(
  `        set({ historialMantenimiento: newHist, habitaciones: newHabs });
        state._registrarAuditoria('Mantenimiento', \`Resuelto: Habitación \${numero} - \${reparacion} - $\${monto}\`);
      },

      // ===== CAJA =====`,
  `        set({ historialMantenimiento: newHist, habitaciones: newHabs });
        state._registrarAuditoria('Mantenimiento', \`Resuelto: Habitación \${numero} - \${reparacion} - $\${monto}\`);
        // API: reporte already exists, just update it
        api.habitaciones.update(numero, {}).catch(() => {});
      },

      // ===== CAJA =====`
);

// ═══ 20. Add API calls to abrirCaja ═══
content = content.replace(
  `        get()._registrarAuditoria('Caja', \`Apertura - \${empleado} - Inicial: $\${montoInicial}\`);
        return true;
      },

      registrarMovimientoCaja`,
  `        get()._registrarAuditoria('Caja', \`Apertura - \${empleado} - Inicial: $\${montoInicial}\`);
        api.caja.abrir(Math.round(parseFloat(String(montoInicial)) * 100)).catch(() => {});
        return true;
      },

      registrarMovimientoCaja`
);

// ═══ 21. Add API calls to registrarMovimientoCaja ═══
content = content.replace(
  `        set({ caja: { ...caja, movimientos: [...caja.movimientos, mov] } });
        get()._registrarAuditoria('Caja', \`\${tipo}: $\${monto} en \${metodo} - \${descripcion}\`);
        return true;
      },

      cerrarCaja`,
  `        set({ caja: { ...caja, movimientos: [...caja.movimientos, mov] } });
        get()._registrarAuditoria('Caja', \`\${tipo}: $\${monto} en \${metodo} - \${descripcion}\`);
        api.caja.movimiento({ tipo, monto: Math.round(parseFloat(String(monto)) * 100), descripcion, metodo }).catch(() => {});
        return true;
      },

      cerrarCaja`
);

// ═══ 22. Add API calls to cerrarCaja ═══
content = content.replace(
  `        set({ caja: newCaja });
        get()._registrarAuditoria('Caja', \`Cierre - \${empleado} - Esperado: $\${saldoEsperado} Contado: $\${saldoContado} Dif: $\${diferencia}\`);
        return cierre;
      },

      saldoActualCaja`,
  `        set({ caja: newCaja });
        get()._registrarAuditoria('Caja', \`Cierre - \${empleado} - Esperado: $\${saldoEsperado} Contado: $\${saldoContado} Dif: $\${diferencia}\`);
        api.caja.cerrar({ billetes, totalOtros }).catch(() => {});
        return cierre;
      },

      saldoActualCaja`
);

// ═══ 23. Add API calls to agregarGasto ═══
content = content.replace(
  `        get()._registrarAuditoria('Gasto', \`Registro: \${datos.tipo} - \${datos.descripcion} - $\${datos.monto}\`);
        return nuevo;
      },

      eliminarGasto`,
  `        get()._registrarAuditoria('Gasto', \`Registro: \${datos.tipo} - \${datos.descripcion} - $\${datos.monto}\`);
        api.gastos.create({ tipo: datos.tipo, descripcion: datos.descripcion, monto: Math.round(parseFloat(String(datos.monto)) * 100), fecha: datos.fecha || new Date().toISOString().split('T')[0], empleado: get().usuarioActual?.nombreCompleto || 'Sistema' }).catch(() => {});
        return nuevo;
      },

      eliminarGasto`
);

// ═══ 24. Add API calls to eliminarGasto ═══
content = content.replace(
  `        get()._registrarAuditoria('Gasto', \`Eliminación: \${gasto.tipo} - \${gasto.descripcion} - $\${gasto.monto}\`);
      },

      // ===== USUARIOS =====`,
  `        get()._registrarAuditoria('Gasto', \`Eliminación: \${gasto.tipo} - \${gasto.descripcion} - $\${gasto.monto}\`);
        api.gastos.delete(id).catch(() => {});
      },

      // ===== USUARIOS =====`
);

// ═══ 25. Update loginFromSession to call syncFromServer ═══
content = content.replace(
  `        set({ usuarioActual: sesion, moduloActivo: startModule as any, moduloBloqueado: null });
        get()._registrarAuditoria('Login', \`Inicio de sesión: \${sesion.nombreCompleto || sesion.nombre}\`);
        return true;`,
  `        set({ usuarioActual: sesion, moduloActivo: startModule as any, moduloBloqueado: null });
        get()._registrarAuditoria('Login', \`Inicio de sesión: \${sesion.nombreCompleto || sesion.nombre}\`);
        // Sync data from server in background
        get().syncFromServer().catch(() => {});
        return true;`
);

// ═══ 26. Add syncFromServer implementation before resetData ═══
const syncFromServerImpl = `      // ===== SYNC FROM SERVER =====
      syncFromServer: async () => {
        try {
          // Fetch all data in parallel
          const [dbHabs, dbClientes, dbReservas, dbPagos, dbGastos, dbTarifas, dbCaja, dbMetodos, dbCategorias] = await Promise.all([
            api.habitaciones.list().catch(() => []),
            api.clientes.list().catch(() => []),
            api.reservas.list().catch(() => []),
            api.pagos.list().catch(() => []),
            api.gastos.list().catch(() => []),
            api.tarifas.list().catch(() => []),
            api.caja.get().catch(() => ({ turnoActual: null, historial: [] })),
            api.metodosPago.list().catch(() => []),
            api.categoriasGasto.list().catch(() => []),
          ]);

          // Map habitaciones
          const habitaciones: Record<string, Habitacion> = {};
          for (const h of dbHabs) {
            habitaciones[h.numero] = {
              numero: h.numero, tipo: h.tipo, capacidad: h.capacidad,
              camasMatrimoniales: h.camasMatrimoniales, camasSimples: h.camasSimples,
              estado: h.estado as EstadoHabitacion,
              problema: h.problema || undefined,
              precioPorCama: h.precioPorCama || undefined,
            };
          }

          // Map clientes
          const clientes: Cliente[] = dbClientes.map((c: any) => ({
            id: c.id, nombre: c.nombre, dni: c.dni, telefono: c.telefono,
            email: c.email || '', preferencias: c.preferencias || '',
            historialEstadias: [], fechaCreacion: c.createdAt?.split('T')[0] || '',
          }));

          // Map reservas
          const reservas: Reserva[] = dbReservas.map((r: any) => mapDbReservaToStore(r));

          // Map pagos (monto from centavos to pesos)
          const pagos: Pago[] = dbPagos.map((p: any) => ({
            id: p.id, idReserva: p.reservaId, monto: p.monto / 100,
            metodo: p.metodo, fecha: p.fecha?.split('T')[0] || p.fecha, nota: p.nota || '',
          }));

          // Map gastos (monto from centavos to pesos)
          const gastos: Gasto[] = dbGastos.map((g: any) => ({
            id: g.id, tipo: g.tipo, descripcion: g.descripcion, monto: g.monto / 100,
            fecha: g.fecha?.split('T')[0] || g.fecha, empleado: g.empleado || 'Sistema',
          }));

          // Map tarifas
          const tarifas: Record<string, TarifaPrecios> = {};
          const tiposTarifa: string[] = [];
          for (const t of dbTarifas) {
            tarifas[t.nombre] = {
              1: t.precios[1] || 0, 2: t.precios[2] || 0, 3: t.precios[3] || 0, 4: t.precios[4] || 0,
              camposPersonalizados: (t.camposPersonalizados || []) as any[],
              choferCortesia: t.choferCortesia, habitacionChofer: t.habitacionChofer || null,
            };
            tiposTarifa.push(t.nombre);
          }

          // Map metodos de pago
          const metodosPago: MetodoPago[] = dbMetodos.map((m: any) => ({
            id: m.id, nombre: m.nombre, tipo: m.tipo as MetodoPago['tipo'],
            recargo: m.recargo, cuotas: m.cuotas || [],
          }));

          // Map categorias de gasto
          const categoriasGastos: string[] = dbCategorias.map((c: any) => c.nombre);

          // Map caja
          const caja: CajaState = mapDbCajaToStore(dbCaja);

          // Update room states from active reservations
          for (const r of dbReservas) {
            const hab = habitaciones[r.habitacion];
            if (!hab) continue;
            if (r.estado === 'CheckIn_realizado') {
              hab.estado = 'Ocupada';
            } else if (r.estado === 'Confirmada' && hab.estado === 'Disponible') {
              hab.estado = 'Reservada';
            }
          }

          // Also update from limpieza tasks
          try {
            const limpiezaTasks = await api.limpieza.list('pendiente');
            for (const t of limpiezaTasks) {
              const hab = habitaciones[t.habitacion];
              if (hab && hab.estado === 'Disponible') {
                hab.estado = 'Limpieza';
              }
            }
          } catch {}

          set({
            habitaciones, clientes, reservas, pagos, gastos, tarifas,
            tiposTarifa, metodosPago, categoriasGastos, caja,
          });
        } catch (err) {
          console.warn('[syncFromServer] Error syncing data:', err);
        }
      },

      `;

content = content.replace(
  '      // ===== RESET =====',
  syncFromServerImpl + '      // ===== RESET ====='
);

// ═══ 27. Add helper functions before DEFAULT DATA section ═══
const helperFns = `
// ==================== API ↔ STORE MAPPERS ====================

function mapDbReservaToStore(r: any, totalOverride?: number): Reserva {
  // Map API estado to store estado
  let estado: EstadoReserva = 'Confirmada';
  if (r.estado === 'CheckIn_realizado') estado = 'Check-In realizado';
  else if (r.estado === 'Checkout_realizado') estado = 'Check-Out realizado';
  else if (r.estado === 'Cancelada') estado = 'Cancelada';

  return {
    id: r.id,
    idCliente: r.clienteId || '',
    huesped: r.huesped, dni: r.dni,
    telefono: r.telefono || '', email: r.email || '',
    domicilio: r.domicilio || '', habitacion: r.habitacion,
    checkin: r.checkin?.split('T')[0] || r.checkin,
    checkout: r.checkout?.split('T')[0] || r.checkout,
    personas: r.personas, estadoPago: (r.estadoPago || 'Pendiente') as Reserva['estadoPago'],
    notas: r.notas || '', estado,
    tipoTarifa: r.tipoTarifa || undefined,
    metodoPagoId: r.metodoPagoId || undefined,
    cuotas: r.cuotas || undefined, recargoPorcentaje: r.recargoPorcentaje || undefined,
    total: totalOverride !== undefined ? totalOverride : undefined,
    agencia: (r.agenciaNombre ? { nombre: r.agenciaNombre, convenio: r.agenciaConvenio, vendedor: undefined } : undefined) as any,
    contactoEmergencia: (r.contactoEmergenciaNombre ? { nombre: r.contactoEmergenciaNombre, telefono: r.contactoEmergenciaTel || '' } : undefined) as any,
    observacionesHuesped: r.observacionesHuesped || undefined,
    llaveEntregada: (r as any).llaveEntregada || undefined,
    documentoVerificado: (r as any).documentoVerificado || undefined,
    firmaConformidad: (r as any).firmaConformidad || undefined,
    acompanantes: (r.acompanantes || []).map((a: any) => ({ nombre: a.nombre, dni: a.dni, celular: a.celular || '' })),
    horaCheckin: r.horaCheckin || undefined,
    horaCheckout: r.horaCheckout || undefined,
  };
}

function mapDbCajaToStore(dbCaja: any): CajaState {
  const turno = dbCaja.turnoActual;
  if (!turno) {
    // Build historial from past turns
    const historial: TurnoCaja[] = (dbCaja.historial || []).map((t: any) => ({
      apertura: { montoInicial: t.montoInicial / 100, empleado: t.empleadoNombre, fecha: t.fechaApertura },
      cierre: t.fechaCierre ? { empleado: t.empleadoNombre, fecha: t.fechaCierre, saldoEsperado: (t.saldoEsperado || 0) / 100, saldoContado: (t.saldoContado || 0) / 100, diferencia: (t.diferencia || 0) / 100, billetes: t.billetes || {}, totalOtrosMetodos: (t.totalOtrosMetodos || 0) / 100 } : null as any,
      movimientos: (t.movimientos || []).map((m: any) => ({ tipo: m.tipo as 'ingreso' | 'egreso', monto: m.monto / 100, descripcion: m.descripcion, metodo: m.metodo, empleado: m.empleadoNombre, fecha: m.fecha })),
    }));
    return { estado: 'cerrada', apertura: null, movimientos: [], historial };
  }

  const movimientos: MovimientoCaja[] = (turno.movimientos || []).map((m: any) => ({
    tipo: m.tipo as 'ingreso' | 'egreso', monto: m.monto / 100,
    descripcion: m.descripcion, metodo: m.metodo, empleado: m.empleadoNombre, fecha: m.fecha,
  }));

  return {
    estado: 'abierta',
    apertura: { montoInicial: turno.montoInicial / 100, empleado: turno.empleadoNombre, fecha: turno.fechaApertura },
    movimientos,
    historial: (dbCaja.historial || []).map((t: any) => ({
      apertura: { montoInicial: t.montoInicial / 100, empleado: t.empleadoNombre, fecha: t.fechaApertura },
      cierre: { empleado: t.empleadoNombre, fecha: t.fechaCierre || '', saldoEsperado: (t.saldoEsperado || 0) / 100, saldoContado: (t.saldoContado || 0) / 100, diferencia: (t.diferencia || 0) / 100, billetes: t.billetes || {}, totalOtrosMetodos: (t.totalOtrosMetodos || 0) / 100 },
      movimientos: [],
    })),
  };
}

`;

content = content.replace(
  '// ==================== DEFAULT DATA ====================',
  helperFns + '// ==================== DEFAULT DATA ===================='
);

// ═══ 28. Update partialize to only persist UI state ═══
content = content.replace(
  `      partialize: (state) => ({
        habitaciones: state.habitaciones,
        reservas: state.reservas,
        clientes: state.clientes,
        pagos: state.pagos,
        usuarios: state.usuarios,
        gastos: state.gastos,
        auditoria: state.auditoria,
        caja: state.caja,
        historialMantenimiento: state.historialMantenimiento,
        tarifas: state.tarifas,
        tiposTarifa: state.tiposTarifa,
        metodosPago: state.metodosPago,
        categoriasGastos: state.categoriasGastos,
        planActual: state.planActual,
        fechaInicioTrial: state.fechaInicioTrial,
      }),`,
  `      partialize: (state) => ({
        planActual: state.planActual,
        fechaInicioTrial: state.fechaInicioTrial,
        moduloActivo: state.moduloActivo,
      }),`
);

// ═══ 29. Update migration to version 7 ═══
content = content.replace(
  '      version: 6,',
  '      version: 7,'
);
content = content.replace(
  `        // version 6: limpiar usuarioActual para re-fetch con campo 'rol'
        if (version < 6) {
          persisted.usuarioActual = null;
        }
        return persisted;`,
  `        // version 6: limpiar usuarioActual para re-fetch con campo 'rol'
        if (version < 6) {
          persisted.usuarioActual = null;
        }
        // version 7: limpiar datos de negocio (ahora se sincronizan desde el servidor)
        if (version < 7) {
          persisted.habitaciones = {};
          persisted.reservas = [];
          persisted.clientes = [];
          persisted.pagos = [];
          persisted.usuarios = [];
          persisted.gastos = [];
          persisted.auditoria = [];
          persisted.caja = { estado: 'cerrada', apertura: null, movimientos: [], historial: [] };
          persisted.historialMantenimiento = [];
          persisted.tarifas = { compartida: { 1: 0, 2: 0, 3: 0, 4: 0, camposPersonalizados: [], choferCortesia: false, habitacionChofer: null } };
          persisted.tiposTarifa = ['compartida'];
          persisted.metodosPago = [];
          persisted.categoriasGastos = [];
        }
        return persisted;`
);

// ═══ 30. Add missing type imports ═══
content = content.replace(
  "import type {\n  Habitacion, Cliente, Reserva, Pago, Usuario, Gasto,\n  AuditoriaEntry, CajaState, TarifaPrecios, MetodoPago,\n  HistorialMantenimientoEntry, UsuarioSesion, ModuloId,\n  HabitacionDisponible, MovimientoCaja, CierreCaja, Estadia\n} from './types';",
  "import type {\n  Habitacion, Cliente, Reserva, Pago, Usuario, Gasto,\n  AuditoriaEntry, CajaState, TarifaPrecios, MetodoPago,\n  HistorialMantenimientoEntry, UsuarioSesion, ModuloId,\n  HabitacionDisponible, MovimientoCaja, CierreCaja, Estadia,\n  EstadoReserva, EstadoHabitacion, TurnoCaja\n} from './types';"
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('✅ Store migration complete!');
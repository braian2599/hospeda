import { PrismaClient, PlanType } from '@prisma/client';
import { PLANES } from '../src/lib/plan-config';

const prisma = new PrismaClient();

// Crea los planes que falten en una base nueva.
//
// LOS PLANES SALEN DE src/lib/plan-config.ts, no de una copia acá. Antes este
// archivo tenía su propia lista, y se quedó atrás sin que nadie se enterara:
// seguía diciendo 'facturacion' cuando el módulo ya se llamaba
// 'comprobantes', con otros límites y sin el plan Elite. Una base sembrada con
// eso dejaba Comprobantes bloqueado en todos los planes.
//
// SOLO CREA LOS QUE FALTAN, nunca pisa uno existente. En una base con uso, los
// planes se editan desde Super Admin (precios, módulos, integraciones): correr
// el seed ahí no tiene que deshacer nada de eso.
async function main() {
  console.log('🌱 Seeding database...');

  for (const info of Object.values(PLANES)) {
    const existe = await prisma.plan.findUnique({ where: { type: info.tipo as PlanType }, select: { id: true } });
    if (existe) {
      console.log(`  · Plan "${info.nombre}" ya existe: no se toca`);
      continue;
    }
    await prisma.plan.create({
      data: {
        type: info.tipo as PlanType,
        nombre: info.nombre,
        precioMensual: info.precio,
        maxHabitaciones: info.maxHabitaciones,
        maxUsuarios: info.maxUsuarios,
        maxTarifas: info.maxTarifas,
        maxReservasMes: info.maxReservasMes,
        modulos: info.modulos,
        // Todas apagadas (así están en plan-config a propósito): qué
        // integración trae cada plan se decide en Super Admin.
        featureFlags: info.featureFlags,
        activo: info.activo,
      },
    });
    console.log(`  ✓ Plan "${info.nombre}" creado`);
  }

  console.log('✅ Seed completado');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

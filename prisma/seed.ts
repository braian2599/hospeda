import { PrismaClient, PlanType } from '@prisma/client';

const prisma = new PrismaClient();

const MODULOS_BASICOS = [
  'dashboard', 'habitaciones', 'reservas', 'checkin',
  'limpieza', 'clientes', 'tarifas',
];

const MODULOS_PROFESIONAL = [
  'dashboard', 'habitaciones', 'reservas', 'checkin',
  'facturacion', 'limpieza', 'caja', 'clientes', 'reportes', 'tarifas',
];

const MODULOS_PREMIUM = [
  'dashboard', 'habitaciones', 'reservas', 'checkin',
  'facturacion', 'limpieza', 'caja', 'clientes', 'reportes', 'usuarios', 'tarifas',
];

async function main() {
  console.log('🌱 Seeding database...');

  // ── Planes ──
  const planes = [
    {
      type: 'trial' as PlanType,
      nombre: 'Prueba Gratuita',
      precioMensual: 0,
      maxHabitaciones: 999,
      maxUsuarios: 5,
      maxTarifas: 999,
      maxReservasMes: 0, // ilimitado
      modulos: MODULOS_PREMIUM, // trial tiene todo
    },
    {
      type: 'basico' as PlanType,
      nombre: 'Básico',
      precioMensual: 15000, // $15.000 ARS
      maxHabitaciones: 10,
      maxUsuarios: 2,
      maxTarifas: 2,
      maxReservasMes: 100,
      modulos: MODULOS_BASICOS,
    },
    {
      type: 'profesional' as PlanType,
      nombre: 'Profesional',
      precioMensual: 35000, // $35.000 ARS
      maxHabitaciones: 50,
      maxUsuarios: 5,
      maxTarifas: 10,
      maxReservasMes: 1000,
      modulos: MODULOS_PROFESIONAL,
    },
    {
      type: 'premium' as PlanType,
      nombre: 'Premium',
      precioMensual: 65000, // $65.000 ARS
      maxHabitaciones: 0,   // ilimitado (0 = sin límite)
      maxUsuarios: 0,
      maxTarifas: 0,
      maxReservasMes: 0,   // ilimitado
      modulos: MODULOS_PREMIUM,
    },
  ];

  for (const plan of planes) {
    await prisma.plan.upsert({
      where: { type: plan.type },
      update: plan,
      create: plan,
    });
    console.log(`  ✓ Plan "${plan.nombre}" creado/actualizado`);
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
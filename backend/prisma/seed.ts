import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function seed() {
  await prisma.applicationMetadata.upsert({
    where: { key: 'application' },
    create: { key: 'application', value: 'porfin-carteles' },
    update: {},
  });
}

void seed().catch(() => {
  console.error('No se pudo ejecutar el seed. Revisá la conexión y las migraciones.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());

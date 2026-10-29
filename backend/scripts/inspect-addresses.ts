import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const addresses = await prisma.address.findMany({
    include: { user: { select: { email: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`FOUND ${addresses.length} ADDRESSES:`);
  console.log(JSON.stringify(addresses, null, 2));
}

main().finally(() => prisma.$disconnect());


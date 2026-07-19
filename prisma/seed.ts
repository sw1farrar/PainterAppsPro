import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Dynamic import of seed helpers would circular-import; inline bootstrap
  const { ensureSeeded } = await import("../src/lib/seed");
  await ensureSeeded();
  console.log("✓ Seed complete — demo customer + estimate ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

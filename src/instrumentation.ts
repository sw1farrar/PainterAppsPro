export async function register() {
  // Warm seed check + DB connection once at Node server boot so the first
  // navigation does not pay for 3–4 remote seed queries.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("@/lib/db");
    const { ensureSeeded } = await import("@/lib/seed");
    await prisma.$connect();
    await ensureSeeded();
  }
}

import { cleanupExpiredPets } from "@/server/blob-store";
import { createCronHandler, writeRequestLog } from "@/server/handlers";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createCronHandler({
  cronSecret: process.env.CRON_SECRET ?? "",
  cleanup: cleanupExpiredPets,
  log: writeRequestLog,
});

export const GET = handler;

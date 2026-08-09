import { createLookupHandler, writeRequestLog } from "@/server/handlers";
import { fetchCharacter } from "@/server/nexon-client";

const handler = createLookupHandler({
  fetchCharacter: (name) =>
    fetchCharacter(name, { apiKey: process.env.NEXON_API_KEY ?? "" }),
  log: writeRequestLog,
});

export const POST = handler;

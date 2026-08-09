import { publishSpritesheet } from "@/server/blob-store";
import { createPetHandler, writeRequestLog } from "@/server/handlers";
import { fetchCharacter } from "@/server/nexon-client";
import { generateSpritesheet } from "@/server/pet-generator";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createPetHandler({
  fetchCharacter: (name, signal) =>
    fetchCharacter(name, {
      apiKey: process.env.NEXON_API_KEY ?? "",
      signal,
    }),
  generateSpritesheet,
  publishSpritesheet: (png, signal) => publishSpritesheet(png, { signal }),
  log: writeRequestLog,
});

export const POST = handler;

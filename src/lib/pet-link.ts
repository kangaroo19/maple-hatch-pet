import { internalError } from "@/lib/errors";

export function buildPetDeepLink(input: {
  name: string;
  imageUrl: string;
  description: string;
}): string {
  if (!input.name.trim()) throw internalError();
  let imageUrl: URL;
  try {
    imageUrl = new URL(input.imageUrl);
  } catch {
    throw internalError();
  }
  if (imageUrl.protocol !== "https:") throw internalError();
  const params = new URLSearchParams({
    name: input.name,
    imageUrl: imageUrl.href,
    description: input.description,
    spriteVersionNumber: "1",
  });
  return `codex://pets/install?${params.toString()}`;
}

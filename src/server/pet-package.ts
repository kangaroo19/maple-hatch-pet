import AdmZip from "adm-zip";

import { internalError } from "@/lib/errors";

export const PET_PACKAGE_PREFIX = "pet-packages/";
export const MAX_PET_PACKAGE_BYTES = 25 * 1024 * 1024;
export const MAX_SPRITESHEET_BYTES = 20 * 1024 * 1024;

const PET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PetManifest = {
  id: string;
  displayName: string;
  description: string;
  spriteVersionNumber: 1;
  spritesheetPath: "spritesheet.png";
};

export function isPetId(value: string): boolean {
  return PET_ID_PATTERN.test(value);
}

export function petPackagePath(petId: string): string {
  return `${PET_PACKAGE_PREFIX}${petId}.codex-pet.zip`;
}

export function createPetPackage(input: {
  petId: string;
  displayName: string;
  description: string;
  spritesheet: Buffer;
}): Buffer {
  try {
    if (
      !isPetId(input.petId) ||
      !input.displayName.trim() ||
      !input.description.trim() ||
      input.spritesheet.length > MAX_SPRITESHEET_BYTES ||
      input.spritesheet.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    ) {
      throw new Error();
    }
    const manifest: PetManifest = {
      id: input.petId,
      displayName: input.displayName,
      description: input.description,
      spriteVersionNumber: 1,
      spritesheetPath: "spritesheet.png",
    };
    const manifestBytes = Buffer.from(
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    const zip = new AdmZip();
    zip.addFile("pet.json", manifestBytes);
    zip.addFile("spritesheet.png", input.spritesheet);
    const result = zip.toBuffer();
    if (result.length > MAX_PET_PACKAGE_BYTES) throw new Error();

    const verified = new AdmZip(result);
    const entries = verified.getEntries();
    if (
      entries.length !== 2 ||
      entries.some((entry) => entry.isDirectory) ||
      entries
        .map((entry) => entry.entryName)
        .sort()
        .join(",") !== "pet.json,spritesheet.png" ||
      !verified.readFile("pet.json")?.equals(manifestBytes) ||
      !verified.readFile("spritesheet.png")?.equals(input.spritesheet)
    ) {
      throw new Error();
    }
    return result;
  } catch {
    throw internalError("Pet 설치 패키지를 만들지 못했습니다.");
  }
}

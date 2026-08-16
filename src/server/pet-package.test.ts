// @vitest-environment node

import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";

import { createPetPackage, petPackagePath } from "@/server/pet-package";

const petId = "12345678-1234-4234-9234-123456789abc";
const png = Buffer.from("89504e470d0a1a0a00000000", "hex");

describe("Pet package", () => {
  it("creates the exact Codex Pet archive contract", () => {
    const packageBytes = createPetPackage({
      petId,
      displayName: "천짱",
      description: "스카니아 마법사 캐릭터",
      spritesheet: png,
    });
    const zip = new AdmZip(packageBytes);

    expect(
      zip
        .getEntries()
        .map((entry) => entry.entryName)
        .sort(),
    ).toEqual(["pet.json", "spritesheet.png"]);
    expect(JSON.parse(zip.readAsText("pet.json"))).toEqual({
      id: petId,
      displayName: "천짱",
      description: "스카니아 마법사 캐릭터",
      spriteVersionNumber: 1,
      spritesheetPath: "spritesheet.png",
    });
    expect(zip.readFile("spritesheet.png")).toEqual(png);
    expect(petPackagePath(petId)).toBe(`pet-packages/${petId}.codex-pet.zip`);
  });

  it("rejects an invalid id before publishing", () => {
    expect(() =>
      createPetPackage({
        petId: "../escape",
        displayName: "천짱",
        description: "테스트",
        spritesheet: png,
      }),
    ).toThrow("INTERNAL_ERROR");
  });
});

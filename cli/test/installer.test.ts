import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import AdmZip from "adm-zip";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import { CliError, SERVICE_ORIGIN, validatePackage } from "../src/contract.js";
import { installPet } from "../src/installer.js";

const petId = "12345678-1234-4234-9234-123456789abc";

function validPackage(id = petId): Buffer {
  const image = new PNG({ width: 1536, height: 1872, colorType: 6 });
  image.data[0] = 255;
  image.data[3] = 255;
  const manifest = {
    id,
    displayName: "천짱",
    description: "스카니아 마법사 캐릭터",
    spriteVersionNumber: 1,
    spritesheetPath: "spritesheet.png",
  };
  const zip = new AdmZip();
  zip.addFile(
    "pet.json",
    Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
  );
  zip.addFile("spritesheet.png", PNG.sync.write(image));
  return zip.toBuffer();
}

function response(bytes: Buffer): Response {
  return new Response(bytes, {
    headers: {
      "content-length": String(bytes.length),
      "content-type": "application/zip",
    },
  });
}

describe("installPet", () => {
  it("installs only the two validated files at the Codex Pet path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "maple-cli-test-"));
    const bytes = validPackage();
    let requested = "";
    const destination = await installPet(petId, {
      homeDirectory: path.join(root, "home"),
      temporaryDirectory: root,
      fetchImpl: async (input) => {
        requested = String(input);
        return response(bytes);
      },
    });

    expect(requested).toBe(`${SERVICE_ORIGIN}/api/pets/${petId}/package`);
    expect(destination).toEqual({
      destination: path.join(root, "home", ".codex", "pets", petId),
      replaced: false,
    });
    expect(
      JSON.parse(
        await readFile(path.join(destination.destination, "pet.json"), "utf8"),
      ),
    ).toMatchObject({ id: petId, spritesheetPath: "spritesheet.png" });
    expect(
      (await readFile(path.join(destination.destination, "spritesheet.png")))
        .length,
    ).toBeGreaterThan(0);
  });

  it("replaces the same id safely after validation", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "maple-cli-test-"));
    const destination = path.join(root, "home", ".codex", "pets", petId);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "old.txt"), "old");

    const result = await installPet(petId, {
      homeDirectory: path.join(root, "home"),
      temporaryDirectory: root,
      fetchImpl: async () => response(validPackage()),
    });

    expect(result.replaced).toBe(true);
    await expect(readFile(path.join(destination, "old.txt"))).rejects.toThrow();
    await expect(
      readFile(path.join(destination, "pet.json")),
    ).resolves.toBeDefined();
  });

  it("preserves an existing Pet when the package is invalid", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "maple-cli-test-"));
    const destination = path.join(root, "home", ".codex", "pets", petId);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "old.txt"), "keep");

    await expect(
      installPet(petId, {
        homeDirectory: path.join(root, "home"),
        temporaryDirectory: root,
        fetchImpl: async () => response(Buffer.from("not-a-zip")),
      }),
    ).rejects.toMatchObject<Partial<CliError>>({ exitCode: 5 });
    await expect(
      readFile(path.join(destination, "old.txt"), "utf8"),
    ).resolves.toBe("keep");
  });

  it("rejects an invalid id before making a request", async () => {
    let requested = false;
    await expect(
      installPet("../escape", {
        fetchImpl: async () => {
          requested = true;
          return new Response();
        },
      }),
    ).rejects.toMatchObject<Partial<CliError>>({ exitCode: 2 });
    expect(requested).toBe(false);
  });

  it("rejects a ZIP entry outside the exact package root", () => {
    const zip = new AdmZip(validPackage());
    zip.addFile("unexpected.txt", Buffer.from("escape"));

    expect(() => validatePackage(zip.toBuffer(), petId)).toThrow(
      "파일 구성이 올바르지 않습니다",
    );
  });
});

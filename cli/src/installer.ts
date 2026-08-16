import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";

import {
  assertPetId,
  CliError,
  MAX_PACKAGE_BYTES,
  SERVICE_ORIGIN,
  validatePackage,
} from "./contract.js";

async function downloadPackage(
  petId: string,
  fetchImpl: typeof fetch,
): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetchImpl(`${SERVICE_ORIGIN}/api/pets/${petId}/package`, {
      redirect: "manual",
    });
  } catch {
    throw new CliError(4, "Pet 패키지를 내려받지 못했습니다.");
  }
  if (response.status === 404)
    throw new CliError(3, "Pet 패키지를 찾을 수 없거나 만료되었습니다.");
  if (!response.ok || !response.body)
    throw new CliError(4, "Pet 패키지를 내려받지 못했습니다.");
  if (response.headers.get("content-type") !== "application/zip")
    throw new CliError(5, "Pet 패키지 응답 형식이 올바르지 않습니다.");
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_PACKAGE_BYTES)
    throw new CliError(5, "Pet 패키지 크기 제한을 초과했습니다.");

  const chunks: Buffer[] = [];
  let size = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PACKAGE_BYTES) {
      await reader.cancel();
      throw new CliError(5, "Pet 패키지 크기 제한을 초과했습니다.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

export async function installPet(
  petId: string,
  dependencies: {
    fetchImpl?: typeof fetch;
    homeDirectory?: string;
    temporaryDirectory?: string;
  } = {},
): Promise<{ destination: string; replaced: boolean }> {
  assertPetId(petId);
  const temporaryRoot = await mkdtemp(
    path.join(dependencies.temporaryDirectory ?? tmpdir(), "maple-hatch-pet-"),
  );
  const petsDirectory = path.join(
    dependencies.homeDirectory ?? homedir(),
    ".codex",
    "pets",
  );
  const destination = path.join(petsDirectory, petId);
  const suffix = randomUUID();
  const staging = path.join(petsDirectory, `.${petId}.staging-${suffix}`);
  const backup = path.join(petsDirectory, `.${petId}.backup-${suffix}`);
  let backedUp = false;
  try {
    const downloaded = await downloadPackage(
      petId,
      dependencies.fetchImpl ?? fetch,
    );
    const downloadPath = path.join(temporaryRoot, "package.zip");
    await writeFile(downloadPath, downloaded, { flag: "wx" });
    const validated = validatePackage(await readFile(downloadPath), petId);

    await mkdir(petsDirectory, { recursive: true });
    await mkdir(staging);
    await writeFile(
      path.join(staging, "pet.json"),
      `${JSON.stringify(validated.manifest, null, 2)}\n`,
      { flag: "wx" },
    );
    await writeFile(
      path.join(staging, "spritesheet.png"),
      validated.spritesheet,
      {
        flag: "wx",
      },
    );
    try {
      await rename(destination, backup);
      backedUp = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    try {
      await rename(staging, destination);
    } catch (error) {
      if (backedUp) await rename(backup, destination);
      throw error;
    }
    if (backedUp) await rm(backup, { recursive: true, force: true });
    return { destination, replaced: backedUp };
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(6, "Codex Pet 폴더에 설치하지 못했습니다.");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
    await rm(staging, { recursive: true, force: true }).catch(() => {});
  }
}

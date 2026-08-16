import AdmZip from "adm-zip";
import { PNG } from "pngjs";

export const SERVICE_ORIGIN = "https://maple-hatch-pet.vercel.app";
export const MAX_PACKAGE_BYTES = 25 * 1024 * 1024;
const MAX_SPRITESHEET_BYTES = 20 * 1024 * 1024;
const PET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PetManifest = {
  id: string;
  displayName: string;
  description: string;
  spriteVersionNumber: 1;
  spritesheetPath: "spritesheet.png";
};

export class CliError extends Error {
  constructor(
    public readonly exitCode: number,
    message: string,
  ) {
    super(message);
    this.name = "CliError";
  }
}

export function assertPetId(value: string): void {
  if (!PET_ID_PATTERN.test(value))
    throw new CliError(2, "올바른 Pet ID를 입력해 주세요.");
}

function validateEntry(entry: AdmZip.IZipEntry): void {
  const name = entry.entryName;
  const unixMode = (entry.attr >>> 16) & 0xffff;
  const fileType = unixMode & 0xf000;
  if (
    entry.isDirectory ||
    name.includes("/") ||
    name.includes("\\") ||
    name === "." ||
    name === ".." ||
    (fileType !== 0 && fileType !== 0x8000)
  ) {
    throw new CliError(5, "안전하지 않은 Pet 패키지입니다.");
  }
}

export function validatePackage(
  packageBytes: Buffer,
  expectedPetId: string,
): { manifest: PetManifest; spritesheet: Buffer } {
  if (packageBytes.length > MAX_PACKAGE_BYTES)
    throw new CliError(5, "Pet 패키지 크기 제한을 초과했습니다.");
  try {
    const zip = new AdmZip(packageBytes);
    const entries = zip.getEntries();
    entries.forEach(validateEntry);
    if (
      entries.length !== 2 ||
      entries
        .map((entry) => entry.entryName)
        .sort()
        .join(",") !== "pet.json,spritesheet.png"
    ) {
      throw new CliError(5, "Pet 패키지 파일 구성이 올바르지 않습니다.");
    }
    if (
      entries.reduce((total, entry) => total + entry.header.size, 0) >
      MAX_PACKAGE_BYTES
    ) {
      throw new CliError(5, "Pet 패키지 압축 해제 크기를 초과했습니다.");
    }
    const manifestBytes = zip.readFile("pet.json");
    const spritesheet = zip.readFile("spritesheet.png");
    if (!manifestBytes || !spritesheet)
      throw new CliError(5, "Pet 패키지 파일이 누락되었습니다.");
    if (spritesheet.length > MAX_SPRITESHEET_BYTES)
      throw new CliError(5, "Pet 이미지 크기 제한을 초과했습니다.");

    const manifest = JSON.parse(manifestBytes.toString("utf8")) as unknown;
    if (!manifest || typeof manifest !== "object" || Array.isArray(manifest))
      throw new CliError(5, "pet.json이 올바르지 않습니다.");
    const value = manifest as Record<string, unknown>;
    const keys = Object.keys(value).sort();
    if (
      keys.join(",") !==
        "description,displayName,id,spriteVersionNumber,spritesheetPath" ||
      value.id !== expectedPetId ||
      typeof value.displayName !== "string" ||
      value.displayName.length === 0 ||
      typeof value.description !== "string" ||
      value.description.length === 0 ||
      value.spriteVersionNumber !== 1 ||
      value.spritesheetPath !== "spritesheet.png"
    ) {
      throw new CliError(5, "pet.json 계약이 올바르지 않습니다.");
    }
    const canonical = `${JSON.stringify(value, null, 2)}\n`;
    if (manifestBytes.toString("utf8") !== canonical)
      throw new CliError(5, "pet.json 형식이 올바르지 않습니다.");

    const decoded = PNG.sync.read(spritesheet);
    if (decoded.width !== 1536 || decoded.height !== 1872)
      throw new CliError(5, "Pet 이미지 크기가 올바르지 않습니다.");
    let hasTransparentPixel = false;
    let hasVisiblePixel = false;
    for (let index = 3; index < decoded.data.length; index += 4) {
      const alpha = decoded.data[index]!;
      hasTransparentPixel ||= alpha === 0;
      hasVisiblePixel ||= alpha > 0;
      if (hasTransparentPixel && hasVisiblePixel) break;
    }
    if (!hasTransparentPixel || !hasVisiblePixel)
      throw new CliError(
        5,
        "Pet 이미지는 투명 배경과 캐릭터를 포함해야 합니다.",
      );
    return { manifest: value as PetManifest, spritesheet };
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(5, "Pet 패키지를 검증하지 못했습니다.");
  }
}

#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import path from "node:path";

import { CliError } from "./contract.js";
import { installPet } from "./installer.js";

export async function main(args: string[]): Promise<number> {
  if (args.length !== 2 || args[0] !== "add") {
    console.error("사용법: npx maple-hatch-pet add <petId>");
    return 2;
  }
  try {
    const { destination, replaced } = await installPet(args[1]!);
    console.log(`${replaced ? "Pet 재설치" : "Pet 설치"} 완료: ${destination}`);
    console.log("Codex 데스크톱의 Settings > Pets에서 Refresh를 눌러 주세요.");
    return 0;
  } catch (error) {
    if (error instanceof CliError) {
      console.error(error.message);
      return error.exitCode;
    }
    console.error("예상하지 못한 오류가 발생했습니다.");
    return 1;
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  process.exitCode = await main(process.argv.slice(2));
}

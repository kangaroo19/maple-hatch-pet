import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const resultPath = process.argv[2];
assert.ok(resultPath, "npm pack JSON 경로가 필요합니다.");
const [packageInfo] = JSON.parse(await readFile(resultPath, "utf8"));
assert.ok(packageInfo, "npm pack 결과가 없습니다.");

const actual = packageInfo.files.map(({ path }) => path).sort();
const expected = [
  "LICENSE",
  "README.md",
  "dist/contract.js",
  "dist/index.js",
  "dist/installer.js",
  "package.json",
];
assert.deepEqual(actual, expected, "npm 패키지 파일 구성이 올바르지 않습니다.");

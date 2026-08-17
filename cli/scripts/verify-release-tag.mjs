import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tag = process.argv[2] ?? "";
assert.match(tag, /^cli-v\d+\.\d+\.\d+$/, `잘못된 CLI 릴리스 태그: ${tag}`);

const manifest = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
assert.equal(
  tag,
  `cli-v${manifest.version}`,
  `태그 ${tag}와 패키지 버전 ${manifest.version}이 일치하지 않습니다.`,
);

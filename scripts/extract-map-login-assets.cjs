"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const {
  WzCanvasProperty,
  WzFile,
  WzFileParseStatus,
  WzMapleVersion,
  WzUOLProperty,
  getErrorDescription,
} = require(
  path.join(
    __dirname,
    "..",
    "poc",
    "map-login",
    "node_modules",
    "@tybys",
    "wz",
  ),
);

const root = path.resolve(__dirname, "..");
const source = path.join(root, "poc", "map-login", "public", "generated");
const target = path.join(root, "public", "map-login", "kms-v43");
const loginTarget = path.join(target, "login");
const wzDir = process.env.KMS_WZ_DIR;

if (!wzDir) {
  console.error("KMS_WZ_DIR is required.");
  process.exit(1);
}

function followUol(property) {
  const seen = new Set();
  let current = property;
  while (current instanceof WzUOLProperty) {
    if (seen.has(current))
      throw new Error(`Circular UOL at ${current.fullPath}`);
    seen.add(current);
    current = current.linkValue;
  }
  return current;
}

function canvasAt(resource, resourcePath) {
  let current = followUol(resource);
  if (current instanceof WzCanvasProperty) return current;
  const first =
    current && typeof current.at === "function" ? current.at("0") : null;
  if (first) {
    current = followUol(first);
    if (current instanceof WzCanvasProperty) return current;
  }
  throw new Error(`Canvas was not found at ${resourcePath}`);
}

async function saveCanvas(loginImage, resourcePath, filename) {
  const resource = loginImage.getFromPath(resourcePath);
  if (!resource)
    throw new Error(`Login.img resource was not found: ${resourcePath}`);
  const canvas = canvasAt(resource, resourcePath);
  const bitmap = await canvas.getLinkedWzCanvasBitmap();
  if (!bitmap) throw new Error(`Unable to resolve Canvas: ${resourcePath}`);
  const raw = bitmap.getCanvas();
  const width = raw.width ?? raw.bitmap?.width;
  const height = raw.height ?? raw.bitmap?.height;
  const output = path.join(loginTarget, filename);
  await bitmap.writeAsync(output);
  bitmap.dispose();
  return {
    asset: `/map-login/kms-v43/login/${filename}`,
    width,
    height,
    source: `UI.wz/Login.img/${resourcePath}`,
  };
}

function rewriteAssets(value) {
  if (Array.isArray(value)) return value.map(rewriteAssets);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] =
      key === "asset" && typeof child === "string"
        ? child.replace(/^generated\//, "/map-login/kms-v43/")
        : rewriteAssets(child);
  }
  return output;
}

async function main() {
  const publicRoot = path.join(root, "public");
  if (!target.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Refusing to replace a path outside public/.");
  }
  await fs.access(path.join(source, "scene.json"));
  await fs.access(path.join(source, "notice.json"));
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  await fs.cp(path.join(source, "assets"), path.join(target, "assets"), {
    recursive: true,
  });

  for (const filename of ["scene.json", "notice.json"]) {
    const parsed = JSON.parse(
      await fs.readFile(path.join(source, filename), "utf8"),
    );
    await fs.writeFile(
      path.join(target, filename),
      `${JSON.stringify(rewriteAssets(parsed), null, 2)}\n`,
    );
  }

  await fs.mkdir(loginTarget, { recursive: true });
  const uiPath = path.join(wzDir, "UI.wz");
  const wz = new WzFile(uiPath, WzMapleVersion.GETFROMZLZ, 43);
  const result = await wz.parseWzFile();
  if (result !== WzFileParseStatus.SUCCESS) {
    wz.dispose();
    throw new Error(`UI.wz: ${getErrorDescription(result)}`);
  }
  try {
    const loginImage = wz.wzDirectory.at("Login.img");
    if (!loginImage) throw new Error("Login.img was not found.");
    await loginImage.parseImage();
    const manifest = {
      formatVersion: 1,
      source: {
        login: "UI.wz/Login.img/Title",
        patchVersion: 43,
        keySource: "ZLZ.dll",
      },
      title: await saveCanvas(loginImage, "Title/MSTitle", "ms-title.png"),
      login: {
        normal: await saveCanvas(
          loginImage,
          "Title/BtLogin/normal",
          "bt-login-normal.png",
        ),
        mouseOver: await saveCanvas(
          loginImage,
          "Title/BtLogin/mouseOver",
          "bt-login-mouse-over.png",
        ),
        pressed: await saveCanvas(
          loginImage,
          "Title/BtLogin/pressed",
          "bt-login-pressed.png",
        ),
        disabled: await saveCanvas(
          loginImage,
          "Title/BtLogin/disabled",
          "bt-login-disabled.png",
        ),
      },
    };
    if (manifest.title.width !== 397 || manifest.title.height !== 219) {
      throw new Error("MSTitle dimensions do not match 397x219.");
    }
    for (const asset of Object.values(manifest.login)) {
      if (asset.width !== 95 || asset.height !== 48) {
        throw new Error(`${asset.source} dimensions do not match 95x48.`);
      }
    }
    await fs.writeFile(
      path.join(target, "login.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  } finally {
    wz.dispose();
  }

  console.log(`Wrote versioned MapLogin assets to ${target}`);
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

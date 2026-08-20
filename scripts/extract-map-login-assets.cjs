"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const {
  WzCanvasProperty,
  WzFile,
  WzFileParseStatus,
  WzMapleVersion,
  WzUOLProperty,
  WzVectorProperty,
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
const newCharTarget = path.join(target, "new-char");
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

function valueOf(container, name, fallback = null) {
  const property =
    container && typeof container.at === "function" ? container.at(name) : null;
  if (property == null) return fallback;
  if (property instanceof WzVectorProperty) {
    return { x: property.x.value, y: property.y.value };
  }
  return property.value ?? property.wzValue ?? fallback;
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

async function saveCanvas(
  image,
  imageName,
  resourcePath,
  outputDirectory,
  publicDirectory,
  filename,
) {
  const resource = image.getFromPath(resourcePath);
  if (!resource)
    throw new Error(`${imageName} resource was not found: ${resourcePath}`);
  const canvas = canvasAt(resource, resourcePath);
  const bitmap = await canvas.getLinkedWzCanvasBitmap();
  if (!bitmap) throw new Error(`Unable to resolve Canvas: ${resourcePath}`);
  const raw = bitmap.getCanvas();
  const width = raw.width ?? raw.bitmap?.width;
  const height = raw.height ?? raw.bitmap?.height;
  const output = path.join(outputDirectory, filename);
  await bitmap.writeAsync(output);
  bitmap.dispose();
  return {
    asset: `/map-login/kms-v43/${publicDirectory}/${filename}`,
    width,
    height,
    source: `UI.wz/${imageName}/${resourcePath}`,
  };
}

async function saveLoginCanvas(loginImage, resourcePath, filename) {
  return saveCanvas(
    loginImage,
    "Login.img",
    resourcePath,
    loginTarget,
    "login",
    filename,
  );
}

async function saveNewCharCanvas(image, imageName, resourcePath, filename) {
  return saveCanvas(
    image,
    imageName,
    resourcePath,
    newCharTarget,
    "new-char",
    filename,
  );
}

async function saveNewCharFrame(loginImage, resourcePath, filename) {
  const resource = loginImage.getFromPath(resourcePath);
  if (!resource)
    throw new Error(`Login.img resource was not found: ${resourcePath}`);
  return {
    ...(await saveNewCharCanvas(
      loginImage,
      "Login.img",
      resourcePath,
      filename,
    )),
    delay: valueOf(resource, "delay", 100),
    origin: valueOf(resource, "origin", { x: 0, y: 0 }),
  };
}

async function saveButton(image, imageName, resourcePath, filename) {
  const states = ["normal", "mouseOver", "pressed", "disabled"];
  const output = {};
  for (const state of states) {
    output[state] = await saveNewCharCanvas(
      image,
      imageName,
      `${resourcePath}/${state}`,
      `${filename}-${state === "mouseOver" ? "mouse-over" : state}.png`,
    );
  }
  return output;
}

function assertAsset(asset, width, height) {
  if (asset.width !== width || asset.height !== height) {
    throw new Error(
      `${asset.source} dimensions do not match ${width}x${height}.`,
    );
  }
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
  await fs.mkdir(newCharTarget, { recursive: true });
  const uiPath = path.join(wzDir, "UI.wz");
  const wz = new WzFile(uiPath, WzMapleVersion.GETFROMZLZ, 43);
  const result = await wz.parseWzFile();
  if (result !== WzFileParseStatus.SUCCESS) {
    wz.dispose();
    throw new Error(`UI.wz: ${getErrorDescription(result)}`);
  }
  try {
    const loginImage = wz.wzDirectory.at("Login.img");
    const basicImage = wz.wzDirectory.at("Basic.img");
    if (!loginImage || !basicImage)
      throw new Error("Login.img or Basic.img was not found.");
    await loginImage.parseImage();
    await basicImage.parseImage();
    const manifest = {
      formatVersion: 1,
      source: {
        login: "UI.wz/Login.img",
        patchVersion: 43,
        keySource: "ZLZ.dll",
      },
      frame: await saveLoginCanvas(loginImage, "Common/frame", "frame.png"),
      title: await saveLoginCanvas(loginImage, "Title/MSTitle", "ms-title.png"),
      login: {
        normal: await saveLoginCanvas(
          loginImage,
          "Title/BtLogin/normal",
          "bt-login-normal.png",
        ),
        mouseOver: await saveLoginCanvas(
          loginImage,
          "Title/BtLogin/mouseOver",
          "bt-login-mouse-over.png",
        ),
        pressed: await saveLoginCanvas(
          loginImage,
          "Title/BtLogin/pressed",
          "bt-login-pressed.png",
        ),
        disabled: await saveLoginCanvas(
          loginImage,
          "Title/BtLogin/disabled",
          "bt-login-disabled.png",
        ),
      },
    };
    if (manifest.title.width !== 397 || manifest.title.height !== 219) {
      throw new Error("MSTitle dimensions do not match 397x219.");
    }
    if (manifest.frame.width !== 800 || manifest.frame.height !== 600) {
      throw new Error("Login frame dimensions do not match 800x600.");
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

    const buttonStates = ["normal", "mouseOver", "pressed", "disabled"];
    const tab = {};
    for (const [state, suffix] of [
      ["normal", "0"],
      ["selected", "1"],
    ]) {
      tab[state] = {};
      for (const part of ["left", "middle", "right", "fill"]) {
        tab[state][part] = await saveNewCharCanvas(
          basicImage,
          "Basic.img",
          `Tab/${part}${suffix}`,
          `tab-${state}-${part}.png`,
        );
      }
    }
    const scroll = { open: [], close: [] };
    for (const [direction, branch] of [
      ["open", "0"],
      ["close", "1"],
    ]) {
      for (let frame = 0; frame < 4; frame += 1) {
        scroll[direction].push(
          await saveNewCharFrame(
            loginImage,
            `NewChar/scroll/${branch}/${frame}`,
            `scroll-${direction}-${frame}.png`,
          ),
        );
      }
    }
    const dice = [];
    for (let frame = 0; frame < 4; frame += 1) {
      dice.push(
        await saveNewCharFrame(
          loginImage,
          `NewChar/dice/${frame}`,
          `dice-${frame}.png`,
        ),
      );
    }
    const newCharManifest = {
      formatVersion: 7,
      source: {
        login: "UI.wz/Login.img",
        newChar: "UI.wz/Login.img/NewChar",
        basic: "UI.wz/Basic.img",
        patchVersion: 43,
        keySource: "ZLZ.dll",
      },
      scroll,
      arrows: {
        left: await saveButton(
          loginImage,
          "Login.img",
          "NewChar/BtLeft",
          "bt-left",
        ),
        right: await saveButton(
          loginImage,
          "Login.img",
          "NewChar/BtRight",
          "bt-right",
        ),
      },
      buttons: {
        findCharacter: await saveButton(
          loginImage,
          "Login.img",
          "Common/BtStart",
          "bt-find-character",
        ),
      },
      tab,
      dice,
      alert: await saveNewCharCanvas(
        loginImage,
        "Login.img",
        "NewChar/charAlert",
        "char-alert.png",
      ),
    };

    const scrollContracts = {
      open: [
        [242, 30, 250],
        [242, 169, 50],
        [242, 167, 50],
        [242, 165, 100],
      ],
      close: [
        [242, 165, 100],
        [242, 167, 30],
        [242, 169, 30],
        [242, 30, 1000],
      ],
    };
    for (const direction of ["open", "close"]) {
      newCharManifest.scroll[direction].forEach((frame, index) => {
        const [width, height, delay] = scrollContracts[direction][index];
        assertAsset(frame, width, height);
        if (
          frame.delay !== delay ||
          frame.origin.x !== 0 ||
          frame.origin.y !== 0
        )
          throw new Error(`${frame.source} frame metadata does not match.`);
      });
    }
    for (const arrow of Object.values(newCharManifest.arrows))
      for (const asset of Object.values(arrow)) assertAsset(asset, 15, 16);
    for (const asset of Object.values(newCharManifest.buttons.findCharacter))
      assertAsset(asset, 125, 52);
    for (const parts of Object.values(newCharManifest.tab)) {
      assertAsset(parts.left, 6, 24);
      assertAsset(parts.middle, 13, 24);
      assertAsset(parts.right, 12, 24);
      assertAsset(parts.fill, 1, 24);
    }
    const diceContracts = [
      [37, 26, 0, -30],
      [25, 54, 0, -2],
      [27, 56, 0, 0],
      [28, 43, 0, -13],
    ];
    newCharManifest.dice.forEach((frame, index) => {
      const [width, height, originX, originY] = diceContracts[index];
      assertAsset(frame, width, height);
      if (
        frame.delay !== 100 ||
        frame.origin.x !== originX ||
        frame.origin.y !== originY
      )
        throw new Error(`${frame.source} frame metadata does not match.`);
    });
    assertAsset(newCharManifest.alert, 187, 120);

    await fs.writeFile(
      path.join(target, "new-char.json"),
      `${JSON.stringify(newCharManifest, null, 2)}\n`,
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

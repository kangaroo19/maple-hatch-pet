export type SceneFrame = {
  asset: string;
  width: number;
  height: number;
  delay: number;
  origin: { x: number; y: number };
  z: number;
  a0: number;
  a1: number;
};

export type SceneBackground = {
  id: string;
  order: number;
  front: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  cx: number;
  cy: number;
  type: number;
  f: number;
  a: number;
  frames: SceneFrame[];
};

export type SceneObject = {
  id: string;
  layer: number;
  order: number;
  x: number;
  y: number;
  z: number;
  f: number;
  a: number;
  frames: SceneFrame[];
};

export type MapLoginScene = {
  formatVersion: 1;
  map: { width: number; height: number; centerX: number; centerY: number };
  backgrounds: SceneBackground[];
  objects: SceneObject[];
  stats: { backgrounds: number; objects: number };
};

export type FrameSelection = {
  frame: SceneFrame;
  index: number;
  progress: number;
};

export function frameAtTime(
  frames: SceneFrame[],
  elapsedMs: number,
): FrameSelection {
  if (frames.length === 0) throw new Error("장면 데이터에 프레임이 없습니다.");
  const totalDelay = frames.reduce(
    (sum, frame) => sum + Math.max(1, frame.delay || 100),
    0,
  );
  let cursor = ((elapsedMs % totalDelay) + totalDelay) % totalDelay;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index]!;
    const delay = Math.max(1, frame.delay || 100);
    if (cursor < delay) return { frame, index, progress: cursor / delay };
    cursor -= delay;
  }
  return { frame: frames[0]!, index: 0, progress: 0 };
}

export function getTileMode(type: number) {
  return {
    horizontal:
      type === 1 || type === 3 || type === 4 || type === 6 || type === 7,
    vertical:
      type === 2 || type === 3 || type === 5 || type === 6 || type === 7,
    scrollHorizontal: type === 4 || type === 6,
    scrollVertical: type === 5 || type === 7,
  };
}

export function getBackgroundPosition(
  background: Pick<
    SceneBackground,
    "x" | "y" | "rx" | "ry" | "type" | "cx" | "cy"
  >,
  camera: { centerX: number; centerY: number; top: number; left: number },
  elapsedMs: number,
  assetSize: { width: number; height: number },
) {
  const mode = getTileMode(background.type);
  const cellWidth = background.cx || assetSize.width;
  const cellHeight = background.cy || assetSize.height;
  let x = background.x;
  let y = background.y;
  x += mode.scrollHorizontal
    ? ((background.rx * 5 * elapsedMs) / 1000) % cellWidth
    : (camera.centerX * (100 + background.rx)) / 100;
  y += mode.scrollVertical
    ? ((background.ry * 5 * elapsedMs) / 1000) % cellHeight
    : (camera.centerY * (100 + background.ry)) / 100;
  return { x: Math.floor(x - camera.left), y: Math.floor(y - camera.top) };
}

export function alphaForFrame(
  selection: FrameSelection,
  placementAlpha: number,
): number {
  const frameAlpha =
    selection.frame.a0 +
    (selection.frame.a1 - selection.frame.a0) * selection.progress;
  return (placementAlpha / 255) * (frameAlpha / 255);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function frameValid(value: unknown): value is SceneFrame {
  if (!value || typeof value !== "object") return false;
  const frame = value as Partial<SceneFrame>;
  return (
    typeof frame.asset === "string" &&
    frame.asset.length > 0 &&
    finite(frame.width) &&
    frame.width > 0 &&
    finite(frame.height) &&
    frame.height > 0 &&
    finite(frame.delay) &&
    !!frame.origin &&
    finite(frame.origin.x) &&
    finite(frame.origin.y) &&
    finite(frame.a0) &&
    finite(frame.a1)
  );
}

export function validateScene(candidate: unknown): MapLoginScene {
  if (!candidate || typeof candidate !== "object")
    throw new Error("장면 데이터가 올바르지 않습니다.");
  const scene = candidate as Partial<MapLoginScene>;
  const map = scene.map;
  if (
    scene.formatVersion !== 1 ||
    !map ||
    !finite(map.width) ||
    map.width <= 0 ||
    !finite(map.height) ||
    map.height <= 0 ||
    !finite(map.centerX) ||
    !finite(map.centerY) ||
    !Array.isArray(scene.backgrounds) ||
    !Array.isArray(scene.objects) ||
    [...scene.backgrounds, ...scene.objects].some(
      (item) =>
        !item ||
        !Array.isArray(item.frames) ||
        item.frames.length === 0 ||
        !item.frames.every(frameValid),
    )
  ) {
    throw new Error("장면 데이터가 올바르지 않습니다.");
  }
  return scene as MapLoginScene;
}

export type NoticeManifest = {
  formatVersion: 1;
  frame: {
    width: 362;
    height: 219;
    background: { asset: string; width: number; height: number };
  };
  confirm: Record<
    "normal" | "mouseOver" | "pressed",
    { asset: string; width: number; height: number }
  >;
};

export function validateNotice(candidate: unknown): NoticeManifest {
  if (!candidate || typeof candidate !== "object")
    throw new Error("알림 데이터가 올바르지 않습니다.");
  const notice = candidate as Partial<NoticeManifest>;
  const assets =
    notice.confirm && notice.frame
      ? [
          notice.frame.background,
          notice.confirm.normal,
          notice.confirm.mouseOver,
          notice.confirm.pressed,
        ]
      : [];
  if (
    notice.formatVersion !== 1 ||
    notice.frame?.width !== 362 ||
    notice.frame.height !== 219 ||
    assets.length !== 4 ||
    assets.some((asset) => !asset || typeof asset.asset !== "string")
  )
    throw new Error("알림 데이터가 올바르지 않습니다.");
  return notice as NoticeManifest;
}

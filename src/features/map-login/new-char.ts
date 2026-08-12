import { PET_STATES, type PetState } from "@/lib/pet-contract";
import type { MapLoginScene } from "@/features/map-login/scene";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NewCharAsset = {
  asset: string;
  width: number;
  height: number;
  source: string;
};

export type NewCharFrame = NewCharAsset & {
  delay: number;
  origin: { x: number; y: number };
};

export type NewCharButton = Record<
  "normal" | "mouseOver" | "pressed" | "disabled",
  NewCharAsset
>;

export type NewCharManifest = {
  formatVersion: 1;
  source: {
    newChar: "UI.wz/Login.img/NewChar";
    basic: "UI.wz/Basic.img";
    patchVersion: 43;
    keySource: "ZLZ.dll";
  };
  scroll: { open: NewCharFrame[]; close: NewCharFrame[] };
  arrows: { left: NewCharButton; right: NewCharButton };
  combo: Record<
    "normal" | "mouseOver" | "pressed" | "disabled" | "selected",
    [NewCharAsset, NewCharAsset, NewCharAsset]
  >;
  comboButton: NewCharButton;
  tab: Record<
    "normal" | "selected",
    {
      left: NewCharAsset;
      middle: NewCharAsset;
      right: NewCharAsset;
      fill: NewCharAsset;
    }
  >;
  alert: NewCharAsset;
};

export type NewCharLayout = {
  panel: Rect;
  scroll: Rect;
  character: Rect;
  previous: Rect;
  next: Rect;
  action: Rect;
  emotion: Rect;
  primary: Rect;
  secondary: Rect;
  modal: Rect;
  install: Rect;
  delete: Rect;
  close: Rect;
};

export type NewCharTarget =
  | "previous"
  | "next"
  | "action"
  | "emotion"
  | "primary"
  | "secondary"
  | "install"
  | "delete"
  | "close";

export type NewCharControlState =
  "normal" | "mouseOver" | "pressed" | "disabled";

export const NEW_CHAR_PANEL_SOURCE = "Map.wz/Obj/login.img/NewChar/signboard/0";
export const NEW_CHAR_MUSHROOM_SOURCE = "Map.wz/Back/login.img/back/18";

const buttonStates = ["normal", "mouseOver", "pressed", "disabled"] as const;
const comboStates = [...buttonStates, "selected"] as const;

function validAsset(
  value: unknown,
  width: number,
  height: number,
): value is NewCharAsset {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NewCharAsset>;
  return (
    typeof candidate.asset === "string" &&
    candidate.asset.length > 0 &&
    typeof candidate.source === "string" &&
    candidate.source.length > 0 &&
    candidate.width === width &&
    candidate.height === height
  );
}

function validFrame(
  value: unknown,
  width: number,
  height: number,
  delay: number,
): value is NewCharFrame {
  if (!validAsset(value, width, height)) return false;
  const frame = value as Partial<NewCharFrame>;
  return frame.delay === delay && frame.origin?.x === 0 && frame.origin.y === 0;
}

function validButton(value: unknown, width: number, height: number): boolean {
  if (!value || typeof value !== "object") return false;
  const button = value as Partial<NewCharButton>;
  return buttonStates.every((state) =>
    validAsset(button[state], width, height),
  );
}

export function validateNewChar(candidate: unknown): NewCharManifest {
  if (!candidate || typeof candidate !== "object")
    throw new Error("NewChar 자산 데이터가 올바르지 않습니다.");
  const manifest = candidate as Partial<NewCharManifest>;
  const source = manifest.source;
  const scroll = manifest.scroll;
  const arrows = manifest.arrows;
  const combo = manifest.combo;
  const tab = manifest.tab;
  const openFrames: [number, number, number][] = [
    [242, 30, 250],
    [242, 169, 50],
    [242, 167, 50],
    [242, 165, 100],
  ];
  const closeFrames: [number, number, number][] = [
    [242, 165, 100],
    [242, 167, 30],
    [242, 169, 30],
    [242, 30, 1000],
  ];
  const validFrames = (
    frames: NewCharFrame[] | undefined,
    contract: [number, number, number][],
  ) =>
    frames?.length === contract.length &&
    contract.every(([width, height, delay], index) =>
      validFrame(frames[index], width, height, delay),
    );
  const validCombo =
    combo &&
    comboStates.every((state) => {
      const parts = combo[state];
      return (
        Array.isArray(parts) &&
        parts.length === 3 &&
        validAsset(parts[0], 5, 17) &&
        validAsset(parts[1], 5, 17) &&
        validAsset(parts[2], 18, 17)
      );
    });
  const validTab =
    tab &&
    (["normal", "selected"] as const).every((state) => {
      const parts = tab[state];
      return (
        validAsset(parts?.left, 6, 24) &&
        validAsset(parts.middle, 13, 24) &&
        validAsset(parts.right, 12, 24) &&
        validAsset(parts.fill, 1, 24)
      );
    });

  if (
    manifest.formatVersion !== 1 ||
    source?.newChar !== "UI.wz/Login.img/NewChar" ||
    source.basic !== "UI.wz/Basic.img" ||
    source.patchVersion !== 43 ||
    source.keySource !== "ZLZ.dll" ||
    !validFrames(scroll?.open, openFrames) ||
    !validFrames(scroll?.close, closeFrames) ||
    !validButton(arrows?.left, 15, 16) ||
    !validButton(arrows?.right, 15, 16) ||
    !validCombo ||
    !validButton(manifest.comboButton, 17, 16) ||
    !validTab ||
    !validAsset(manifest.alert, 187, 120)
  ) {
    throw new Error("NewChar 자산 데이터가 올바르지 않습니다.");
  }
  return manifest as NewCharManifest;
}

export function getNewCharLayout(scene: MapLoginScene): NewCharLayout {
  const panelObject = scene.objects.find(
    (object) => object.source === NEW_CHAR_PANEL_SOURCE,
  );
  const mushroom = scene.backgrounds.find(
    (background) => background.source === NEW_CHAR_MUSHROOM_SOURCE,
  );
  const frame = panelObject?.frames[0];
  if (!panelObject || !frame || !mushroom)
    throw new Error("NewChar 화면 배치를 찾을 수 없습니다.");
  const panel = {
    x: panelObject.x - frame.origin.x,
    y: panelObject.y - frame.origin.y,
    width: frame.width,
    height: frame.height,
  };
  const scroll = {
    x: panel.x - 20,
    y: panel.y + 48,
    width: 242,
    height: 165,
  };
  const modal = {
    x: -scene.map.centerX + (scene.map.width - 242) / 2,
    y: panel.y + 70,
    width: 242,
    height: 165,
  };
  const characterSize = 360;
  return {
    panel,
    scroll,
    character: {
      x: mushroom.x - characterSize / 2,
      y: panel.y + 8,
      width: characterSize,
      height: characterSize,
    },
    previous: { x: scroll.x + 12, y: scroll.y + 16, width: 15, height: 16 },
    next: {
      x: scroll.x + scroll.width - 27,
      y: scroll.y + 16,
      width: 15,
      height: 16,
    },
    action: { x: scroll.x + 20, y: scroll.y + 62, width: 202, height: 17 },
    emotion: { x: scroll.x + 20, y: scroll.y + 90, width: 202, height: 17 },
    primary: { x: scroll.x + 20, y: scroll.y + 126, width: 96, height: 24 },
    secondary: {
      x: scroll.x + 126,
      y: scroll.y + 126,
      width: 96,
      height: 24,
    },
    modal,
    install: {
      x: modal.x + 18,
      y: modal.y + 128,
      width: 96,
      height: 24,
    },
    delete: {
      x: modal.x + 132,
      y: modal.y + 102,
      width: 92,
      height: 16,
    },
    close: {
      x: modal.x + 128,
      y: modal.y + 128,
      width: 96,
      height: 24,
    },
  };
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function pointInRect(rect: Rect, point: { x: number; y: number }): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

export function hitTestNewChar(
  layout: NewCharLayout,
  point: { x: number; y: number },
  modalOpen: boolean,
): NewCharTarget | null {
  const targets: NewCharTarget[] = modalOpen
    ? ["install", "delete", "close"]
    : ["previous", "next", "action", "emotion", "primary", "secondary"];
  return targets.find((target) => pointInRect(layout[target], point)) ?? null;
}

export function resolveNewCharControlState(input: {
  disabled: boolean;
  pressed?: boolean;
  hovered?: boolean;
  focused?: boolean;
}): NewCharControlState {
  if (input.disabled) return "disabled";
  if (input.pressed) return "pressed";
  if (input.hovered || input.focused) return "mouseOver";
  return "normal";
}

export function frameAtTimeOnce<T extends { delay: number }>(
  frames: T[],
  elapsed: number,
): T | undefined {
  if (frames.length === 0) return undefined;
  let remaining = Math.max(0, elapsed);
  for (const frame of frames) {
    if (remaining < Math.max(1, frame.delay)) return frame;
    remaining -= Math.max(1, frame.delay);
  }
  return frames.at(-1);
}

export function movePetState(current: PetState, direction: -1 | 1): PetState {
  const index = PET_STATES.indexOf(current);
  const next = Math.min(PET_STATES.length - 1, Math.max(0, index + direction));
  return PET_STATES[next] ?? "idle";
}

export function getDropdownWindow(
  total: number,
  selectedIndex: number,
  requestedStart: number,
  visibleCount = 8,
): { start: number; end: number } {
  const count = Math.max(0, Math.floor(total));
  const visible = Math.max(1, Math.floor(visibleCount));
  const maxStart = Math.max(0, count - visible);
  const selected = Math.min(Math.max(0, selectedIndex), Math.max(0, count - 1));
  let start = Math.min(maxStart, Math.max(0, Math.floor(requestedStart)));
  if (selected < start) start = selected;
  else if (selected >= start + visible) start = selected - visible + 1;
  start = Math.min(maxStart, Math.max(0, start));
  return { start, end: Math.min(count, start + visible) };
}

export function moveDropdownOption(
  total: number,
  current: { start: number; active: number },
  direction: -1 | 1,
  visibleCount = 8,
): { start: number; active: number } {
  const count = Math.max(0, Math.floor(total));
  if (count === 0) return { start: 0, active: 0 };
  const visible = Math.max(1, Math.floor(visibleCount));
  const active = Math.min(
    count - 1,
    Math.max(0, Math.floor(current.active) + direction),
  );
  let start = Math.min(
    Math.max(0, count - visible),
    Math.max(0, Math.floor(current.start)),
  );
  if (active < start) start = active;
  else if (active >= start + visible) start = active - visible + 1;
  return { start, active };
}

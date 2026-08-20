import type { MapLoginScene } from "@/features/map-login/scene";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LoginLayout = {
  panel: Rect;
  input: Rect;
  passwordIndicator: Rect;
  button: Rect;
};

export type LoginTarget = "input" | "button";
export type LoginButtonState = "normal" | "mouseOver" | "pressed" | "disabled";

type LoginAsset = {
  asset: string;
  width: number;
  height: number;
};

export type LoginManifest = {
  formatVersion: 1;
  frame: LoginAsset;
  title: LoginAsset;
  login: Record<LoginButtonState, LoginAsset>;
};

const TITLE_PANEL_SOURCE = "Map.wz/Obj/login.img/Title/signboard/0";

export function getLoginLayout(scene: MapLoginScene): LoginLayout {
  const panelObject = scene.objects.find(
    (object) => object.source === TITLE_PANEL_SOURCE,
  );
  const frame = panelObject?.frames[0];
  if (!panelObject || !frame)
    throw new Error("첫 로그인 화면 패널을 찾을 수 없습니다.");

  const panel = {
    x: panelObject.x - frame.origin.x,
    y: panelObject.y - frame.origin.y,
    width: frame.width,
    height: frame.height,
  };

  return {
    panel,
    input: {
      x: panel.x + 113,
      y: panel.y + 20,
      width: 150,
      height: 27,
    },
    passwordIndicator: {
      x: panel.x + 113,
      y: panel.y + 49,
      width: 150,
      height: 27,
    },
    button: {
      x: panel.x + 264,
      y: panel.y + 20,
      width: 95,
      height: 48,
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

export function rectsOverlap(left: Rect, right: Rect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function containsPoint(rect: Rect, point: { x: number; y: number }): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function hitTestLogin(
  layout: LoginLayout,
  point: { x: number; y: number },
): LoginTarget | null {
  if (containsPoint(layout.input, point)) return "input";
  if (containsPoint(layout.button, point)) return "button";
  return null;
}

export function resolveLoginButtonState(state: {
  disabled: boolean;
  pressed: boolean;
  hovered: boolean;
  focused: boolean;
}): LoginButtonState {
  if (state.disabled) return "disabled";
  if (state.pressed) return "pressed";
  if (state.hovered || state.focused) return "mouseOver";
  return "normal";
}

function validAsset(value: unknown, width: number, height: number): boolean {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<LoginAsset>;
  return (
    typeof asset.asset === "string" &&
    asset.asset.length > 0 &&
    asset.width === width &&
    asset.height === height
  );
}

export function validateLogin(candidate: unknown): LoginManifest {
  if (!candidate || typeof candidate !== "object")
    throw new Error("로그인 자산 데이터가 올바르지 않습니다.");
  const manifest = candidate as Partial<LoginManifest>;
  const login = manifest.login;
  if (
    manifest.formatVersion !== 1 ||
    !validAsset(manifest.frame, 800, 600) ||
    !validAsset(manifest.title, 397, 219) ||
    !login ||
    !validAsset(login.normal, 95, 48) ||
    !validAsset(login.mouseOver, 95, 48) ||
    !validAsset(login.pressed, 95, 48) ||
    !validAsset(login.disabled, 95, 48)
  )
    throw new Error("로그인 자산 데이터가 올바르지 않습니다.");
  return manifest as LoginManifest;
}

export function validateLoginFrameImage(
  manifest: LoginManifest,
  image: Pick<HTMLImageElement, "naturalWidth" | "naturalHeight">,
): void {
  if (
    image.naturalWidth !== manifest.frame.width ||
    image.naturalHeight !== manifest.frame.height
  ) {
    throw new Error("로그인 프레임 이미지 크기가 올바르지 않습니다.");
  }
}

import {
  ACTIONS,
  EMOTIONS,
  PET_STATES,
  STATE_LABELS,
  type ActionCode,
  type EmotionCode,
  type PetState,
} from "@/lib/pet-contract";
import {
  frameAtTimeOnce,
  resolveNewCharControlState,
  type NewCharControlState,
  type NewCharLayout,
  type NewCharManifest,
  type NewCharTarget,
  type Rect,
} from "@/features/map-login/new-char";

export type CreatorCharacter = {
  name: string;
  world: string;
  class: string;
  level: number;
};

export type CanvasCreatorState = {
  visible: boolean;
  closing: boolean;
  character: CreatorCharacter | null;
  previewUrl: string | null;
  selectedState: PetState;
  selectedAction: ActionCode;
  selectedEmotion: EmotionCode;
  createPending: boolean;
  hasResult: boolean;
  modalOpen: boolean;
  installCommand: string | null;
  focused: NewCharTarget | null;
};

export type CreatorPointerState = {
  hovered: NewCharTarget | null;
  pressed: NewCharTarget | null;
  optionHovered: number | null;
};

export type CreatorDropdownState = {
  kind: "action" | "emotion";
  start: number;
} | null;

type Camera = { left: number; top: number };

const textFont = '11px Dotum, "돋움", sans-serif';
const boldFont = 'bold 11px Dotum, "돋움", sans-serif';

export function getNewCharAssetSources(manifest: NewCharManifest): string[] {
  const assets = [
    ...manifest.scroll.open,
    ...manifest.scroll.close,
    ...Object.values(manifest.arrows.left),
    ...Object.values(manifest.arrows.right),
    ...Object.values(manifest.combo).flat(),
    ...Object.values(manifest.comboButton),
    ...Object.values(manifest.buttons.petCreate),
    ...Object.values(manifest.buttons.findCharacter),
    ...Object.values(manifest.tab).flatMap((tab) => Object.values(tab)),
    manifest.alert,
  ];
  return assets.map((asset) => asset.asset);
}

export function getDropdownItems(kind: "action" | "emotion") {
  return kind === "action" ? ACTIONS : EMOTIONS;
}

export function getDropdownRowRect(control: Rect, row: number): Rect {
  return {
    x: control.x,
    y: control.y + control.height + row * 17,
    width: control.width,
    height: 17,
  };
}

function imageFor(
  images: Map<string, HTMLImageElement>,
  source: string,
): HTMLImageElement {
  const image = images.get(source);
  if (!image) throw new Error(`Missing NewChar asset: ${source}`);
  return image;
}

function screenRect(rect: Rect, camera: Camera): Rect {
  return { ...rect, x: rect.x - camera.left, y: rect.y - camera.top };
}

function drawWzButton(
  context: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  button: NewCharManifest["buttons"]["petCreate"],
  rect: Rect,
  state: NewCharControlState,
  camera?: Camera,
) {
  const target = camera ? screenRect(rect, camera) : rect;
  context.drawImage(imageFor(images, button[state].asset), target.x, target.y);
}

function drawCombo(
  context: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  manifest: NewCharManifest,
  rect: Rect,
  state: NewCharControlState | "selected",
  label: string,
  camera: Camera,
) {
  const target = screenRect(rect, camera);
  const [left, fill, right] = manifest.combo[state];
  context.drawImage(imageFor(images, left.asset), target.x, target.y);
  context.drawImage(
    imageFor(images, fill.asset),
    target.x + left.width,
    target.y,
    Math.max(1, target.width - left.width - right.width),
    target.height,
  );
  context.drawImage(
    imageFor(images, right.asset),
    target.x + target.width - right.width,
    target.y,
  );
  const buttonState =
    state === "selected" ? "mouseOver" : (state as NewCharControlState);
  context.drawImage(
    imageFor(images, manifest.comboButton[buttonState].asset),
    target.x + target.width - manifest.comboButton[buttonState].width,
    target.y,
  );
  context.save();
  context.beginPath();
  context.rect(target.x + 3, target.y, target.width - 23, target.height);
  context.clip();
  context.font = textFont;
  context.textBaseline = "middle";
  context.fillStyle = state === "disabled" ? "#8b8479" : "#30271e";
  context.fillText(label, target.x + 6, target.y + target.height / 2 + 1);
  context.restore();
}

function drawTabButton(
  context: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  manifest: NewCharManifest,
  rect: Rect,
  selected: boolean,
  disabled: boolean,
  label: string,
  camera: Camera,
) {
  const target = screenRect(rect, camera);
  const tab = manifest.tab[selected ? "selected" : "normal"];
  context.save();
  if (disabled) context.globalAlpha = 0.58;
  context.drawImage(imageFor(images, tab.left.asset), target.x, target.y);
  context.drawImage(
    imageFor(images, tab.fill.asset),
    target.x + tab.left.width,
    target.y,
    Math.max(
      1,
      target.width - tab.left.width - tab.middle.width - tab.right.width,
    ),
    target.height,
  );
  context.drawImage(
    imageFor(images, tab.middle.asset),
    target.x + target.width - tab.middle.width - tab.right.width,
    target.y,
  );
  context.drawImage(
    imageFor(images, tab.right.asset),
    target.x + target.width - tab.right.width,
    target.y,
  );
  context.font = boldFont;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = disabled ? "#837969" : "#3a2a18";
  context.fillText(label, target.x + target.width / 2, target.y + 12);
  context.restore();
}

function drawCharacter(
  context: CanvasRenderingContext2D,
  preview: HTMLImageElement | null,
  layout: NewCharLayout,
  state: CanvasCreatorState,
  camera: Camera,
) {
  const character = state.character;
  if (!character) return;
  const target = screenRect(layout.character, camera);
  if (preview) {
    context.save();
    if (state.selectedState === "running-right") {
      context.translate(target.x + target.width, target.y);
      context.scale(-1, 1);
      context.drawImage(preview, 0, 0, target.width, target.height);
    } else {
      context.drawImage(
        preview,
        target.x,
        target.y,
        target.width,
        target.height,
      );
    }
    context.restore();
  }
  const labelY = target.y + target.height - 36;
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "#22150d";
  context.shadowBlur = 2;
  context.shadowOffsetY = 1;
  context.fillStyle = "#fff0be";
  context.font = 'bold 16px Dotum, "돋움", sans-serif';
  context.fillText(character.name, target.x + target.width / 2, labelY);
  context.fillStyle = "#f1dfb0";
  context.font = textFont;
  context.fillText(
    `${character.world} · ${character.class} · Lv. ${character.level}`,
    target.x + target.width / 2,
    labelY + 20,
  );
  context.restore();
}

function drawArrow(
  context: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  manifest: NewCharManifest,
  layout: NewCharLayout,
  target: "previous" | "next",
  disabled: boolean,
  pointer: CreatorPointerState,
  focused: boolean,
  camera: Camera,
) {
  const state = resolveNewCharControlState({
    disabled,
    pressed: pointer.pressed === target,
    hovered: pointer.hovered === target,
    focused,
  });
  const button =
    target === "previous" ? manifest.arrows.left : manifest.arrows.right;
  const rect = screenRect(layout[target], camera);
  context.drawImage(imageFor(images, button[state].asset), rect.x, rect.y);
}

function drawDropdown(
  context: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  manifest: NewCharManifest,
  layout: NewCharLayout,
  state: CanvasCreatorState,
  dropdown: CreatorDropdownState,
  pointer: CreatorPointerState,
  camera: Camera,
) {
  if (!dropdown) return;
  const control = layout[dropdown.kind];
  const items = getDropdownItems(dropdown.kind);
  const selectedCode =
    dropdown.kind === "action" ? state.selectedAction : state.selectedEmotion;
  items.slice(dropdown.start, dropdown.start + 8).forEach((item, row) => {
    const selected =
      item.code === selectedCode || pointer.optionHovered === row;
    drawCombo(
      context,
      images,
      manifest,
      getDropdownRowRect(control, row),
      selected ? "selected" : "normal",
      item.label,
      camera,
    );
  });
}

function drawModal(
  context: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  manifest: NewCharManifest,
  layout: NewCharLayout,
  state: CanvasCreatorState,
  pointer: CreatorPointerState,
  camera: Camera,
  logicalWidth: number,
  logicalHeight: number,
) {
  context.save();
  context.fillStyle = "#00000099";
  context.fillRect(0, 0, logicalWidth, logicalHeight);
  const modal = screenRect(layout.modal, camera);
  const scroll = manifest.scroll.open.at(-1)!;
  context.drawImage(imageFor(images, scroll.asset), modal.x, modal.y);
  const alertX = modal.x + (modal.width - manifest.alert.width) / 2;
  context.drawImage(
    imageFor(images, manifest.alert.asset),
    alertX,
    modal.y + 3,
  );
  context.font = boldFont;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#483521";
  context.fillText("Pet 생성이 완료되었습니다.", modal.x + 121, modal.y + 47);
  context.font = textFont;
  context.fillText(
    "터미널에서 설치 명령을 실행하세요.",
    modal.x + 121,
    modal.y + 62,
  );
  context.font = '9px Consolas, "Courier New", monospace';
  const commandParts = state.installCommand?.split(" ") ?? [];
  context.fillText(
    commandParts.slice(0, 3).join(" "),
    modal.x + 121,
    modal.y + 77,
  );
  context.fillText(commandParts.at(-1) ?? "", modal.x + 121, modal.y + 89);
  context.font = textFont;
  context.fillText(
    "설치 후 Settings > Pets에서 Refresh",
    modal.x + 121,
    modal.y + 101,
  );
  context.textAlign = "left";
  context.fillStyle = "#65440e";
  context.fillText("이미지 삭제 요청", modal.x + 134, modal.y + 110);
  drawTabButton(
    context,
    images,
    manifest,
    layout.install,
    pointer.hovered === "install" || state.focused === "install",
    false,
    "설치 명령 복사",
    camera,
  );
  drawTabButton(
    context,
    images,
    manifest,
    layout.close,
    pointer.hovered === "close" || state.focused === "close",
    false,
    "닫기",
    camera,
  );
  context.restore();
}

export function drawNewCharEditor(input: {
  context: CanvasRenderingContext2D;
  images: Map<string, HTMLImageElement>;
  preview: HTMLImageElement | null;
  manifest: NewCharManifest;
  layout: NewCharLayout;
  state: CanvasCreatorState;
  pointer: CreatorPointerState;
  dropdown: CreatorDropdownState;
  camera: Camera;
  logicalWidth: number;
  logicalHeight: number;
  elapsed: number;
  transitionStartedAt: number;
  reducedMotion: boolean;
}): boolean {
  const {
    context,
    images,
    preview,
    manifest,
    layout,
    state,
    pointer,
    dropdown,
    camera,
    logicalWidth,
    logicalHeight,
    elapsed,
    transitionStartedAt,
    reducedMotion,
  } = input;
  if (!state.visible || !state.character) return false;

  drawCharacter(context, preview, layout, state, camera);
  const frames = state.closing ? manifest.scroll.close : manifest.scroll.open;
  const frame = reducedMotion
    ? frames.at(-1)
    : frameAtTimeOnce(frames, elapsed - transitionStartedAt);
  if (!frame) return false;
  const scroll = screenRect(layout.scroll, camera);
  context.drawImage(
    imageFor(images, frame.asset),
    scroll.x,
    scroll.y + (scroll.height - frame.height) / 2,
  );

  const transitionDuration = frames.reduce((sum, item) => sum + item.delay, 0);
  if (
    state.closing ||
    (!reducedMotion && elapsed - transitionStartedAt < transitionDuration)
  ) {
    return false;
  }

  const stateIndex = PET_STATES.indexOf(state.selectedState);
  const actionDisabled =
    state.selectedState === "running-left" ||
    state.selectedState === "running-right";
  drawArrow(
    context,
    images,
    manifest,
    layout,
    "previous",
    stateIndex === 0 || state.createPending,
    pointer,
    state.focused === "previous",
    camera,
  );
  drawArrow(
    context,
    images,
    manifest,
    layout,
    "next",
    stateIndex === PET_STATES.length - 1 || state.createPending,
    pointer,
    state.focused === "next",
    camera,
  );

  const scrollScreen = screenRect(layout.scroll, camera);
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = boldFont;
  context.fillStyle = "#493622";
  context.fillText(
    `${STATE_LABELS[state.selectedState]} (${state.selectedState.toUpperCase()}) · ${stateIndex + 1}/${PET_STATES.length}`,
    scrollScreen.x + scrollScreen.width / 2,
    scrollScreen.y + 24,
  );
  context.restore();

  const actionState = resolveNewCharControlState({
    disabled: actionDisabled || state.createPending,
    pressed: pointer.pressed === "action",
    hovered: pointer.hovered === "action",
    focused: state.focused === "action",
  });
  const emotionState = resolveNewCharControlState({
    disabled: state.createPending,
    pressed: pointer.pressed === "emotion",
    hovered: pointer.hovered === "emotion",
    focused: state.focused === "emotion",
  });
  const action = ACTIONS.find((item) => item.code === state.selectedAction)!;
  const emotion = EMOTIONS.find((item) => item.code === state.selectedEmotion)!;
  drawCombo(
    context,
    images,
    manifest,
    layout.action,
    dropdown?.kind === "action" ? "selected" : actionState,
    `액션  ${action.label}`,
    camera,
  );
  drawCombo(
    context,
    images,
    manifest,
    layout.emotion,
    dropdown?.kind === "emotion" ? "selected" : emotionState,
    `표정  ${emotion.label}`,
    camera,
  );

  const primaryState = resolveNewCharControlState({
    disabled: state.createPending,
    pressed: pointer.pressed === "primary",
    hovered: pointer.hovered === "primary",
    focused: state.focused === "primary",
  });
  drawWzButton(
    context,
    images,
    manifest.buttons.petCreate,
    layout.primary,
    primaryState,
    camera,
  );
  drawDropdown(
    context,
    images,
    manifest,
    layout,
    state,
    dropdown,
    pointer,
    camera,
  );

  if (state.modalOpen) {
    drawModal(
      context,
      images,
      manifest,
      layout,
      state,
      pointer,
      camera,
      logicalWidth,
      logicalHeight,
    );
  }
  return true;
}

export function drawNewCharViewportOverlay(input: {
  context: CanvasRenderingContext2D;
  images: Map<string, HTMLImageElement>;
  manifest: NewCharManifest;
  layout: NewCharLayout;
  state: CanvasCreatorState;
  pointer: CreatorPointerState;
  controlsVisible: boolean;
}) {
  const { context, images, manifest, layout, state, pointer, controlsVisible } =
    input;
  if (!controlsVisible || state.modalOpen) return;
  const secondaryState = resolveNewCharControlState({
    disabled: state.createPending,
    pressed: pointer.pressed === "secondary",
    hovered: pointer.hovered === "secondary",
    focused: state.focused === "secondary",
  });
  drawWzButton(
    context,
    images,
    manifest.buttons.findCharacter,
    layout.secondary,
    secondaryState,
  );
}

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
  type NewCharButton,
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
  installCommand: string | null;
  copyState: "idle" | "success" | "error";
  focused: NewCharTarget | null;
  randomizeRevision: number;
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
    ...Object.values(manifest.buttons.findCharacter),
    ...Object.values(manifest.tab).flatMap((tab) => Object.values(tab)),
    ...manifest.dice,
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
  button: NewCharButton,
  rect: Rect,
  state: NewCharControlState,
  camera?: Camera,
) {
  const target = camera ? screenRect(rect, camera) : rect;
  context.drawImage(imageFor(images, button[state].asset), target.x, target.y);
}

export function getDiceFrameIndex(
  elapsed: number,
  animationStartedAt: number,
  reducedMotion: boolean,
): number {
  if (reducedMotion || !Number.isFinite(animationStartedAt)) return 0;
  const animationElapsed = elapsed - animationStartedAt;
  if (animationElapsed < 0 || animationElapsed >= 400) return 0;
  return Math.floor(animationElapsed / 100);
}

function drawRandomize(
  context: CanvasRenderingContext2D,
  images: Map<string, HTMLImageElement>,
  manifest: NewCharManifest,
  layout: NewCharLayout,
  state: NewCharControlState,
  camera: Camera,
  elapsed: number,
  animationStartedAt: number,
  reducedMotion: boolean,
) {
  const target = screenRect(layout.randomize, camera);
  const pressedOffset = state === "pressed" ? 1 : 0;
  const restingFrame = manifest.dice[0]!;
  const frame =
    manifest.dice[
      getDiceFrameIndex(elapsed, animationStartedAt, reducedMotion)
    ] ?? restingFrame;
  const anchor = {
    x: target.x + restingFrame.origin.x,
    y: target.y + restingFrame.origin.y,
  };
  context.save();
  if (state === "disabled") context.globalAlpha = 0.45;
  context.drawImage(
    imageFor(images, frame.asset),
    anchor.x - frame.origin.x + pressedOffset,
    anchor.y - frame.origin.y + pressedOffset,
  );
  context.restore();
}

export function resolvePrimaryButtonVisual(input: {
  createPending: boolean;
  hasResult: boolean;
  pressed?: boolean;
  hovered?: boolean;
  focused?: boolean;
}): { state: NewCharControlState; label: string } {
  return {
    state: resolveNewCharControlState({
      disabled: input.createPending,
      pressed: input.pressed,
      hovered: input.hovered,
      focused: input.focused,
    }),
    label: "Pet 만들기",
  };
}

const primaryButtonPalettes: Record<
  NewCharControlState,
  {
    top: string;
    bottom: string;
    outer: string;
    inner: string;
    text: string;
    highlight: string;
  }
> = {
  normal: {
    top: "#8C4B1F",
    bottom: "#5B2C12",
    outer: "#3B210D",
    inner: "#D79A27",
    text: "#FFECC2",
    highlight: "rgba(255, 220, 128, 0.32)",
  },
  mouseOver: {
    top: "#A85D25",
    bottom: "#6C3515",
    outer: "#3B210D",
    inner: "#FFD266",
    text: "#FFF7D6",
    highlight: "rgba(255, 232, 155, 0.45)",
  },
  pressed: {
    top: "#643014",
    bottom: "#4A210D",
    outer: "#321B0B",
    inner: "#C88B21",
    text: "#FFE8AE",
    highlight: "rgba(224, 174, 79, 0.2)",
  },
  disabled: {
    top: "#76604A",
    bottom: "#544535",
    outer: "#463A2F",
    inner: "#988065",
    text: "#C9BBA2",
    highlight: "rgba(214, 197, 165, 0.15)",
  },
};

function drawPrimaryButton(
  context: CanvasRenderingContext2D,
  rect: Rect,
  visual: { state: NewCharControlState; label: string },
  camera: Camera,
) {
  const target = screenRect(rect, camera);
  const pressedOffset = visual.state === "pressed" ? 1 : 0;
  const x = target.x;
  const y = target.y + pressedOffset;
  const palette = primaryButtonPalettes[visual.state];
  const radius = 5;

  context.save();
  if (visual.state !== "pressed") {
    context.beginPath();
    context.roundRect(x, y + 2, target.width, target.height, radius);
    context.fillStyle = "rgba(38, 18, 8, 0.68)";
    context.fill();
  }

  const background = context.createLinearGradient(x, y, x, y + target.height);
  background.addColorStop(0, palette.top);
  background.addColorStop(1, palette.bottom);
  context.beginPath();
  context.roundRect(x, y, target.width, target.height, radius);
  context.fillStyle = background;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = palette.outer;
  context.stroke();

  context.beginPath();
  context.roundRect(x + 3, y + 3, target.width - 6, target.height - 6, 3);
  context.lineWidth = 1;
  context.strokeStyle = palette.inner;
  context.stroke();

  context.beginPath();
  context.moveTo(x + 7, y + 5.5);
  context.lineTo(x + target.width - 7, y + 5.5);
  context.lineWidth = 1;
  context.strokeStyle = palette.highlight;
  context.stroke();

  context.font = 'bold 12px Dotum, "돋움", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = palette.text;
  context.shadowColor = "rgba(31, 15, 6, 0.9)";
  context.shadowOffsetY = 1;
  context.shadowBlur = 0;
  context.fillText(
    visual.label,
    x + target.width / 2,
    y + target.height / 2 + 0.5,
  );
  context.restore();
}

function drawCombo(
  context: CanvasRenderingContext2D,
  rect: Rect,
  state: NewCharControlState | "selected",
  label: string,
  camera: Camera,
  showArrow = true,
) {
  const target = screenRect(rect, camera);
  const pressedOffset = state === "pressed" ? 1 : 0;
  const x = target.x;
  const y = target.y + pressedOffset;
  const palette = {
    normal: {
      top: "#f6e9c8",
      bottom: "#dfc99d",
      border: "#68492c",
      text: "#30271e",
    },
    mouseOver: {
      top: "#fff3cf",
      bottom: "#e8cf96",
      border: "#bd8124",
      text: "#30271e",
    },
    pressed: {
      top: "#d8bd87",
      bottom: "#c5a66e",
      border: "#70471f",
      text: "#30271e",
    },
    disabled: {
      top: "#d7cdb9",
      bottom: "#bdb29f",
      border: "#8e816e",
      text: "#81796e",
    },
    selected: {
      top: "#f2d98e",
      bottom: "#d9b75f",
      border: "#a66b1b",
      text: "#30271e",
    },
  }[state];

  context.save();
  const background = context.createLinearGradient(x, y, x, y + target.height);
  background.addColorStop(0, palette.top);
  background.addColorStop(1, palette.bottom);
  context.beginPath();
  context.roundRect(x, y, target.width, target.height, 2);
  context.fillStyle = background;
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = palette.border;
  context.stroke();
  context.beginPath();
  context.moveTo(x + 2, y + 2.5);
  context.lineTo(x + target.width - 2, y + 2.5);
  context.strokeStyle = "rgba(255, 255, 236, 0.62)";
  context.stroke();

  const arrowWidth = showArrow ? 17 : 0;
  if (showArrow) {
    const arrowX = x + target.width - arrowWidth;
    const arrowBackground = context.createLinearGradient(
      arrowX,
      y,
      arrowX,
      y + target.height,
    );
    arrowBackground.addColorStop(0, "rgba(137, 91, 42, 0.24)");
    arrowBackground.addColorStop(1, "rgba(91, 55, 27, 0.34)");
    context.fillStyle = arrowBackground;
    context.fillRect(arrowX, y + 1, arrowWidth - 1, target.height - 2);
    context.beginPath();
    context.moveTo(arrowX, y + 2);
    context.lineTo(arrowX, y + target.height - 2);
    context.strokeStyle = palette.border;
    context.stroke();
    context.beginPath();
    context.moveTo(arrowX + 5, y + 6);
    context.lineTo(arrowX + 12, y + 6);
    context.lineTo(arrowX + 8.5, y + 10);
    context.closePath();
    context.fillStyle = state === "disabled" ? "#8a8174" : "#51341f";
    context.fill();
  }

  context.beginPath();
  context.rect(x + 3, y, target.width - arrowWidth - 6, target.height);
  context.clip();
  context.font = textFont;
  context.textBaseline = "middle";
  context.fillStyle = palette.text;
  context.fillText(label, x + 6, y + target.height / 2 + 1);
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
  const rect = screenRect(layout[target], camera);
  const pressedOffset = state === "pressed" ? 1 : 0;
  const x = rect.x;
  const y = rect.y + pressedOffset;
  const palette = {
    normal: {
      top: "#f6e9c8",
      bottom: "#dfc99d",
      border: "#68492c",
      icon: "#51341f",
    },
    mouseOver: {
      top: "#fff3cf",
      bottom: "#e8cf96",
      border: "#bd8124",
      icon: "#51341f",
    },
    pressed: {
      top: "#d8bd87",
      bottom: "#c5a66e",
      border: "#70471f",
      icon: "#3f2818",
    },
    disabled: {
      top: "#d7cdb9",
      bottom: "#bdb29f",
      border: "#8e816e",
      icon: "#8a8174",
    },
  }[state];

  context.save();
  const background = context.createLinearGradient(x, y, x, y + rect.height);
  background.addColorStop(0, palette.top);
  background.addColorStop(1, palette.bottom);
  context.beginPath();
  context.roundRect(x, y, rect.width, rect.height, 2);
  context.fillStyle = background;
  context.fill();
  context.lineWidth = 1;
  context.strokeStyle = palette.border;
  context.stroke();

  context.beginPath();
  context.moveTo(x + 2, y + 2.5);
  context.lineTo(x + rect.width - 2, y + 2.5);
  context.strokeStyle = "rgba(255, 255, 236, 0.62)";
  context.stroke();

  const direction = target === "previous" ? -1 : 1;
  const centerX = x + rect.width / 2;
  const centerY = y + rect.height / 2;
  context.beginPath();
  context.moveTo(centerX - direction * 3, centerY - 4);
  context.lineTo(centerX - direction * 3, centerY + 4);
  context.lineTo(centerX + direction * 2, centerY);
  context.closePath();
  context.fillStyle = palette.icon;
  context.fill();
  context.restore();
}

function drawDropdown(
  context: CanvasRenderingContext2D,
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
      getDropdownRowRect(control, row),
      selected ? "selected" : "normal",
      item.label,
      camera,
      false,
    );
  });
}

function drawInstallControls(
  context: CanvasRenderingContext2D,
  layout: NewCharLayout,
  state: CanvasCreatorState,
  pointer: CreatorPointerState,
  camera: Camera,
) {
  const panel = screenRect(layout.installPanel, camera);
  const command = screenRect(layout.installCommand, camera);
  context.save();
  context.beginPath();
  context.roundRect(panel.x, panel.y + 4, panel.width, panel.height, 7);
  context.fillStyle = "rgba(28, 13, 7, 0.62)";
  context.fill();

  const panelBackground = context.createLinearGradient(
    panel.x,
    panel.y,
    panel.x,
    panel.y + panel.height,
  );
  panelBackground.addColorStop(0, "#6a3c20");
  panelBackground.addColorStop(0.52, "#4a2816");
  panelBackground.addColorStop(1, "#2f180e");
  context.beginPath();
  context.roundRect(panel.x, panel.y, panel.width, panel.height, 7);
  context.fillStyle = panelBackground;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#2a1409";
  context.stroke();

  context.beginPath();
  context.roundRect(
    panel.x + 3,
    panel.y + 3,
    panel.width - 6,
    panel.height - 6,
    5,
  );
  context.lineWidth = 1;
  context.strokeStyle = "#d4a64b";
  context.stroke();
  context.beginPath();
  context.roundRect(
    panel.x + 6,
    panel.y + 6,
    panel.width - 12,
    panel.height - 12,
    3,
  );
  context.strokeStyle = "#80511f";
  context.stroke();

  const background = context.createLinearGradient(
    command.x,
    command.y,
    command.x,
    command.y + command.height,
  );
  background.addColorStop(0, "#35271f");
  background.addColorStop(1, "#1f1713");
  context.beginPath();
  context.roundRect(command.x, command.y, command.width, command.height, 4);
  context.fillStyle = background;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#6f4d2c";
  context.stroke();
  context.beginPath();
  context.roundRect(
    command.x + 3,
    command.y + 3,
    command.width - 6,
    command.height - 6,
    2,
  );
  context.lineWidth = 1;
  context.strokeStyle = "#b4874e";
  context.stroke();

  context.beginPath();
  context.rect(
    command.x + 8,
    command.y + 3,
    command.width - 16,
    command.height - 6,
  );
  context.clip();
  context.font = '9px Consolas, "Courier New", monospace';
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillStyle = state.installCommand ? "#f5dfb4" : "#aa9680";
  if (state.installCommand) {
    const parts = state.installCommand.split(" ");
    context.fillText(
      parts.slice(0, -1).join(" "),
      command.x + 9,
      command.y + 13,
    );
    context.fillText(parts.at(-1) ?? "", command.x + 9, command.y + 27);
  } else {
    context.font = textFont;
    context.fillText(
      "Pet을 만들면 설치 명령이 표시됩니다.",
      command.x + 9,
      command.y + command.height / 2 + 1,
    );
  }
  context.restore();

  drawPrimaryButton(
    context,
    layout.copyCommand,
    {
      state: resolveNewCharControlState({
        disabled: !state.installCommand || state.createPending,
        pressed: pointer.pressed === "copyCommand",
        hovered: pointer.hovered === "copyCommand",
        focused: state.focused === "copyCommand",
      }),
      label:
        state.copyState === "success"
          ? "복사 완료"
          : state.copyState === "error"
            ? "복사 실패"
            : "명령어 복사",
    },
    camera,
  );
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
  elapsed: number;
  transitionStartedAt: number;
  reducedMotion: boolean;
  diceAnimationStartedAt: number;
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
    elapsed,
    transitionStartedAt,
    reducedMotion,
    diceAnimationStartedAt,
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
    layout,
    "previous",
    stateIndex === 0 || state.createPending,
    pointer,
    state.focused === "previous",
    camera,
  );
  drawArrow(
    context,
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
    `${STATE_LABELS[state.selectedState]} · ${stateIndex + 1}/${PET_STATES.length}`,
    scrollScreen.x + scrollScreen.width / 2,
    scrollScreen.y + 28,
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
    layout.action,
    dropdown?.kind === "action" ? "selected" : actionState,
    `액션  ${action.label}`,
    camera,
  );
  drawCombo(
    context,
    layout.emotion,
    dropdown?.kind === "emotion" ? "selected" : emotionState,
    `표정  ${emotion.label}`,
    camera,
  );
  drawRandomize(
    context,
    images,
    manifest,
    layout,
    resolveNewCharControlState({
      disabled: state.createPending,
      pressed: pointer.pressed === "randomize",
      hovered: pointer.hovered === "randomize",
      focused: state.focused === "randomize",
    }),
    camera,
    elapsed,
    diceAnimationStartedAt,
    reducedMotion,
  );

  const primaryVisual = resolvePrimaryButtonVisual({
    createPending: state.createPending,
    hasResult: state.hasResult,
    pressed: pointer.pressed === "primary",
    hovered: pointer.hovered === "primary",
    focused: state.focused === "primary",
  });
  drawPrimaryButton(context, layout.primary, primaryVisual, camera);
  drawInstallControls(context, layout, state, pointer, camera);
  drawDropdown(context, layout, state, dropdown, pointer, camera);
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
  const secondaryState = resolveFindCharacterOverlayState({
    creatorVisible: state.visible,
    controlsVisible,
    createPending: state.createPending,
    pressed: pointer.pressed === "secondary",
    hovered: pointer.hovered === "secondary",
    focused: state.focused === "secondary",
  });
  if (!secondaryState) return;
  drawWzButton(
    context,
    images,
    manifest.buttons.findCharacter,
    layout.secondary,
    secondaryState,
  );
}

export function resolveFindCharacterOverlayState(input: {
  creatorVisible: boolean;
  controlsVisible: boolean;
  createPending: boolean;
  pressed?: boolean;
  hovered?: boolean;
  focused?: boolean;
}): NewCharControlState | null {
  if (!input.creatorVisible) return "disabled";
  if (!input.controlsVisible) return null;
  return resolveNewCharControlState({
    disabled: input.createPending,
    pressed: input.pressed,
    hovered: input.hovered,
    focused: input.focused,
  });
}

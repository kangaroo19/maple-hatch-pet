"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from "react";

import {
  getLoginLayout,
  hitTestLogin,
  resolveLoginButtonState,
  validateLogin,
  validateLoginFrameImage,
  type LoginLayout,
  type LoginManifest,
} from "@/features/map-login/login";
import {
  getDropdownWindow,
  getNewCharLayout,
  hitTestNewChar,
  moveDropdownOption,
  validateNewChar,
  type NewCharLayout,
  type NewCharManifest,
  type NewCharTarget,
} from "@/features/map-login/new-char";
import {
  drawNewCharEditor,
  drawNewCharViewportOverlay,
  getDropdownItems,
  getDropdownRowRect,
  getNewCharAssetSources,
  type CanvasCreatorState,
  type CreatorDropdownState,
  type CreatorPointerState,
} from "@/features/map-login/new-char-renderer";
import {
  alphaForFrame,
  frameAtTime,
  getBackgroundPosition,
  getMapCamera,
  getTileMode,
  getViewportScale,
  MAP_LOGIN_VIEWPORT,
  shouldRenderSceneObject,
  validateScene,
  viewportPointToMap,
  type MapLoginScene,
  type SceneFrame,
} from "@/features/map-login/scene";
import {
  PET_STATES,
  type ActionCode,
  type EmotionCode,
} from "@/lib/pet-contract";

const SCENE_CAMERA_OFFSET_Y = 60;

export type CanvasLoginState = {
  visible: boolean;
  nickname: string;
  selectionStart: number;
  selectionEnd: number;
  inputFocused: boolean;
  buttonFocused: boolean;
  buttonPressed: boolean;
  disabled: boolean;
};

export type CanvasCreatorKeyboardCommand = {
  id: number;
  target: "action" | "emotion";
  key: "ArrowUp" | "ArrowDown" | "Enter" | "Escape";
} | null;

type Props = {
  viewportRef: RefObject<HTMLDivElement | null>;
  onReady: (scene: MapLoginScene) => void;
  loginState: CanvasLoginState;
  creatorState: CanvasCreatorState;
  creatorKeyboardCommand: CanvasCreatorKeyboardCommand;
  onInputFocus: () => void;
  onButtonFocus: () => void;
  onButtonActivate: () => void;
  onCreatorFocus: (target: NewCharTarget) => void;
  onStateMove: (direction: -1 | 1) => void;
  onActionChange: (value: ActionCode) => void;
  onEmotionChange: (value: EmotionCode) => void;
  onRandomize: () => void;
  onPrimaryActivate: () => void;
  onSecondaryActivate: () => void;
  onCopyCommandActivate: () => void;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("asset"));
    image.src = src;
  });
}

function pointInRect(
  rect: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number },
) {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

export function MapSceneCanvas({
  viewportRef,
  onReady,
  loginState,
  creatorState,
  creatorKeyboardCommand,
  onInputFocus,
  onButtonFocus,
  onButtonActivate,
  onCreatorFocus,
  onStateMove,
  onActionChange,
  onEmotionChange,
  onRandomize,
  onPrimaryActivate,
  onSecondaryActivate,
  onCopyCommandActivate,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MapLoginScene | null>(null);
  const loginLayoutRef = useRef<LoginLayout | null>(null);
  const newCharLayoutRef = useRef<NewCharLayout | null>(null);
  const newCharManifestRef = useRef<NewCharManifest | null>(null);
  const creatorControlsVisibleRef = useRef(false);
  const scaleRef = useRef(1);
  const loginPointerRef = useRef({ hovered: false, pressed: false });
  const creatorPointerRef = useRef<
    CreatorPointerState & { optionPressed: number | null }
  >({
    hovered: null,
    pressed: null,
    optionHovered: null,
    optionPressed: null,
  });
  const dropdownRef = useRef<CreatorDropdownState>(null);
  const previewRef = useRef<{
    url: string | null;
    image: HTMLImageElement | null;
  }>({ url: null, image: null });
  const previewCacheRef = useRef(new Map<string, HTMLImageElement>());
  const reducedMotionRef = useRef(false);
  const lastKeyboardCommandRef = useRef(0);
  const transitionRef = useRef({
    visible: creatorState.visible,
    closing: creatorState.closing,
    startedAt: 0,
  });
  const diceAnimationRef = useRef({
    revision: creatorState.randomizeRevision,
    startedAt: Number.NEGATIVE_INFINITY,
  });
  const loginRef = useRef({
    state: loginState,
    onInputFocus,
    onButtonFocus,
    onButtonActivate,
  });
  const creatorRef = useRef({
    state: creatorState,
    keyboardCommand: creatorKeyboardCommand,
    onCreatorFocus,
    onStateMove,
    onActionChange,
    onEmotionChange,
    onRandomize,
    onPrimaryActivate,
    onSecondaryActivate,
    onCopyCommandActivate,
  });
  const [failed, setFailed] = useState(false);
  const [creatorAssetsFailed, setCreatorAssetsFailed] = useState(false);
  const [previewFailedUrl, setPreviewFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    loginRef.current = {
      state: loginState,
      onInputFocus,
      onButtonFocus,
      onButtonActivate,
    };
  }, [loginState, onButtonActivate, onButtonFocus, onInputFocus]);

  useEffect(() => {
    creatorRef.current = {
      state: creatorState,
      keyboardCommand: creatorKeyboardCommand,
      onCreatorFocus,
      onStateMove,
      onActionChange,
      onEmotionChange,
      onRandomize,
      onPrimaryActivate,
      onSecondaryActivate,
      onCopyCommandActivate,
    };
    if (!creatorState.visible || creatorState.closing) {
      dropdownRef.current = null;
    }
  }, [
    creatorState,
    creatorKeyboardCommand,
    onActionChange,
    onCreatorFocus,
    onEmotionChange,
    onRandomize,
    onCopyCommandActivate,
    onPrimaryActivate,
    onSecondaryActivate,
    onStateMove,
  ]);

  useEffect(() => {
    const url = creatorState.previewUrl;
    if (!url) {
      previewRef.current = { url: null, image: null };
      return;
    }
    const cached = previewCacheRef.current.get(url);
    if (cached) {
      previewRef.current = { url, image: cached };
      return;
    }
    let cancelled = false;
    let attempt = 0;
    const loadPreview = () => {
      const image = new Image();
      image.onload = () => {
        previewCacheRef.current.set(url, image);
        if (!cancelled) {
          previewRef.current = { url, image };
          setPreviewFailedUrl((current) => (current === url ? null : current));
        }
      };
      image.onerror = () => {
        if (cancelled) return;
        if (attempt < 1) {
          attempt += 1;
          loadPreview();
          return;
        }
        setPreviewFailedUrl(url);
      };
      image.src = url;
    };
    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [creatorState.previewUrl]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedMotionRef.current = query.matches;
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const closeDropdown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dropdownRef.current = null;
    };
    window.addEventListener("keydown", closeDropdown);
    return () => window.removeEventListener("keydown", closeDropdown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    const controller = new AbortController();

    async function start() {
      const [sceneResponse, loginResponse] = await Promise.all([
        fetch("/map-login/kms-v43/scene.json", {
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch("/map-login/kms-v43/login.json", {
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);
      if (!sceneResponse.ok || !loginResponse.ok) throw new Error("manifest");
      const scene = validateScene(await sceneResponse.json());
      const login = validateLogin(await loginResponse.json());
      const visibleSceneObjects = scene.objects.filter((item) =>
        shouldRenderSceneObject(item.source),
      );
      const sceneSources = [
        ...scene.backgrounds,
        ...visibleSceneObjects,
      ].flatMap((item) => item.frames.map((frame) => frame.asset));
      const loginSources = Object.values(login.login).map(
        (asset) => asset.asset,
      );
      const sources = new Set([
        ...sceneSources,
        login.frame.asset,
        ...loginSources,
      ]);
      const loaded = await Promise.all(
        [...sources].map(async (src) => [src, await loadImage(src)] as const),
      );
      if (cancelled) return;
      const images = new Map(loaded);
      validateLoginFrameImage(login, images.get(login.frame.asset)!);
      const viewport = viewportRef.current;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d", { alpha: false });
      if (!viewport || !canvas || !context) throw new Error("canvas");
      const activeViewport = viewport;
      const activeCanvas = canvas;
      const activeContext = context;
      let scale = 1;
      let deviceScale = 1;

      sceneRef.current = scene;
      loginLayoutRef.current = getLoginLayout(scene);

      async function loadCreatorAssets() {
        try {
          const response = await fetch("/map-login/kms-v43/new-char.json", {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("manifest");
          const manifest = validateNewChar(await response.json());
          const creatorImages = await Promise.all(
            getNewCharAssetSources(manifest).map(
              async (src) => [src, await loadImage(src)] as const,
            ),
          );
          if (cancelled) return;
          creatorImages.forEach(([src, image]) => images.set(src, image));
          newCharLayoutRef.current = getNewCharLayout(scene, manifest);
          newCharManifestRef.current = manifest;
        } catch (error) {
          if (
            cancelled ||
            (error instanceof DOMException && error.name === "AbortError")
          )
            return;
          setCreatorAssetsFailed(true);
        }
      }
      void loadCreatorAssets();

      function resize() {
        scale = getViewportScale(activeViewport.clientWidth);
        scaleRef.current = scale;
        deviceScale = Math.min(window.devicePixelRatio || 1, 2);
        activeCanvas.width = Math.ceil(MAP_LOGIN_VIEWPORT.width * deviceScale);
        activeCanvas.height = Math.ceil(
          MAP_LOGIN_VIEWPORT.height * deviceScale,
        );
        activeCanvas.style.height = `${MAP_LOGIN_VIEWPORT.height * scale}px`;
        activeContext.imageSmoothingEnabled = false;
      }

      function drawFrame(
        image: HTMLImageElement,
        anchorX: number,
        anchorY: number,
        frame: SceneFrame,
        flip: number,
        alpha: number,
      ) {
        if (alpha <= 0) return;
        activeContext.save();
        activeContext.globalAlpha = Math.max(0, Math.min(1, alpha));
        activeContext.translate(Math.floor(anchorX), Math.floor(anchorY));
        if (flip) activeContext.scale(-1, 1);
        activeContext.drawImage(image, -frame.origin.x, -frame.origin.y);
        activeContext.restore();
      }

      function drawLogin(
        elapsed: number,
        camera: { left: number; top: number },
        manifest: LoginManifest,
      ) {
        const state = loginRef.current.state;
        const layout = loginLayoutRef.current;
        if (!state.visible || !layout) return;
        const buttonState = resolveLoginButtonState({
          disabled: state.disabled,
          pressed: loginPointerRef.current.pressed || state.buttonPressed,
          hovered: loginPointerRef.current.hovered,
          focused: state.buttonFocused,
        });
        const button = layout.button;
        activeContext.drawImage(
          images.get(manifest.login[buttonState].asset)!,
          Math.floor(button.x - camera.left),
          Math.floor(button.y - camera.top),
        );

        const input = layout.input;
        const x = input.x - camera.left;
        const y = input.y - camera.top;
        const padding = 3;
        const textY = y + input.height / 2;
        activeContext.save();
        activeContext.beginPath();
        activeContext.rect(x, y, input.width, input.height);
        activeContext.clip();
        activeContext.font = '13px Dotum, "돋움", sans-serif';
        activeContext.textBaseline = "middle";
        const caretIndex = Math.min(
          state.nickname.length,
          Math.max(0, state.selectionEnd),
        );
        const caretWidth = activeContext.measureText(
          state.nickname.slice(0, caretIndex),
        ).width;
        const availableWidth = input.width - padding * 2;
        const textOffset = Math.min(0, availableWidth - caretWidth);
        const textX = x + padding + textOffset;
        if (state.inputFocused && state.selectionStart !== state.selectionEnd) {
          const selectionStart = Math.min(
            state.selectionStart,
            state.selectionEnd,
          );
          const selectionEnd = Math.max(
            state.selectionStart,
            state.selectionEnd,
          );
          const selectionX =
            textX +
            activeContext.measureText(state.nickname.slice(0, selectionStart))
              .width;
          const selectionWidth = activeContext.measureText(
            state.nickname.slice(selectionStart, selectionEnd),
          ).width;
          activeContext.fillStyle = "#477eae";
          activeContext.fillRect(selectionX, y + 3, selectionWidth, 18);
        }
        activeContext.fillStyle = state.nickname
          ? "#fff4d5"
          : "rgba(255, 244, 213, 0.56)";
        activeContext.shadowColor = "#3b1a08";
        activeContext.shadowBlur = 1;
        activeContext.shadowOffsetY = 1;
        activeContext.fillText(
          state.nickname || "캐릭터 닉네임",
          textX,
          textY,
        );
        if (
          state.inputFocused &&
          !state.disabled &&
          state.selectionStart === state.selectionEnd &&
          elapsed % 1000 < 500
        ) {
          activeContext.shadowColor = "transparent";
          activeContext.fillStyle = "#fff8df";
          activeContext.fillRect(
            Math.floor(textX + caretWidth),
            y + 4,
            1,
            input.height - 8,
          );
        }
        activeContext.restore();

        const passwordIndicator = layout.passwordIndicator;
        const passwordX = passwordIndicator.x - camera.left;
        const passwordY = passwordIndicator.y - camera.top;
        activeContext.save();
        activeContext.fillStyle = "rgba(48, 24, 8, 0.58)";
        activeContext.fillRect(
          Math.floor(passwordX),
          Math.floor(passwordY),
          passwordIndicator.width,
          passwordIndicator.height,
        );
        activeContext.restore();
      }

      function handleCreatorKeyboardCommand(
        command: NonNullable<CanvasCreatorKeyboardCommand>,
      ) {
        if (command.key === "Escape") {
          dropdownRef.current = null;
          creatorPointerRef.current.optionHovered = null;
          return;
        }
        const items = getDropdownItems(command.target);
        const state = creatorRef.current.state;
        const selected =
          command.target === "action"
            ? state.selectedAction
            : state.selectedEmotion;
        const selectedIndex = Math.max(
          0,
          items.findIndex((item) => item.code === selected),
        );
        let dropdown = dropdownRef.current;
        const wasOpen = dropdown?.kind === command.target;
        if (!wasOpen) {
          const start = getDropdownWindow(
            items.length,
            selectedIndex,
            selectedIndex - 3,
          ).start;
          dropdown = { kind: command.target, start };
          dropdownRef.current = dropdown;
          creatorPointerRef.current.optionHovered = selectedIndex - start;
        }
        if (!dropdown) return;
        const active =
          creatorPointerRef.current.optionHovered === null
            ? selectedIndex
            : dropdown.start + creatorPointerRef.current.optionHovered;

        if (command.key === "Enter") {
          if (!wasOpen) return;
          const item = items[active];
          if (item) {
            if (command.target === "action")
              creatorRef.current.onActionChange(item.code as ActionCode);
            else creatorRef.current.onEmotionChange(item.code as EmotionCode);
          }
          dropdownRef.current = null;
          creatorPointerRef.current.optionHovered = null;
          return;
        }

        const moved = moveDropdownOption(
          items.length,
          { start: dropdown.start, active },
          command.key === "ArrowDown" ? 1 : -1,
        );
        dropdownRef.current = { kind: command.target, start: moved.start };
        creatorPointerRef.current.optionHovered = moved.active - moved.start;
      }

      const startedAt = performance.now();
      function render(now: number) {
        const elapsed = now - startedAt;
        const camera = getMapCamera(
          scene.map,
          activeViewport.scrollTop + SCENE_CAMERA_OFFSET_Y * scale,
          scale,
        );
        activeContext.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        activeContext.globalAlpha = 1;
        activeContext.fillStyle = "#050a11";
        activeContext.fillRect(
          0,
          0,
          MAP_LOGIN_VIEWPORT.width,
          MAP_LOGIN_VIEWPORT.height,
        );

        const drawBackground = (
          background: MapLoginScene["backgrounds"][number],
        ) => {
          const selection = frameAtTime(background.frames, elapsed);
          const image = images.get(selection.frame.asset)!;
          const mode = getTileMode(background.type);
          const anchor = getBackgroundPosition(
            background,
            camera,
            elapsed,
            image,
          );
          const cellWidth = background.cx || image.width;
          const cellHeight = background.cy || image.height;
          const left = anchor.x - selection.frame.origin.x;
          const top = anchor.y - selection.frame.origin.y;
          const firstColumn = mode.horizontal
            ? Math.floor(-left / cellWidth) - 1
            : 0;
          const lastColumn = mode.horizontal
            ? Math.ceil((MAP_LOGIN_VIEWPORT.width - left) / cellWidth) + 1
            : 1;
          const firstRow = mode.vertical
            ? Math.floor(-top / cellHeight) - 1
            : 0;
          const lastRow = mode.vertical
            ? Math.ceil((MAP_LOGIN_VIEWPORT.height - top) / cellHeight) + 1
            : 1;
          for (let row = firstRow; row < lastRow; row += 1) {
            for (let column = firstColumn; column < lastColumn; column += 1) {
              drawFrame(
                image,
                anchor.x + column * cellWidth,
                anchor.y + row * cellHeight,
                selection.frame,
                background.f,
                alphaForFrame(selection, background.a),
              );
            }
          }
        };

        scene.backgrounds.filter((item) => !item.front).forEach(drawBackground);
        visibleSceneObjects.forEach((object) => {
          const selection = frameAtTime(object.frames, elapsed);
          drawFrame(
            images.get(selection.frame.asset)!,
            object.x - camera.left,
            object.y - camera.top,
            selection.frame,
            object.f,
            alphaForFrame(selection, object.a),
          );
        });
        scene.backgrounds.filter((item) => item.front).forEach(drawBackground);
        drawLogin(elapsed, camera, login);

        const current = creatorRef.current.state;
        if (diceAnimationRef.current.revision !== current.randomizeRevision) {
          diceAnimationRef.current = {
            revision: current.randomizeRevision,
            startedAt:
              current.randomizeRevision === 0
                ? Number.NEGATIVE_INFINITY
                : elapsed,
          };
        }
        const keyboardCommand = creatorRef.current.keyboardCommand;
        if (
          keyboardCommand &&
          keyboardCommand.id !== lastKeyboardCommandRef.current
        ) {
          lastKeyboardCommandRef.current = keyboardCommand.id;
          handleCreatorKeyboardCommand(keyboardCommand);
        }
        if (
          transitionRef.current.visible !== current.visible ||
          transitionRef.current.closing !== current.closing
        ) {
          transitionRef.current = {
            visible: current.visible,
            closing: current.closing,
            startedAt: elapsed,
          };
        }
        if (
          current.visible &&
          !current.closing &&
          activeViewport.scrollTop > Math.max(2, scale * 2)
        ) {
          transitionRef.current.startedAt = elapsed;
        }
        const newCharLayout = newCharLayoutRef.current;
        const newChar = newCharManifestRef.current;
        creatorControlsVisibleRef.current = false;
        if (newCharLayout && newChar) {
          creatorControlsVisibleRef.current = drawNewCharEditor({
            context: activeContext,
            images,
            preview:
              previewRef.current.url === current.previewUrl
                ? previewRef.current.image
                : null,
            manifest: newChar,
            layout: newCharLayout,
            state: current,
            pointer: creatorPointerRef.current,
            dropdown: dropdownRef.current,
            camera,
            elapsed,
            transitionStartedAt: transitionRef.current.startedAt,
            reducedMotion: reducedMotionRef.current,
            diceAnimationStartedAt: diceAnimationRef.current.startedAt,
          });
        }
        activeContext.globalAlpha = 1;
        activeContext.drawImage(images.get(login.frame.asset)!, 0, 0);
        if (newCharLayout && newChar) {
          drawNewCharViewportOverlay({
            context: activeContext,
            images,
            manifest: newChar,
            layout: newCharLayout,
            state: current,
            pointer: creatorPointerRef.current,
            controlsVisible: creatorControlsVisibleRef.current,
          });
        }
        animationFrame = requestAnimationFrame(render);
      }

      resize();
      window.addEventListener("resize", resize);
      onReady(scene);
      animationFrame = requestAnimationFrame(render);
      return () => window.removeEventListener("resize", resize);
    }

    let removeResize: (() => void) | undefined;
    start()
      .then((cleanup) => {
        removeResize = cleanup;
      })
      .catch((error: unknown) => {
        if (
          cancelled ||
          (error instanceof DOMException && error.name === "AbortError")
        )
          return;
        console.error("MapLogin scene failed to load");
        setFailed(true);
      });
    return () => {
      cancelled = true;
      controller.abort();
      cancelAnimationFrame(animationFrame);
      removeResize?.();
      sceneRef.current = null;
      loginLayoutRef.current = null;
      newCharLayoutRef.current = null;
      newCharManifestRef.current = null;
      creatorControlsVisibleRef.current = false;
    };
  }, [onReady, viewportRef]);

  function pointerPoints(event: ReactPointerEvent<HTMLCanvasElement>) {
    const scene = sceneRef.current;
    const viewport = viewportRef.current;
    if (!scene || !viewport) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = scaleRef.current;
    const point = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    const camera = getMapCamera(
      scene.map,
      viewport.scrollTop + SCENE_CAMERA_OFFSET_Y * scale,
      scale,
    );
    return {
      map: viewportPointToMap(point, camera, scale),
      viewport: { x: point.x / scale, y: point.y / scale },
    };
  }

  function loginTargetAt(event: ReactPointerEvent<HTMLCanvasElement>) {
    const layout = loginLayoutRef.current;
    const points = pointerPoints(event);
    if (!loginRef.current.state.visible || !layout || !points) return null;
    return hitTestLogin(layout, points.map);
  }

  function optionAt(point: { x: number; y: number }) {
    const dropdown = dropdownRef.current;
    const layout = newCharLayoutRef.current;
    if (!dropdown || !layout) return null;
    const items = getDropdownItems(dropdown.kind);
    const count = Math.min(8, items.length - dropdown.start);
    for (let row = 0; row < count; row += 1) {
      if (pointInRect(getDropdownRowRect(layout[dropdown.kind], row), point)) {
        return { row, index: dropdown.start + row };
      }
    }
    return null;
  }

  function creatorTargetAt(event: ReactPointerEvent<HTMLCanvasElement>) {
    const layout = newCharLayoutRef.current;
    const points = pointerPoints(event);
    const state = creatorRef.current.state;
    if (
      !state.visible ||
      state.closing ||
      !creatorControlsVisibleRef.current ||
      !layout ||
      !points
    )
      return null;
    return hitTestNewChar(layout, points);
  }

  function creatorTargetDisabled(target: NewCharTarget) {
    const state = creatorRef.current.state;
    const index = PET_STATES.indexOf(state.selectedState);
    if (state.createPending) return true;
    if (target === "copyCommand") return !state.installCommand;
    if (target === "previous") return index === 0;
    if (target === "next") return index === PET_STATES.length - 1;
    if (target === "action")
      return (
        state.selectedState === "running-left" ||
        state.selectedState === "running-right"
      );
    return false;
  }

  function updatePointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    const loginTarget = loginTargetAt(event);
    loginPointerRef.current.hovered = loginTarget === "button";
    const point = pointerPoints(event)?.map;
    const option = point ? optionAt(point) : null;
    const creatorTarget = creatorTargetAt(event);
    creatorPointerRef.current.optionHovered = option?.row ?? null;
    creatorPointerRef.current.hovered = creatorTarget;
    event.currentTarget.style.cursor =
      loginTarget === "input"
        ? "text"
        : loginTarget === "button" && !loginRef.current.state.disabled
          ? "pointer"
          : option || (creatorTarget && !creatorTargetDisabled(creatorTarget))
            ? "pointer"
            : "default";
  }

  function showDropdown(kind: "action" | "emotion") {
    const state = creatorRef.current.state;
    const items = getDropdownItems(kind);
    const selected =
      kind === "action" ? state.selectedAction : state.selectedEmotion;
    const selectedIndex = items.findIndex((item) => item.code === selected);
    const start = getDropdownWindow(
      items.length,
      selectedIndex,
      selectedIndex - 3,
    ).start;
    dropdownRef.current = {
      kind,
      start,
    };
    creatorPointerRef.current.optionHovered = selectedIndex - start;
  }

  function openDropdown(kind: "action" | "emotion") {
    if (dropdownRef.current?.kind === kind) {
      dropdownRef.current = null;
      creatorPointerRef.current.optionHovered = null;
      return;
    }
    showDropdown(kind);
  }

  function activateCreatorTarget(target: NewCharTarget) {
    const callbacks = creatorRef.current;
    if (target === "previous") callbacks.onStateMove(-1);
    else if (target === "next") callbacks.onStateMove(1);
    else if (target === "action" || target === "emotion") openDropdown(target);
    else if (target === "randomize") {
      dropdownRef.current = null;
      callbacks.onRandomize();
    } else if (target === "primary") callbacks.onPrimaryActivate();
    else if (target === "secondary") callbacks.onSecondaryActivate();
    else callbacks.onCopyCommandActivate();
  }

  if (failed)
    return (
      <div className="scene-fatal" role="alert">
        화면을 불러오지 못했습니다. 페이지를 새로고침해 주세요.
      </div>
    );
  const creatorFailure =
    creatorState.visible &&
    (creatorAssetsFailed || previewFailedUrl === creatorState.previewUrl);
  return (
    <>
      <canvas
        ref={canvasRef}
        className="map-canvas"
        aria-label="메이플스토리 로그인 및 Pet 편집 맵"
        hidden={creatorFailure}
        onWheel={(event: ReactWheelEvent<HTMLCanvasElement>) => {
          const dropdown = dropdownRef.current;
          if (!dropdown) return;
          event.preventDefault();
          const total = getDropdownItems(dropdown.kind).length;
          dropdownRef.current = {
            ...dropdown,
            start: Math.min(
              Math.max(0, total - 8),
              Math.max(0, dropdown.start + (event.deltaY > 0 ? 1 : -1)),
            ),
          };
          creatorPointerRef.current.optionHovered = null;
        }}
        onPointerMove={updatePointer}
        onPointerLeave={(event) => {
          loginPointerRef.current.hovered = false;
          creatorPointerRef.current.hovered = null;
          creatorPointerRef.current.optionHovered = null;
          event.currentTarget.style.cursor = "default";
        }}
        onPointerDown={(event) => {
          const loginTarget = loginTargetAt(event);
          if (loginTarget === "input") {
            event.preventDefault();
            loginRef.current.onInputFocus();
            return;
          }
          if (loginTarget === "button" && !loginRef.current.state.disabled) {
            event.preventDefault();
            loginPointerRef.current.pressed = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            loginRef.current.onButtonFocus();
            return;
          }
          const point = pointerPoints(event)?.map;
          const option = point ? optionAt(point) : null;
          if (option) {
            event.preventDefault();
            creatorPointerRef.current.optionPressed = option.index;
            event.currentTarget.setPointerCapture(event.pointerId);
            return;
          }
          const target = creatorTargetAt(event);
          if (!target || creatorTargetDisabled(target)) {
            if (dropdownRef.current) dropdownRef.current = null;
            return;
          }
          event.preventDefault();
          creatorPointerRef.current.pressed = target;
          event.currentTarget.setPointerCapture(event.pointerId);
          creatorRef.current.onCreatorFocus(target);
        }}
        onPointerUp={(event) => {
          const loginActivate =
            loginPointerRef.current.pressed &&
            loginTargetAt(event) === "button" &&
            !loginRef.current.state.disabled;
          loginPointerRef.current.pressed = false;
          if (loginActivate) loginRef.current.onButtonActivate();

          const point = pointerPoints(event)?.map;
          const option = point ? optionAt(point) : null;
          const pressedOption = creatorPointerRef.current.optionPressed;
          creatorPointerRef.current.optionPressed = null;
          if (option && option.index === pressedOption && dropdownRef.current) {
            const dropdown = dropdownRef.current;
            const item = getDropdownItems(dropdown.kind)[option.index];
            if (item) {
              if (dropdown.kind === "action")
                creatorRef.current.onActionChange(item.code as ActionCode);
              else creatorRef.current.onEmotionChange(item.code as EmotionCode);
            }
            dropdownRef.current = null;
          } else {
            const target = creatorTargetAt(event);
            const pressed = creatorPointerRef.current.pressed;
            creatorPointerRef.current.pressed = null;
            if (
              target &&
              target === pressed &&
              !creatorTargetDisabled(target)
            ) {
              activateCreatorTarget(target);
            }
          }
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          loginPointerRef.current.pressed = false;
          creatorPointerRef.current.pressed = null;
          creatorPointerRef.current.optionPressed = null;
        }}
      />
      {creatorFailure ? (
        <div className="scene-fatal" role="alert">
          캐릭터 편집 화면을 불러오지 못했습니다. 페이지를 새로고침해 주세요.
        </div>
      ) : null}
    </>
  );
}

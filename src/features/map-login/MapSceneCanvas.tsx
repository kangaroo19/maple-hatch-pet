"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

import {
  getLoginLayout,
  hitTestLogin,
  resolveLoginButtonState,
  validateLogin,
  type LoginLayout,
  type LoginManifest,
} from "@/features/map-login/login";
import {
  alphaForFrame,
  frameAtTime,
  getBackgroundPosition,
  getTileMode,
  validateScene,
  type MapLoginScene,
  type SceneFrame,
} from "@/features/map-login/scene";

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

type Props = {
  viewportRef: RefObject<HTMLDivElement | null>;
  onReady: (scene: MapLoginScene) => void;
  loginState: CanvasLoginState;
  onInputFocus: () => void;
  onButtonFocus: () => void;
  onButtonActivate: () => void;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("asset"));
    image.src = src;
  });
}

export function MapSceneCanvas({
  viewportRef,
  onReady,
  loginState,
  onInputFocus,
  onButtonFocus,
  onButtonActivate,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MapLoginScene | null>(null);
  const layoutRef = useRef<LoginLayout | null>(null);
  const scaleRef = useRef(1);
  const pointerRef = useRef({ hovered: false, pressed: false });
  const loginRef = useRef({
    state: loginState,
    onInputFocus,
    onButtonFocus,
    onButtonActivate,
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loginRef.current = {
      state: loginState,
      onInputFocus,
      onButtonFocus,
      onButtonActivate,
    };
  }, [loginState, onButtonActivate, onButtonFocus, onInputFocus]);

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
      const sceneSources = [...scene.backgrounds, ...scene.objects].flatMap(
        (item) => item.frames.map((frame) => frame.asset),
      );
      const loginSources = Object.values(login.login).map(
        (asset) => asset.asset,
      );
      const sources = new Set([...sceneSources, ...loginSources]);
      const loaded = await Promise.all(
        [...sources].map(async (src) => [src, await loadImage(src)] as const),
      );
      if (cancelled) return;
      const images = new Map(loaded);
      const viewport = viewportRef.current;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d", { alpha: false });
      if (!viewport || !canvas || !context) throw new Error("canvas");
      const activeViewport = viewport;
      const activeCanvas = canvas;
      const activeContext = context;
      let scale = 1;
      let logicalHeight = 600;
      let deviceScale = 1;

      sceneRef.current = scene;
      layoutRef.current = getLoginLayout(scene);

      function resize() {
        scale = activeViewport.clientWidth / scene.map.width;
        scaleRef.current = scale;
        logicalHeight = Math.min(
          scene.map.height,
          Math.ceil(activeViewport.clientHeight / scale),
        );
        deviceScale = Math.min(window.devicePixelRatio || 1, 2);
        activeCanvas.width = Math.ceil(scene.map.width * deviceScale);
        activeCanvas.height = Math.ceil(logicalHeight * deviceScale);
        activeCanvas.style.height = `${logicalHeight * scale}px`;
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
        const layout = layoutRef.current;
        if (!state.visible || !layout) return;

        const buttonState = resolveLoginButtonState({
          disabled: state.disabled,
          pressed: pointerRef.current.pressed || state.buttonPressed,
          hovered: pointerRef.current.hovered,
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

        if (
          state.inputFocused &&
          state.selectionStart !== state.selectionEnd
        ) {
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
            activeContext.measureText(
              state.nickname.slice(0, selectionStart),
            ).width;
          const selectionWidth = activeContext.measureText(
            state.nickname.slice(selectionStart, selectionEnd),
          ).width;
          activeContext.fillStyle = "#477eae";
          activeContext.fillRect(selectionX, y + 3, selectionWidth, 18);
        }

        activeContext.fillStyle = "#fff4d5";
        activeContext.shadowColor = "#3b1a08";
        activeContext.shadowBlur = 1;
        activeContext.shadowOffsetY = 1;
        activeContext.fillText(state.nickname, textX, textY);

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
      }

      const startedAt = performance.now();
      function render(now: number) {
        const elapsed = now - startedAt;
        const sceneTop = activeViewport.scrollTop / scale;
        const camera = {
          left: -scene.map.centerX,
          top: sceneTop - scene.map.centerY,
          centerX: -scene.map.centerX + scene.map.width / 2,
          centerY: sceneTop - scene.map.centerY + logicalHeight / 2,
        };
        activeContext.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
        activeContext.globalAlpha = 1;
        activeContext.fillStyle = "#050a11";
        activeContext.fillRect(0, 0, scene.map.width, logicalHeight);

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
            ? Math.ceil((scene.map.width - left) / cellWidth) + 1
            : 1;
          const firstRow = mode.vertical
            ? Math.floor(-top / cellHeight) - 1
            : 0;
          const lastRow = mode.vertical
            ? Math.ceil((logicalHeight - top) / cellHeight) + 1
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
        scene.objects.forEach((object) => {
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
      layoutRef.current = null;
    };
  }, [onReady, viewportRef]);

  function mapPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const scene = sceneRef.current;
    const viewport = viewportRef.current;
    if (!scene || !viewport) return null;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = scaleRef.current;
    return {
      x:
        (event.clientX - bounds.left) / scale - scene.map.centerX,
      y:
        (event.clientY - bounds.top) / scale +
        viewport.scrollTop / scale -
        scene.map.centerY,
    };
  }

  function targetAt(event: ReactPointerEvent<HTMLCanvasElement>) {
    const layout = layoutRef.current;
    const point = mapPoint(event);
    if (!loginRef.current.state.visible || !layout || !point) return null;
    return hitTestLogin(layout, point);
  }

  function updatePointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    const target = targetAt(event);
    pointerRef.current.hovered = target === "button";
    event.currentTarget.style.cursor =
      target === "input"
        ? "text"
        : target === "button" && !loginRef.current.state.disabled
          ? "pointer"
          : "default";
  }

  if (failed)
    return (
      <div className="scene-fatal" role="alert">
        화면을 불러오지 못했습니다. 페이지를 새로고침해 주세요.
      </div>
    );
  return (
    <canvas
      ref={canvasRef}
      className="map-canvas"
      aria-label="메이플스토리 로그인 맵"
      onPointerMove={updatePointer}
      onPointerLeave={(event) => {
        pointerRef.current.hovered = false;
        event.currentTarget.style.cursor = "default";
      }}
      onPointerDown={(event) => {
        const target = targetAt(event);
        if (target === "input") {
          event.preventDefault();
          loginRef.current.onInputFocus();
          return;
        }
        if (target === "button" && !loginRef.current.state.disabled) {
          event.preventDefault();
          pointerRef.current.pressed = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          loginRef.current.onButtonFocus();
        }
      }}
      onPointerUp={(event) => {
        const activate =
          pointerRef.current.pressed &&
          targetAt(event) === "button" &&
          !loginRef.current.state.disabled;
        pointerRef.current.pressed = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        if (activate) loginRef.current.onButtonActivate();
      }}
      onPointerCancel={() => {
        pointerRef.current.pressed = false;
      }}
    />
  );
}

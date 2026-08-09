"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import {
  alphaForFrame,
  frameAtTime,
  getBackgroundPosition,
  getTileMode,
  validateScene,
  type MapLoginScene,
  type SceneFrame,
} from "@/features/map-login/scene";

type Props = {
  viewportRef: RefObject<HTMLDivElement | null>;
  onReady: (scene: MapLoginScene) => void;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("asset"));
    image.src = src;
  });
}

export function MapSceneCanvas({ viewportRef, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let animationFrame = 0;
    const controller = new AbortController();

    async function start() {
      const response = await fetch("/map-login/kms-v43/scene.json", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("scene");
      const scene = validateScene(await response.json());
      const sources = new Set(
        [...scene.backgrounds, ...scene.objects].flatMap((item) =>
          item.frames.map((frame) => frame.asset),
        ),
      );
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

      function resize() {
        scale = activeViewport.clientWidth / scene.map.width;
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
    };
  }, [onReady, viewportRef]);

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
      aria-label="스크롤 가능한 메이플스토리 로그인 맵"
    />
  );
}

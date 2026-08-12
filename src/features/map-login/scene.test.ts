import { describe, expect, it } from "vitest";

import {
  alphaForFrame,
  frameAtTime,
  getBackgroundPosition,
  getTileMode,
  shouldRenderSceneObject,
  validateScene,
} from "@/features/map-login/scene";

const frames = [
  {
    asset: "a.png",
    width: 1,
    height: 1,
    delay: 80,
    origin: { x: 0, y: 0 },
    z: 0,
    a0: 0,
    a1: 255,
  },
  {
    asset: "b.png",
    width: 1,
    height: 1,
    delay: 120,
    origin: { x: 0, y: 0 },
    z: 0,
    a0: 255,
    a1: 255,
  },
  {
    asset: "c.png",
    width: 1,
    height: 1,
    delay: 200,
    origin: { x: 0, y: 0 },
    z: 0,
    a0: 255,
    a1: 255,
  },
];

describe("MapLogin scene math", () => {
  it("selects frames at delay boundaries and wraps negative time", () => {
    expect(frameAtTime(frames, 0).index).toBe(0);
    expect(frameAtTime(frames, 79).index).toBe(0);
    expect(frameAtTime(frames, 80).index).toBe(1);
    expect(frameAtTime(frames, 200).index).toBe(2);
    expect(frameAtTime(frames, 400).index).toBe(0);
    expect(frameAtTime(frames, -1).index).toBe(2);
  });

  it("keeps type 6 horizontal movement distinct from type 7 vertical movement", () => {
    expect(getTileMode(6)).toEqual({
      horizontal: true,
      vertical: true,
      scrollHorizontal: true,
      scrollVertical: false,
    });
    expect(getTileMode(7)).toEqual({
      horizontal: true,
      vertical: true,
      scrollHorizontal: false,
      scrollVertical: true,
    });
  });

  it("matches the PoC background position and combines alpha interpolation", () => {
    expect(
      getBackgroundPosition(
        { x: -21, y: -1847, rx: -5, ry: -100, type: 4, cx: 0, cy: 0 },
        { centerX: 62, centerY: -1800, top: -2100, left: -362 },
        2000,
        { width: 224, height: 102 },
      ),
    ).toEqual({ x: 291, y: 253 });
    expect(
      alphaForFrame({ frame: frames[0]!, index: 0, progress: 0.5 }, 128),
    ).toBeCloseTo(0.25098, 4);
  });

  it("hides the original NewChar stat panel without hiding other scene objects", () => {
    expect(
      shouldRenderSceneObject("Map.wz/Obj/login.img/NewChar/signboard/0"),
    ).toBe(false);
    expect(
      shouldRenderSceneObject("Map.wz/Obj/login.img/Title/signboard/0"),
    ).toBe(true);
  });
});

describe("MapLogin manifest validation", () => {
  it("rejects unsupported scene versions before rendering", () => {
    expect(() => validateScene({ formatVersion: 2 })).toThrow("장면 데이터");
  });
});

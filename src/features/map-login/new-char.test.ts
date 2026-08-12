import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  NEW_CHAR_MUSHROOM_SOURCE,
  frameAtTimeOnce,
  getDropdownWindow,
  getNewCharLayout,
  hitTestNewChar,
  moveDropdownOption,
  movePetState,
  rectContains,
  resolveNewCharControlState,
  validateNewChar,
  type NewCharManifest,
} from "@/features/map-login/new-char";
import { validateScene } from "@/features/map-login/scene";

const scene = validateScene(
  JSON.parse(
    readFileSync("public/map-login/kms-v43/scene.json", "utf8"),
  ) as unknown,
);

const asset = (width: number, height: number) => ({
  asset: `/asset-${width}-${height}.png`,
  width,
  height,
  source: "UI.wz/test",
});

const button = {
  normal: asset(15, 16),
  mouseOver: asset(15, 16),
  pressed: asset(15, 16),
  disabled: asset(15, 16),
};

const fixture: NewCharManifest = {
  formatVersion: 1,
  source: {
    newChar: "UI.wz/Login.img/NewChar",
    basic: "UI.wz/Basic.img",
    patchVersion: 43,
    keySource: "ZLZ.dll",
  },
  scroll: {
    open: [
      { ...asset(242, 30), delay: 250, origin: { x: 0, y: 0 } },
      { ...asset(242, 169), delay: 50, origin: { x: 0, y: 0 } },
      { ...asset(242, 167), delay: 50, origin: { x: 0, y: 0 } },
      { ...asset(242, 165), delay: 100, origin: { x: 0, y: 0 } },
    ],
    close: [
      { ...asset(242, 165), delay: 100, origin: { x: 0, y: 0 } },
      { ...asset(242, 167), delay: 30, origin: { x: 0, y: 0 } },
      { ...asset(242, 169), delay: 30, origin: { x: 0, y: 0 } },
      { ...asset(242, 30), delay: 1000, origin: { x: 0, y: 0 } },
    ],
  },
  arrows: { left: button, right: button },
  combo: {
    normal: [asset(5, 17), asset(5, 17), asset(18, 17)],
    mouseOver: [asset(5, 17), asset(5, 17), asset(18, 17)],
    pressed: [asset(5, 17), asset(5, 17), asset(18, 17)],
    disabled: [asset(5, 17), asset(5, 17), asset(18, 17)],
    selected: [asset(5, 17), asset(5, 17), asset(18, 17)],
  },
  comboButton: {
    normal: asset(17, 16),
    mouseOver: asset(17, 16),
    pressed: asset(17, 16),
    disabled: asset(17, 16),
  },
  tab: {
    normal: {
      left: asset(6, 24),
      middle: asset(13, 24),
      right: asset(12, 24),
      fill: asset(1, 24),
    },
    selected: {
      left: asset(6, 24),
      middle: asset(13, 24),
      right: asset(12, 24),
      fill: asset(1, 24),
    },
  },
  alert: asset(187, 120),
};

describe("NewChar manifest", () => {
  it("accepts the v43 NewChar and Basic asset contract", () => {
    expect(validateNewChar(fixture)).toEqual(fixture);
  });

  it("rejects a missing scroll frame before rendering", () => {
    expect(() =>
      validateNewChar({
        ...fixture,
        scroll: { ...fixture.scroll, open: fixture.scroll.open.slice(0, 3) },
      }),
    ).toThrow("NewChar 자산 데이터");
  });

  it("ships the versioned product manifest", () => {
    const path = "public/map-login/kms-v43/new-char.json";
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    expect(
      validateNewChar(JSON.parse(readFileSync(path, "utf8"))),
    ).toBeTruthy();
  });
});

describe("NewChar layout", () => {
  it("anchors the editor to NewChar/signboard and keeps controls in the parchment", () => {
    const layout = getNewCharLayout(scene);
    const mushroom = scene.backgrounds.find(
      (background) => background.source === NEW_CHAR_MUSHROOM_SOURCE,
    );

    expect(layout.panel).toEqual({
      x: 114,
      y: -2012,
      width: 201,
      height: 332,
    });
    expect(mushroom).toBeTruthy();
    expect(layout.character.x + layout.character.width / 2).toBe(mushroom?.x);
    expect(layout.character).toMatchObject({
      y: -2004,
      width: 360,
      height: 360,
    });
    for (const control of [
      layout.previous,
      layout.next,
      layout.action,
      layout.emotion,
      layout.primary,
      layout.secondary,
    ]) {
      expect(rectContains(layout.scroll, control)).toBe(true);
    }
  });
});

describe("NewChar state and dropdown navigation", () => {
  it("stops state navigation at the first and last state", () => {
    expect(movePetState("idle", -1)).toBe("idle");
    expect(movePetState("idle", 1)).toBe("running-right");
    expect(movePetState("review", 1)).toBe("review");
    expect(movePetState("review", -1)).toBe("running");
  });

  it("keeps the selected option inside an eight-row dropdown window", () => {
    expect(getDropdownWindow(42, 0, 0)).toEqual({ start: 0, end: 8 });
    expect(getDropdownWindow(42, 20, 0)).toEqual({ start: 13, end: 21 });
    expect(getDropdownWindow(25, 3, 17)).toEqual({ start: 3, end: 11 });
    expect(getDropdownWindow(25, 24, 22)).toEqual({ start: 17, end: 25 });
  });

  it("moves a keyboard-highlighted option and scrolls the eight-row window", () => {
    expect(moveDropdownOption(42, { start: 0, active: 0 }, -1)).toEqual({
      start: 0,
      active: 0,
    });
    expect(moveDropdownOption(42, { start: 0, active: 7 }, 1)).toEqual({
      start: 1,
      active: 8,
    });
    expect(moveDropdownOption(42, { start: 34, active: 41 }, 1)).toEqual({
      start: 34,
      active: 41,
    });
  });

  it("plays parchment frames once and holds the final frame", () => {
    expect(frameAtTimeOnce(fixture.scroll.open, 0)).toBe(
      fixture.scroll.open[0],
    );
    expect(frameAtTimeOnce(fixture.scroll.open, 249)).toBe(
      fixture.scroll.open[0],
    );
    expect(frameAtTimeOnce(fixture.scroll.open, 250)).toBe(
      fixture.scroll.open[1],
    );
    expect(frameAtTimeOnce(fixture.scroll.open, 10_000)).toBe(
      fixture.scroll.open[3],
    );
  });

  it("prioritizes disabled, pressed, hover, and focus control states", () => {
    expect(resolveNewCharControlState({ disabled: true })).toBe("disabled");
    expect(resolveNewCharControlState({ disabled: false, pressed: true })).toBe(
      "pressed",
    );
    expect(resolveNewCharControlState({ disabled: false, hovered: true })).toBe(
      "mouseOver",
    );
    expect(resolveNewCharControlState({ disabled: false, focused: true })).toBe(
      "mouseOver",
    );
    expect(resolveNewCharControlState({ disabled: false })).toBe("normal");
  });

  it("limits editor and modal hit testing to the active surface", () => {
    const layout = getNewCharLayout(scene);
    const center = (rect: typeof layout.action) => ({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });

    expect(hitTestNewChar(layout, center(layout.action), false)).toBe("action");
    expect(hitTestNewChar(layout, center(layout.action), true)).toBeNull();
    expect(hitTestNewChar(layout, center(layout.install), true)).toBe(
      "install",
    );
  });
});

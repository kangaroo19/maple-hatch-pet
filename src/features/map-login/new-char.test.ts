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
import {
  getNewCharAssetSources,
  resolveFindCharacterOverlayState,
  resolvePrimaryButtonVisual,
} from "@/features/map-login/new-char-renderer";
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

const assetButton = (width: number, height: number, source: string) => ({
  normal: { ...asset(width, height), source: `${source}/normal` },
  mouseOver: { ...asset(width, height), source: `${source}/mouseOver` },
  pressed: { ...asset(width, height), source: `${source}/pressed` },
  disabled: { ...asset(width, height), source: `${source}/disabled` },
});

const fixture: NewCharManifest = {
  formatVersion: 5,
  source: {
    login: "UI.wz/Login.img",
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
  buttons: {
    findCharacter: assetButton(125, 52, "UI.wz/Login.img/Common/BtStart"),
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

  it("rejects the previous product manifest version", () => {
    expect(() => validateNewChar({ ...fixture, formatVersion: 4 })).toThrow(
      "NewChar 자산 데이터",
    );
  });

  it("rejects a missing scroll frame before rendering", () => {
    expect(() =>
      validateNewChar({
        ...fixture,
        scroll: { ...fixture.scroll, open: fixture.scroll.open.slice(0, 3) },
      }),
    ).toThrow("NewChar 자산 데이터");
  });

  it("rejects the removed petCreate WZ asset contract", () => {
    expect(() =>
      validateNewChar({
        ...fixture,
        buttons: {
          ...fixture.buttons,
          petCreate: assetButton(101, 35, "UI.wz/Login.img/CharSelect/BtNew"),
        },
      }),
    ).toThrow("NewChar 자산 데이터");
  });

  it("rejects an incorrectly sized find-character button asset", () => {
    expect(() =>
      validateNewChar({
        ...fixture,
        buttons: {
          findCharacter: {
            ...fixture.buttons.findCharacter,
            disabled: {
              ...fixture.buttons.findCharacter.disabled,
              width: 124,
            },
          },
        },
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

  it("does not preload the WZ state arrow assets", () => {
    expect(getNewCharAssetSources(fixture)).not.toContain("/asset-15-16.png");
  });
});

describe("NewChar layout", () => {
  it("anchors the editor to NewChar/signboard and keeps controls in the parchment", () => {
    const layout = getNewCharLayout(scene, fixture);
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
    ]) {
      expect(rectContains(layout.scroll, control)).toBe(true);
    }
    expect(layout.primary).toEqual({
      x: layout.scroll.x + 65,
      y: layout.scroll.y + 120,
      width: 112,
      height: 30,
    });
    expect(layout.previous).toEqual({
      x: layout.scroll.x + 18,
      y: layout.scroll.y + 20,
      width: 15,
      height: 16,
    });
    expect(layout.next).toEqual({
      x: layout.scroll.x + layout.scroll.width - 27,
      y: layout.scroll.y + 20,
      width: 15,
      height: 16,
    });
    expect(layout.installPanel).toEqual({
      x: layout.scroll.x - 12,
      y: layout.scroll.y + 177,
      width: 266,
      height: 98,
    });
    expect(layout.installCommand).toEqual({
      x: layout.installPanel.x + 12,
      y: layout.installPanel.y + 10,
      width: 242,
      height: 38,
    });
    expect(layout.copyCommand).toEqual({
      x: layout.scroll.x + 65,
      y: layout.installCommand.y + 46,
      width: 112,
      height: 30,
    });
    expect(layout.secondary).toEqual({ x: 8, y: 429, width: 125, height: 52 });
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

  it("selects the Canvas primary button state and label", () => {
    expect(
      resolvePrimaryButtonVisual({ createPending: false, hasResult: false }),
    ).toEqual({ state: "normal", label: "Pet 만들기" });
    expect(
      resolvePrimaryButtonVisual({
        createPending: false,
        hasResult: false,
        hovered: true,
      }),
    ).toEqual({ state: "mouseOver", label: "Pet 만들기" });
    expect(
      resolvePrimaryButtonVisual({
        createPending: false,
        hasResult: false,
        focused: true,
      }),
    ).toEqual({ state: "mouseOver", label: "Pet 만들기" });
    expect(
      resolvePrimaryButtonVisual({
        createPending: false,
        hasResult: false,
        pressed: true,
      }),
    ).toEqual({ state: "pressed", label: "Pet 만들기" });
    expect(
      resolvePrimaryButtonVisual({ createPending: true, hasResult: false }),
    ).toEqual({ state: "disabled", label: "Pet 만들기" });
    expect(
      resolvePrimaryButtonVisual({ createPending: false, hasResult: true }),
    ).toEqual({ state: "normal", label: "Pet 만들기" });
  });

  it("shows find-character disabled on login and interactive in the editor", () => {
    expect(
      resolveFindCharacterOverlayState({
        creatorVisible: false,
        controlsVisible: false,
        createPending: false,
      }),
    ).toBe("disabled");
    expect(
      resolveFindCharacterOverlayState({
        creatorVisible: true,
        controlsVisible: true,
        createPending: false,
        hovered: true,
      }),
    ).toBe("mouseOver");
    expect(
      resolveFindCharacterOverlayState({
        creatorVisible: true,
        controlsVisible: false,
        createPending: false,
      }),
    ).toBeNull();
  });

  it("hit-tests the editor and copy button on their active surfaces", () => {
    const layout = getNewCharLayout(scene, fixture);
    const center = (rect: typeof layout.action) => ({
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    const points = (
      map: { x: number; y: number },
      viewport = { x: 0, y: 0 },
    ) => ({ map, viewport });
    const visibleActionPoint = {
      x: layout.action.x + 5,
      y: layout.action.y + layout.action.height / 2,
    };

    expect(hitTestNewChar(layout, points(visibleActionPoint))).toBe("action");
    expect(
      hitTestNewChar(layout, points({ x: 0, y: 0 }, center(layout.secondary))),
    ).toBe("secondary");
    expect(hitTestNewChar(layout, points(center(layout.copyCommand)))).toBe(
      "copyCommand",
    );
  });
});

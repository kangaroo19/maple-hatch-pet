import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  getLoginLayout,
  hitTestLogin,
  rectContains,
  rectsOverlap,
  resolveLoginButtonState,
  validateLogin,
} from "@/features/map-login/login";
import { validateScene } from "@/features/map-login/scene";

const scene = validateScene(
  JSON.parse(
    readFileSync("public/map-login/kms-v43/scene.json", "utf8"),
  ) as unknown,
);

describe("MapLogin first-screen login layout", () => {
  it("keeps the input and button inside the Title panel and outside the second screen", () => {
    const layout = getLoginLayout(scene);
    const secondScreen = scene.objects.find(
      (object) =>
        object.source === "Map.wz/Obj/login.img/WorldSelect/signboard/0",
    );

    expect(secondScreen).toBeDefined();
    const secondFrame = secondScreen!.frames[0]!;
    const secondScreenBounds = {
      x: secondScreen!.x - secondFrame.origin.x,
      y: secondScreen!.y - secondFrame.origin.y,
      width: secondFrame.width,
      height: secondFrame.height,
    };

    expect(rectContains(layout.panel, layout.input)).toBe(true);
    expect(rectContains(layout.panel, layout.button)).toBe(true);
    expect(rectsOverlap(layout.input, secondScreenBounds)).toBe(false);
    expect(rectsOverlap(layout.button, secondScreenBounds)).toBe(false);
  });

  it("aligns the nickname with the email row and BtLogin with the right slot", () => {
    const layout = getLoginLayout(scene);

    expect(layout.input).toEqual({
      x: layout.panel.x + 113,
      y: layout.panel.y + 20,
      width: 150,
      height: 27,
    });
    expect(layout.button).toEqual({
      x: layout.panel.x + 264,
      y: layout.panel.y + 20,
      width: 95,
      height: 48,
    });
  });

  it("hit-tests the Canvas input and button without overlapping targets", () => {
    const layout = getLoginLayout(scene);

    expect(
      hitTestLogin(layout, {
        x: layout.input.x + layout.input.width / 2,
        y: layout.input.y + layout.input.height / 2,
      }),
    ).toBe("input");
    expect(
      hitTestLogin(layout, {
        x: layout.button.x + layout.button.width / 2,
        y: layout.button.y + layout.button.height / 2,
      }),
    ).toBe("button");
    expect(hitTestLogin(layout, { x: layout.panel.x, y: layout.panel.y })).toBe(
      null,
    );
  });
});

describe("MapLogin login button state", () => {
  it("prioritizes disabled, pressed, hover/focus, then normal", () => {
    expect(
      resolveLoginButtonState({
        disabled: true,
        pressed: true,
        hovered: true,
        focused: true,
      }),
    ).toBe("disabled");
    expect(
      resolveLoginButtonState({
        disabled: false,
        pressed: true,
        hovered: true,
        focused: true,
      }),
    ).toBe("pressed");
    expect(
      resolveLoginButtonState({
        disabled: false,
        pressed: false,
        hovered: true,
        focused: false,
      }),
    ).toBe("mouseOver");
    expect(
      resolveLoginButtonState({
        disabled: false,
        pressed: false,
        hovered: false,
        focused: true,
      }),
    ).toBe("mouseOver");
    expect(
      resolveLoginButtonState({
        disabled: false,
        pressed: false,
        hovered: false,
        focused: false,
      }),
    ).toBe("normal");
  });
});

describe("MapLogin login manifest", () => {
  it("provides all four 95x48 BtLogin states while retaining MSTitle", () => {
    const manifest = validateLogin(
      JSON.parse(
        readFileSync("public/map-login/kms-v43/login.json", "utf8"),
      ) as unknown,
    );

    expect(Object.keys(manifest.login)).toEqual([
      "normal",
      "mouseOver",
      "pressed",
      "disabled",
    ]);
    for (const asset of Object.values(manifest.login))
      expect(asset).toMatchObject({ width: 95, height: 48 });
    expect(manifest.title).toMatchObject({ width: 397, height: 219 });
  });
});

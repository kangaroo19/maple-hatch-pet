import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  getLoginLayout,
  hitTestLogin,
  rectContains,
  rectsOverlap,
  resolveLoginButtonState,
  validateLogin,
  validateLoginFrameImage,
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
    expect(rectContains(layout.panel, layout.passwordIndicator)).toBe(true);
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
    expect(
      hitTestLogin(layout, {
        x:
          layout.passwordIndicator.x + layout.passwordIndicator.width / 2,
        y:
          layout.passwordIndicator.y + layout.passwordIndicator.height / 2,
      }),
    ).toBe(null);
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
  it("provides the fixed 800x600 frame with all login assets", () => {
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
    expect(manifest.frame).toMatchObject({ width: 800, height: 600 });
  });

  it("rejects a missing or incorrectly sized fixed frame", () => {
    const manifest = JSON.parse(
      readFileSync("public/map-login/kms-v43/login.json", "utf8"),
    ) as Record<string, unknown>;
    const withoutFrame = { ...manifest, frame: undefined };

    expect(() => validateLogin(withoutFrame)).toThrow("로그인 자산");
    expect(() =>
      validateLogin({
        ...manifest,
        frame: {
          asset: "/map-login/kms-v43/login/frame.png",
          width: 849,
          height: 600,
        },
      }),
    ).toThrow("로그인 자산");
  });

  it("rejects a loaded frame whose intrinsic size disagrees with the manifest", () => {
    const manifest = validateLogin(
      JSON.parse(
        readFileSync("public/map-login/kms-v43/login.json", "utf8"),
      ) as unknown,
    );

    expect(() =>
      validateLoginFrameImage(manifest, {
        naturalWidth: 849,
        naturalHeight: 600,
      }),
    ).toThrow("로그인 프레임");
    expect(() =>
      validateLoginFrameImage(manifest, {
        naturalWidth: 800,
        naturalHeight: 600,
      }),
    ).not.toThrow();
  });
});

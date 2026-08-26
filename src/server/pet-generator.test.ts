// @vitest-environment node

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_STATES,
  normalizePetRequest,
  planFrames,
} from "@/lib/pet-contract";
import { generateSpritesheet } from "@/server/pet-generator";

const baseUrl =
  "https://open.api.nexon.com/static/maplestory/character/look/abc";
const rows = planFrames(
  normalizePetRequest({
    characterName: "천짱",
    catalogVersion: 1,
    states: DEFAULT_STATES,
  }).states,
);

async function visibleFrame(size = 400): Promise<Buffer> {
  const visibleWidth = Math.round(size * 0.1);
  const visibleHeight = Math.round(size * 0.15);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: {
          create: {
            width: visibleWidth,
            height: visibleHeight,
            channels: 4,
            background: "#ff3366ff",
          },
        },
        left: Math.round(size * 0.45),
        top: Math.floor(size * 0.55),
      },
    ])
    .png()
    .toBuffer();
}

async function frameWithOversizedEffect(size = 400): Promise<Buffer> {
  const character = await visibleFrame(size);
  return sharp(character)
    .composite([
      {
        input: {
          create: {
            width: Math.round(size * 0.25),
            height: Math.round(size * 0.6),
            channels: 4,
            background: "#66ccffff",
          },
        },
        left: Math.round(size * 0.25),
        top: Math.round(size * 0.1),
      },
    ])
    .png()
    .toBuffer();
}

async function cellAt(
  spritesheet: Buffer,
  row: number,
  column = 0,
): Promise<Buffer> {
  return sharp(spritesheet)
    .extract({
      left: column * 192,
      top: row * 208,
      width: 192,
      height: 208,
    })
    .raw()
    .toBuffer();
}

function visibleBounds(pixels: Buffer): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  let left = 192;
  let top = 208;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < 208; y += 1) {
    for (let x = 0; x < 192; x += 1) {
      if (pixels[(y * 192 + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return { left, top, right, bottom };
}

describe("Codex v1 PNG generator", () => {
  it("creates a transparent 8 by 9 sheet and downloads each official URL once", async () => {
    const frame = await visibleFrame();
    const requested = new Set<string>();
    let requestCount = 0;
    const png = await generateSpritesheet(
      baseUrl,
      rows,
      new AbortController().signal,
      false,
      async (input) => {
        requestCount += 1;
        requested.add(String(input));
        return new Response(Uint8Array.from(frame).buffer, {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      },
    );
    const metadata = await sharp(png).metadata();

    expect(metadata).toMatchObject({
      format: "png",
      width: 1536,
      height: 1872,
      hasAlpha: true,
    });
    expect(png.byteLength).toBeLessThanOrEqual(20 * 1024 * 1024);
    expect(requestCount).toBe(requested.size);

    const usedCell = await sharp(png)
      .extract({ left: 0, top: 0, width: 192, height: 208 })
      .raw()
      .toBuffer();
    const unusedCell = await sharp(png)
      .extract({ left: 7 * 192, top: 0, width: 192, height: 208 })
      .raw()
      .toBuffer();
    expect(usedCell.some((value, index) => index % 4 === 3 && value > 0)).toBe(
      true,
    );
    expect(
      unusedCell.some((value, index) => index % 4 === 3 && value > 0),
    ).toBe(false);
    expect(
      [...requested].every(
        (url) => new URL(url).searchParams.get("wmotion") === "W04",
      ),
    ).toBe(true);
  });

  it("uses the default weapon motion for every frame when requested", async () => {
    const frame = await visibleFrame();
    const requested = new Set<string>();
    await generateSpritesheet(
      baseUrl,
      rows,
      new AbortController().signal,
      true,
      async (input) => {
        requested.add(String(input));
        return new Response(Uint8Array.from(frame).buffer, { status: 200 });
      },
    );

    expect(requested.size).toBeGreaterThan(0);
    expect(
      [...requested].every(
        (url) => new URL(url).searchParams.get("wmotion") === "W00",
      ),
    ).toBe(true);
  });

  it("normalizes equivalent 300 and 400 pixel source canvases to the same cell geometry", async () => {
    const frame300 = await visibleFrame(300);
    const frame400 = await visibleFrame(400);
    const generate = (frame: Buffer) =>
      generateSpritesheet(
        baseUrl,
        rows,
        new AbortController().signal,
        false,
        async () =>
          new Response(Uint8Array.from(frame).buffer, {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
      );
    const [png300, png400] = await Promise.all([
      generate(frame300),
      generate(frame400),
    ]);

    await expect(sharp(png300).metadata()).resolves.toMatchObject({
      format: "png",
      width: 1536,
      height: 1872,
      hasAlpha: true,
    });
    expect(visibleBounds(await cellAt(png300, 0))).toEqual(
      visibleBounds(await cellAt(png400, 0)),
    );
  });

  it("uses the fixed source scale and anchor", async () => {
    const frame = await visibleFrame();
    const png = await generateSpritesheet(
      baseUrl,
      rows,
      new AbortController().signal,
      false,
      async () =>
        new Response(Uint8Array.from(frame).buffer, {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    const cell = await cellAt(png, 0);

    expect(visibleBounds(cell)).toEqual({
      left: 68,
      top: 102,
      right: 124,
      bottom: 188,
    });
  });

  it("does not shrink ordinary frames when another action has an oversized effect", async () => {
    const character = await visibleFrame();
    const oversized = await frameWithOversizedEffect();
    const generate = (withEffect: boolean) =>
      generateSpritesheet(
        baseUrl,
        rows,
        new AbortController().signal,
        false,
        async (input) => {
          const action = new URL(String(input)).searchParams.get("action");
          const frame =
            withEffect && action === "A06.0" ? oversized : character;
          return new Response(Uint8Array.from(frame).buffer, { status: 200 });
        },
      );
    const [plain, withEffect] = await Promise.all([
      generate(false),
      generate(true),
    ]);

    expect(await cellAt(withEffect, 0)).toEqual(await cellAt(plain, 0));
    const jumping = await cellAt(withEffect, 4);
    expect(
      Array.from({ length: 208 }, (_, y) => jumping[y * 192 * 4 + 3]).some(
        (alpha) => alpha > 0,
      ),
    ).toBe(true);
  });

  it("rejects official frames with inconsistent decoded sizes", async () => {
    const smallFrame = await visibleFrame(300);
    const requestedFrame = await visibleFrame();
    let requestCount = 0;

    await expect(
      generateSpritesheet(
        baseUrl,
        rows,
        new AbortController().signal,
        false,
        async () => {
          requestCount += 1;
          const frame = requestCount === 1 ? smallFrame : requestedFrame;
          return new Response(Uint8Array.from(frame).buffer, {
            status: 200,
            headers: { "content-type": "image/png" },
          });
        },
      ),
    ).rejects.toThrow("UPSTREAM_ERROR");
  });

  it("blocks publication when an official frame is fully transparent", async () => {
    const transparent = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(
      generateSpritesheet(
        baseUrl,
        rows,
        new AbortController().signal,
        false,
        async () =>
          new Response(Uint8Array.from(transparent).buffer, {
            status: 200,
            headers: { "content-type": "image/png" },
          }),
      ),
    ).rejects.toThrow("UNUSABLE_CHARACTER_FRAMES");
  });

  it("does not follow official image redirects", async () => {
    await expect(
      generateSpritesheet(
        baseUrl,
        rows,
        new AbortController().signal,
        false,
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://evil.test/image.png" },
          }),
      ),
    ).rejects.toThrow("UPSTREAM_ERROR");
  });
});

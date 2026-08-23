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
            width: 40,
            height: 60,
            channels: 4,
            background: "#ff3366ff",
          },
        },
        left: Math.floor((size - 40) / 2),
        top: Math.floor(size * 0.55),
      },
    ])
    .png()
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

  it("uses the consistent decoded size when the official server returns 300 by 300", async () => {
    const frame = await visibleFrame(300);
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

    await expect(sharp(png).metadata()).resolves.toMatchObject({
      format: "png",
      width: 1536,
      height: 1872,
      hasAlpha: true,
    });
  });

  it("upscales small character frames to the shared cell safe area", async () => {
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
    const cell = await sharp(png)
      .extract({ left: 0, top: 0, width: 192, height: 208 })
      .raw()
      .toBuffer();

    expect(visibleBounds(cell)).toEqual({
      left: 32,
      top: 8,
      right: 159,
      bottom: 199,
    });
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

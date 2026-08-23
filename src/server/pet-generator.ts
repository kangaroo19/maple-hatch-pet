import sharp from "sharp";

import { AppError } from "@/lib/errors";
import { buildCharacterFrameUrl } from "@/lib/nexon-url";
import type { PlannedRow } from "@/lib/pet-contract";

const MIN_SOURCE_SIZE = 96;
const MAX_SOURCE_SIZE = 1000;
const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const COLUMNS = 8;
const ROWS = 9;
const SHEET_WIDTH = CELL_WIDTH * COLUMNS;
const SHEET_HEIGHT = CELL_HEIGHT * ROWS;
const MAX_PNG_BYTES = 20 * 1024 * 1024;
const SAFE_MARGIN = 8;

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;
type SourceFrame = {
  pixels: Buffer;
  width: number;
  height: number;
  bounds: { left: number; top: number; right: number; bottom: number };
};

function upstreamError() {
  return new AppError(
    "UPSTREAM_ERROR",
    502,
    true,
    "공식 이미지를 불러오지 못했습니다.",
  );
}

function unusableFrame() {
  return new AppError(
    "UNUSABLE_CHARACTER_FRAMES",
    409,
    false,
    "사용할 수 없는 프레임이 있습니다. 다른 액션이나 표정을 선택해 주세요.",
  );
}

async function downloadFrame(
  url: URL,
  signal: AbortSignal,
  fetchImpl: FetchImplementation,
): Promise<SourceFrame> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (signal.aborted) {
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        503,
        true,
        "Pet 생성 시간이 초과되었습니다.",
      );
    }
    try {
      response = await fetchImpl(url, {
        cache: "no-store",
        redirect: "manual",
        signal,
      });
    } catch {
      response = undefined;
    }
    if (response?.ok) break;
  }
  if (!response?.ok || (response.status >= 300 && response.status < 400))
    throw upstreamError();

  let pixels: Buffer;
  let width: number;
  let height: number;
  try {
    const encoded = Buffer.from(await response.arrayBuffer());
    const decoded = await sharp(encoded)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (
      decoded.info.width < MIN_SOURCE_SIZE ||
      decoded.info.width > MAX_SOURCE_SIZE ||
      decoded.info.height < MIN_SOURCE_SIZE ||
      decoded.info.height > MAX_SOURCE_SIZE ||
      decoded.info.channels !== 4
    ) {
      throw new Error("unexpected dimensions");
    }
    pixels = decoded.data;
    width = decoded.info.width;
    height = decoded.info.height;
  } catch {
    throw upstreamError();
  }

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw unusableFrame();
  return { pixels, width, height, bounds: { left, top, right, bottom } };
}

function alphaExists(pixels: Buffer): boolean {
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) return true;
  }
  return false;
}

export async function generateSpritesheet(
  baseUrl: string,
  rows: PlannedRow[],
  signal: AbortSignal,
  includeWeapon = false,
  fetchImpl: FetchImplementation = fetch,
): Promise<Buffer> {
  if (rows.length !== ROWS) throw unusableFrame();
  const urls = new Map<string, URL>();
  for (const row of rows) {
    if (row.frames.length > COLUMNS) throw unusableFrame();
    for (const frame of row.frames) {
      const url = buildCharacterFrameUrl(
        baseUrl,
        frame.actionFrame,
        frame.emotionFrame,
        includeWeapon,
      );
      urls.set(url.href, url);
    }
  }

  const downloaded = new Map<string, SourceFrame>();
  await Promise.all(
    [...urls].map(async ([href, url]) => {
      downloaded.set(href, await downloadFrame(url, signal, fetchImpl));
    }),
  );

  const allFrames = [...downloaded.values()];
  const firstFrame = allFrames[0];
  if (!firstFrame) throw unusableFrame();
  if (
    allFrames.some(
      (frame) =>
        frame.width !== firstFrame.width || frame.height !== firstFrame.height,
    )
  ) {
    throw upstreamError();
  }
  const globalBounds = allFrames.reduce(
    (bounds, frame) => ({
      left: Math.min(bounds.left, frame.bounds.left),
      top: Math.min(bounds.top, frame.bounds.top),
      right: Math.max(bounds.right, frame.bounds.right),
      bottom: Math.max(bounds.bottom, frame.bounds.bottom),
    }),
    { left: firstFrame.width, top: firstFrame.height, right: -1, bottom: -1 },
  );
  const sourceWidth = globalBounds.right - globalBounds.left + 1;
  const sourceHeight = globalBounds.bottom - globalBounds.top + 1;
  const scale = Math.min(
    (CELL_WIDTH - SAFE_MARGIN * 2) / sourceWidth,
    (CELL_HEIGHT - SAFE_MARGIN * 2) / sourceHeight,
  );
  const scaledWidth = Math.max(1, Math.round(sourceWidth * scale));
  const scaledHeight = Math.max(1, Math.round(sourceHeight * scale));
  const left = Math.floor((CELL_WIDTH - scaledWidth) / 2);
  const top = Math.floor((CELL_HEIGHT - scaledHeight) / 2);

  const rendered = new Map<string, Buffer>();
  for (const [href, frame] of downloaded) {
    const input = await sharp(frame.pixels, {
      raw: { width: frame.width, height: frame.height, channels: 4 },
    })
      .extract({
        left: globalBounds.left,
        top: globalBounds.top,
        width: sourceWidth,
        height: sourceHeight,
      })
      .resize(scaledWidth, scaledHeight, {
        fit: "fill",
        kernel: sharp.kernel.nearest,
      })
      .png()
      .toBuffer();
    rendered.set(
      href,
      await sharp({
        create: {
          width: CELL_WIDTH,
          height: CELL_HEIGHT,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input, left, top }])
        .png()
        .toBuffer(),
    );
  }

  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]!;
    for (let column = 0; column < row.frames.length; column += 1) {
      const frame = row.frames[column]!;
      const href = buildCharacterFrameUrl(
        baseUrl,
        frame.actionFrame,
        frame.emotionFrame,
        includeWeapon,
      ).href;
      const cell = rendered.get(href);
      if (!cell) throw upstreamError();
      composites.push({
        input: row.flip ? await sharp(cell).flop().png().toBuffer() : cell,
        left: column * CELL_WIDTH,
        top: rowIndex * CELL_HEIGHT,
      });
    }
  }

  const rawSheet = await sharp({
    create: {
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .raw()
    .toBuffer();
  for (let index = 0; index < rawSheet.length; index += 4) {
    if (rawSheet[index + 3] !== 0) continue;
    rawSheet[index] = 0;
    rawSheet[index + 1] = 0;
    rawSheet[index + 2] = 0;
  }

  for (let rowIndex = 0; rowIndex < ROWS; rowIndex += 1) {
    const used = rows[rowIndex]!.frames.length;
    for (let column = 0; column < COLUMNS; column += 1) {
      const cell = Buffer.alloc(CELL_WIDTH * CELL_HEIGHT * 4);
      for (let y = 0; y < CELL_HEIGHT; y += 1) {
        const sourceStart =
          ((rowIndex * CELL_HEIGHT + y) * SHEET_WIDTH + column * CELL_WIDTH) *
          4;
        rawSheet.copy(
          cell,
          y * CELL_WIDTH * 4,
          sourceStart,
          sourceStart + CELL_WIDTH * 4,
        );
      }
      if (column < used !== alphaExists(cell)) throw unusableFrame();
    }
  }

  const png = await sharp(rawSheet, {
    raw: { width: SHEET_WIDTH, height: SHEET_HEIGHT, channels: 4 },
  })
    .png()
    .toBuffer();
  const metadata = await sharp(png).metadata();
  if (
    metadata.format !== "png" ||
    metadata.width !== SHEET_WIDTH ||
    metadata.height !== SHEET_HEIGHT ||
    !metadata.hasAlpha ||
    png.byteLength > MAX_PNG_BYTES
  ) {
    throw new AppError(
      "INTERNAL_ERROR",
      500,
      true,
      "Pet 이미지를 검증하지 못했습니다.",
    );
  }
  return png;
}

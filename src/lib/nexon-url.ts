import { AppError } from "@/lib/errors";

const CHARACTER_IMAGE_PREFIX = "/static/maplestory/character/look/";

function invalidUpstreamUrl(): AppError {
  return new AppError(
    "UPSTREAM_ERROR",
    502,
    true,
    "캐릭터 이미지를 불러오지 못했습니다.",
  );
}

export function assertAllowedCharacterImageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidUpstreamUrl();
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "open.api.nexon.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    !url.pathname.startsWith(CHARACTER_IMAGE_PREFIX) ||
    url.pathname.length <= CHARACTER_IMAGE_PREFIX.length
  ) {
    throw invalidUpstreamUrl();
  }
  url.search = "";
  url.hash = "";
  return url;
}

export function buildCharacterFrameUrl(
  baseUrl: string,
  actionFrame: string,
  emotionFrame: string,
): URL {
  const url = assertAllowedCharacterImageUrl(baseUrl);
  url.searchParams.set("action", actionFrame);
  url.searchParams.set("emotion", emotionFrame);
  url.searchParams.set("wmotion", "W04");
  url.searchParams.set("width", "400");
  url.searchParams.set("height", "400");
  url.searchParams.set("x", "200");
  url.searchParams.set("y", "280");
  return url;
}

export type Character = {
  name: string;
  world: string;
  class: string;
  level: number;
  imageUrl: string;
};

import { AppError } from "@/lib/errors";
import { assertAllowedCharacterImageUrl } from "@/lib/nexon-url";

type FetchImplementation = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function nexonError(status: number): AppError {
  if (status === 404 || status === 400) {
    return new AppError(
      "CHARACTER_NOT_FOUND",
      404,
      false,
      "캐릭터를 찾을 수 없습니다. 닉네임과 조회 가능 시점을 확인해 주세요.",
    );
  }
  if (status === 429) {
    return new AppError(
      "RATE_LIMITED",
      429,
      true,
      "잠시 후 다시 시도해 주세요.",
    );
  }
  return new AppError(
    "UPSTREAM_ERROR",
    502,
    true,
    "캐릭터 정보를 불러오지 못했습니다.",
  );
}

async function getJson(
  url: URL,
  apiKey: string,
  fetchImpl: FetchImplementation,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      cache: "no-store",
      redirect: "manual",
      signal,
      headers: { "x-nxopen-api-key": apiKey },
    });
  } catch {
    throw nexonError(502);
  }
  if (response.status >= 300 && response.status < 400) throw nexonError(502);
  if (!response.ok) throw nexonError(response.status);
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw nexonError(502);
  }
}

export async function fetchCharacter(
  characterName: string,
  options: {
    apiKey: string;
    fetchImpl?: FetchImplementation;
    signal?: AbortSignal;
  },
): Promise<Character> {
  if (!options.apiKey) {
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      503,
      true,
      "서비스를 일시적으로 사용할 수 없습니다.",
    );
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const idUrl = new URL("https://open.api.nexon.com/maplestory/v1/id");
  idUrl.searchParams.set("character_name", characterName);
  const id = await getJson(idUrl, options.apiKey, fetchImpl, options.signal);
  if (typeof id.ocid !== "string" || !id.ocid) throw nexonError(404);

  const basicUrl = new URL(
    "https://open.api.nexon.com/maplestory/v1/character/basic",
  );
  basicUrl.searchParams.set("ocid", id.ocid);
  const basic = await getJson(
    basicUrl,
    options.apiKey,
    fetchImpl,
    options.signal,
  );
  if (
    typeof basic.character_name !== "string" ||
    typeof basic.world_name !== "string" ||
    typeof basic.character_class !== "string" ||
    typeof basic.character_level !== "number" ||
    typeof basic.character_image !== "string"
  ) {
    throw nexonError(502);
  }
  return {
    name: basic.character_name,
    world: basic.world_name,
    class: basic.character_class,
    level: basic.character_level,
    imageUrl: assertAllowedCharacterImageUrl(basic.character_image).href,
  };
}

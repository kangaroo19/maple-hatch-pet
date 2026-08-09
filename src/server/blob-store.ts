import { randomUUID } from "node:crypto";

import { del, list, put } from "@vercel/blob";

import { AppError } from "@/lib/errors";

type PutOptions = {
  access: "public";
  addRandomSuffix: false;
  contentType: "image/png";
  cacheControlMaxAge: number;
  token: string;
  abortSignal?: AbortSignal;
};
type PutFunction = (
  pathname: string,
  body: Buffer,
  options: PutOptions,
) => Promise<{ url: string }>;
type ListPage = {
  blobs: Array<{ url: string; uploadedAt: Date }>;
  cursor?: string;
  hasMore: boolean;
};
type ListFunction = (options: {
  prefix: string;
  cursor?: string;
  token: string;
}) => Promise<ListPage>;
type DeleteFunction = (
  urls: string | string[],
  options: { token: string },
) => Promise<unknown>;

function unavailable() {
  return new AppError(
    "SERVICE_UNAVAILABLE",
    503,
    true,
    "이미지 저장소를 일시적으로 사용할 수 없습니다.",
  );
}

export async function publishSpritesheet(
  png: Buffer,
  dependencies: {
    environment?: string;
    productionToken?: string;
    nonProductionToken?: string;
    randomUUID?: () => string;
    put?: PutFunction;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<string> {
  const environment =
    dependencies.environment ?? process.env.VERCEL_ENV ?? "development";
  const token =
    environment === "production"
      ? (dependencies.productionToken ?? process.env.BLOB_READ_WRITE_TOKEN)
      : (dependencies.nonProductionToken ??
        process.env.BLOB_NONPROD_READ_WRITE_TOKEN);
  if (!token) throw unavailable();
  const pathname = `pets/${(dependencies.randomUUID ?? randomUUID)()}.png`;
  let result: { url: string };
  try {
    const putImpl: PutFunction =
      dependencies.put ??
      (async (name, body, options) => put(name, body, options));
    result = await putImpl(pathname, png, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/png",
      cacheControlMaxAge: 28 * 24 * 60 * 60,
      token,
      abortSignal: dependencies.signal,
    });
    const url = new URL(result.url);
    if (url.protocol !== "https:" || !url.pathname.endsWith(`/${pathname}`))
      throw new Error();
    const response = await (dependencies.fetchImpl ?? fetch)(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: dependencies.signal,
    });
    if (
      !response.ok ||
      !response.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("image/png")
    ) {
      throw new Error();
    }
    await response.body?.cancel();
    return url.href;
  } catch {
    throw unavailable();
  }
}

export async function cleanupExpiredPets(
  cutoff: Date,
  dependencies: {
    productionToken?: string;
    list?: ListFunction;
    del?: DeleteFunction;
  } = {},
): Promise<number> {
  const token =
    dependencies.productionToken ?? process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw unavailable();
  const listImpl: ListFunction =
    dependencies.list ??
    (async (options) => list(options) as Promise<ListPage>);
  const delImpl: DeleteFunction = dependencies.del ?? del;
  let cursor: string | undefined;
  let deletedCount = 0;
  try {
    do {
      const page = await listImpl({ prefix: "pets/", cursor, token });
      for (const blob of page.blobs) {
        if (new Date(blob.uploadedAt).getTime() >= cutoff.getTime()) continue;
        await delImpl(blob.url, { token });
        deletedCount += 1;
      }
      cursor = page.hasMore ? page.cursor : undefined;
      if (page.hasMore && !cursor) throw new Error();
    } while (cursor);
    return deletedCount;
  } catch {
    throw unavailable();
  }
}

import { del, get, list, put } from "@vercel/blob";

import { AppError } from "@/lib/errors";
import {
  MAX_PET_PACKAGE_BYTES,
  PET_PACKAGE_PREFIX,
  petPackagePath,
} from "@/server/pet-package";

type PutFunction = typeof put;
type GetFunction = typeof get;
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
    "Pet 저장소를 일시적으로 사용할 수 없습니다.",
  );
}

function tokenFor(dependencies: {
  environment?: string;
  productionToken?: string;
  nonProductionToken?: string;
}): string {
  const environment =
    dependencies.environment ?? process.env.VERCEL_ENV ?? "development";
  const token =
    environment === "production"
      ? (dependencies.productionToken ?? process.env.BLOB_READ_WRITE_TOKEN)
      : (dependencies.nonProductionToken ??
        process.env.BLOB_NONPROD_READ_WRITE_TOKEN);
  if (!token) throw unavailable();
  return token;
}

export async function publishPetPackage(
  packageBytes: Buffer,
  petId: string,
  dependencies: {
    environment?: string;
    productionToken?: string;
    nonProductionToken?: string;
    put?: PutFunction;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  const token = tokenFor(dependencies);
  const pathname = petPackagePath(petId);
  try {
    const result = await (dependencies.put ?? put)(pathname, packageBytes, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/zip",
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
      response.headers.get("content-type") !== "application/zip"
    ) {
      throw new Error();
    }
    await response.body?.cancel();
  } catch {
    throw unavailable();
  }
}

export async function getPetPackage(
  petId: string,
  dependencies: {
    environment?: string;
    productionToken?: string;
    nonProductionToken?: string;
    get?: GetFunction;
  } = {},
): Promise<{
  stream: ReadableStream<Uint8Array>;
  size: number;
} | null> {
  const token = tokenFor(dependencies);
  try {
    const result = await (dependencies.get ?? get)(petPackagePath(petId), {
      access: "public",
      token,
      useCache: false,
    });
    if (!result) return null;
    if (
      result.statusCode !== 200 ||
      result.blob.contentType !== "application/zip" ||
      result.blob.size > MAX_PET_PACKAGE_BYTES
    ) {
      throw new Error();
    }
    return { stream: result.stream, size: result.blob.size };
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
      const page = await listImpl({
        prefix: PET_PACKAGE_PREFIX,
        cursor,
        token,
      });
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

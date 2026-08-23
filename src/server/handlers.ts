import { randomUUID } from "node:crypto";

import {
  AppError,
  invalidRequest,
  internalError,
  petPackageNotFound,
} from "@/lib/errors";
import {
  normalizePetRequest,
  planFrames,
  type PlannedRow,
} from "@/lib/pet-contract";
import type { Character } from "@/server/nexon-client";

type CharacterLookup = (
  name: string,
  signal?: AbortSignal,
) => Promise<Character>;
export type RequestLog = {
  requestId: string;
  path: string;
  durationMs: number;
  state: string;
  status: number;
  code?: string;
  failedState?: string;
  deletedCount?: number;
};
type Logger = (entry: RequestLog) => void;
const PRODUCTION_SERVICE_ORIGIN = "https://maple-hatch-pet.vercel.app";

export const writeRequestLog: Logger = (entry) =>
  console.info(JSON.stringify(entry));

function logResult(
  log: Logger | undefined,
  startedAt: number,
  requestId: string,
  entry: Omit<RequestLog, "requestId" | "durationMs">,
) {
  log?.({ ...entry, requestId, durationMs: Date.now() - startedAt });
}

function codeFor(error: unknown): string {
  return error instanceof AppError
    ? error.code
    : error instanceof SyntaxError
      ? "INVALID_REQUEST"
      : "INTERNAL_ERROR";
}

function errorResponse(error: unknown, hidden = false): Response {
  const appError = hidden
    ? invalidRequest()
    : error instanceof AppError
      ? error
      : error instanceof SyntaxError
        ? invalidRequest()
        : internalError();
  return Response.json(
    {
      error: {
        code: appError.code,
        message: appError.publicMessage,
        retryable: appError.retryable,
      },
    },
    { status: hidden ? 404 : appError.status },
  );
}

async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidRequest();
  }
}

export function createLookupHandler(dependencies: {
  fetchCharacter: CharacterLookup;
  log?: Logger;
}) {
  return async (request: Request): Promise<Response> => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    try {
      const body = await jsonBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw invalidRequest();
      const characterName = (body as { characterName?: unknown }).characterName;
      if (typeof characterName !== "string" || !characterName.trim())
        throw invalidRequest();
      const character = await dependencies.fetchCharacter(characterName.trim());
      logResult(dependencies.log, startedAt, requestId, {
        path: "/api/characters/lookup",
        state: "ready",
        status: 200,
      });
      return Response.json({ character, catalogVersion: 1 });
    } catch (error) {
      const response = errorResponse(error);
      logResult(dependencies.log, startedAt, requestId, {
        path: "/api/characters/lookup",
        state: "failed",
        status: response.status,
        code: codeFor(error),
      });
      return response;
    }
  };
}

export function createPetHandler(dependencies: {
  fetchCharacter: CharacterLookup;
  generateSpritesheet: (
    imageUrl: string,
    rows: PlannedRow[],
    signal: AbortSignal,
    includeWeapon: boolean,
  ) => Promise<Buffer>;
  createPackage: (input: {
    petId: string;
    displayName: string;
    description: string;
    spritesheet: Buffer;
  }) => Buffer;
  publishPackage: (
    packageBytes: Buffer,
    petId: string,
    signal: AbortSignal,
  ) => Promise<void>;
  randomUUID?: () => string;
  now?: () => Date;
  timeoutMs?: number;
  log?: Logger;
}) {
  return async (request: Request): Promise<Response> => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    let state = "accepted";
    const controller = new AbortController();
    const timeoutError = new AppError(
      "SERVICE_UNAVAILABLE",
      503,
      true,
      "Pet 생성 시간이 초과되었습니다.",
    );
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(timeoutError);
      }, dependencies.timeoutMs ?? 50_000);
    });
    try {
      const operation = async () => {
        const normalized = normalizePetRequest(await jsonBody(request));
        state = "fetching-character";
        const currentCharacter = await dependencies.fetchCharacter(
          normalized.characterName,
          controller.signal,
        );
        state = "rendering";
        const png = await dependencies.generateSpritesheet(
          currentCharacter.imageUrl,
          planFrames(normalized.states),
          controller.signal,
          normalized.includeWeapon,
        );
        if (controller.signal.aborted) throw timeoutError;
        const description = `${currentCharacter.world} ${currentCharacter.class} 캐릭터`;
        const petId = (dependencies.randomUUID ?? randomUUID)();
        state = "packaging";
        const packageBytes = dependencies.createPackage({
          petId,
          displayName: currentCharacter.name,
          description,
          spritesheet: png,
        });
        state = "publishing";
        await dependencies.publishPackage(
          packageBytes,
          petId,
          controller.signal,
        );
        if (controller.signal.aborted) throw timeoutError;
        const createdAt = (dependencies.now ?? (() => new Date()))();
        return {
          displayName: currentCharacter.name,
          description,
          petId,
          packageUrl: `${PRODUCTION_SERVICE_ORIGIN}/api/pets/${petId}/package`,
          installCommand: `npx maple-hatch-pet add ${petId}`,
          expiresAt: new Date(
            createdAt.getTime() + 28 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        };
      };
      const result = await Promise.race([operation(), timeoutPromise]);
      logResult(dependencies.log, startedAt, requestId, {
        path: "/api/pets",
        state: "ready",
        status: 200,
      });
      return Response.json(result);
    } catch (error) {
      const response = errorResponse(error);
      logResult(dependencies.log, startedAt, requestId, {
        path: "/api/pets",
        state: "failed",
        failedState: state,
        status: response.status,
        code: codeFor(error),
      });
      return response;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
}

export function createPackageDownloadHandler(dependencies: {
  getPackage: (petId: string) => Promise<{
    stream: ReadableStream<Uint8Array>;
    size: number;
  } | null>;
  isPetId: (petId: string) => boolean;
  log?: Logger;
}) {
  return async (request: Request, petId: string): Promise<Response> => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    try {
      if (!dependencies.isPetId(petId)) throw petPackageNotFound();
      const petPackage = await dependencies.getPackage(petId);
      if (!petPackage) throw petPackageNotFound();
      const response = new Response(petPackage.stream, {
        headers: {
          "cache-control": "public, max-age=3600",
          "content-disposition": `attachment; filename="${petId}.codex-pet.zip"`,
          "content-length": String(petPackage.size),
          "content-type": "application/zip",
          "x-content-type-options": "nosniff",
        },
      });
      logResult(dependencies.log, startedAt, requestId, {
        path: "/api/pets/:petId/package",
        state: "ready",
        status: 200,
      });
      return response;
    } catch (error) {
      const response = errorResponse(error);
      logResult(dependencies.log, startedAt, requestId, {
        path: "/api/pets/:petId/package",
        state: "failed",
        status: response.status,
        code: codeFor(error),
      });
      return response;
    }
  };
}

export function createCronHandler(dependencies: {
  cronSecret: string;
  cleanup: (cutoff: Date) => Promise<number>;
  now?: () => Date;
  log?: Logger;
}) {
  return async (request: Request): Promise<Response> => {
    const startedAt = Date.now();
    const requestId = randomUUID();
    if (
      !dependencies.cronSecret ||
      request.headers.get("authorization") !==
        `Bearer ${dependencies.cronSecret}`
    ) {
      const response = errorResponse(invalidRequest(), true);
      logResult(dependencies.log, startedAt, requestId, {
        path: "/api/internal/cron/pet-assets",
        state: "failed",
        status: response.status,
        code: "INVALID_REQUEST",
      });
      return response;
    }
    try {
      const now = (dependencies.now ?? (() => new Date()))();
      const cutoff = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      const deletedCount = await dependencies.cleanup(cutoff);
      logResult(dependencies.log, startedAt, requestId, {
        path: "/api/internal/cron/pet-assets",
        state: "ready",
        status: 200,
        deletedCount,
      });
      return Response.json({ deletedCount, cutoff: cutoff.toISOString() });
    } catch (error) {
      const response = errorResponse(error);
      logResult(dependencies.log, startedAt, requestId, {
        path: "/api/internal/cron/pet-assets",
        state: "failed",
        status: response.status,
        code: codeFor(error),
      });
      return response;
    }
  };
}

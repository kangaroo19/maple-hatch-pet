// @vitest-environment node

import { describe, expect, it } from "vitest";

import { DEFAULT_STATES } from "@/lib/pet-contract";
import {
  createCronHandler,
  createLookupHandler,
  createPackageDownloadHandler,
  createPetHandler,
} from "@/server/handlers";
import { fetchCharacter } from "@/server/nexon-client";

const character = {
  name: "천짱",
  world: "스카니아",
  class: "마법사",
  level: 200,
  imageUrl: "https://open.api.nexon.com/static/maplestory/character/look/abc",
};

describe("NEXON client", () => {
  it("requests OCID and current basic data with no-store and no redirects", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const responses = [
      new Response(JSON.stringify({ ocid: "secret-ocid" }), { status: 200 }),
      new Response(
        JSON.stringify({
          character_name: "천짱",
          world_name: "스카니아",
          character_class: "마법사",
          character_level: 200,
          character_image: character.imageUrl,
        }),
        { status: 200 },
      ),
    ];
    const fetchImpl = async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ url: String(url), init });
      return responses.shift()!;
    };

    await expect(
      fetchCharacter("천짱", { apiKey: "server-key", fetchImpl }),
    ).resolves.toEqual(character);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.init).toMatchObject({
      cache: "no-store",
      redirect: "manual",
    });
    expect(new Headers(calls[0]?.init?.headers).get("x-nxopen-api-key")).toBe(
      "server-key",
    );
    expect(calls[1]?.url).toContain("ocid=secret-ocid");
  });

  it("does not follow an upstream redirect", async () => {
    await expect(
      fetchCharacter("천짱", {
        apiKey: "server-key",
        fetchImpl: async () =>
          new Response(null, {
            status: 302,
            headers: { location: "https://evil.test" },
          }),
      }),
    ).rejects.toThrow("UPSTREAM_ERROR");
  });

  it("passes the request abort signal to both NEXON calls", async () => {
    const controller = new AbortController();
    const signals: Array<AbortSignal | null | undefined> = [];
    const responses = [
      new Response(JSON.stringify({ ocid: "secret-ocid" }), { status: 200 }),
      new Response(
        JSON.stringify({
          character_name: "천짱",
          world_name: "스카니아",
          character_class: "마법사",
          character_level: 200,
          character_image: character.imageUrl,
        }),
        { status: 200 },
      ),
    ];

    await fetchCharacter("천짱", {
      apiKey: "server-key",
      signal: controller.signal,
      fetchImpl: async (_url, init) => {
        signals.push(init?.signal);
        return responses.shift()!;
      },
    });

    expect(signals).toEqual([controller.signal, controller.signal]);
  });
});

describe("route handlers", () => {
  it("lookup returns only browser-safe character data and catalog version", async () => {
    const handler = createLookupHandler({
      fetchCharacter: async () => character,
    });
    const response = await handler(
      new Request("http://localhost/api/characters/lookup", {
        method: "POST",
        body: JSON.stringify({ characterName: " 천짱 " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ character, catalogVersion: 1 });
  });

  it("records only non-secret request metadata", async () => {
    const logs: unknown[] = [];
    const handler = createLookupHandler({
      fetchCharacter: async () => character,
      log: (entry) => logs.push(entry),
    });
    await handler(
      new Request("http://localhost/api/characters/lookup", {
        method: "POST",
        body: JSON.stringify({ characterName: "천짱" }),
      }),
    );

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      path: "/api/characters/lookup",
      state: "ready",
      status: 200,
    });
    expect(JSON.stringify(logs[0])).not.toContain("천짱");
  });

  it("pet creation re-reads current character data and returns a fresh install result", async () => {
    let lookupName = "";
    const handler = createPetHandler({
      fetchCharacter: async (name) => {
        lookupName = name;
        return character;
      },
      generateSpritesheet: async () => Buffer.from("png"),
      createPackage: () => Buffer.from("zip"),
      publishPackage: async () => undefined,
      randomUUID: () => "12345678-1234-4234-9234-123456789abc",
      now: () => new Date("2026-08-09T12:34:56.000Z"),
    });
    const response = await handler(
      new Request("http://localhost/api/pets", {
        method: "POST",
        body: JSON.stringify({
          characterName: " 천짱 ",
          catalogVersion: 1,
          states: DEFAULT_STATES,
        }),
      }),
    );

    expect(lookupName).toBe("천짱");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      displayName: "천짱",
      description: "스카니아 마법사 캐릭터",
      petId: "12345678-1234-4234-9234-123456789abc",
      packageUrl:
        "https://maple-hatch-pet.vercel.app/api/pets/12345678-1234-4234-9234-123456789abc/package",
      installCommand:
        "npx maple-hatch-pet add 12345678-1234-4234-9234-123456789abc",
      expiresAt: "2026-09-06T12:34:56.000Z",
    });
  });

  it("returns 503 at the internal limit even when generation never settles", async () => {
    const handler = createPetHandler({
      fetchCharacter: async () => character,
      generateSpritesheet: async () => new Promise<Buffer>(() => undefined),
      createPackage: () => Buffer.from("zip"),
      publishPackage: async () => undefined,
      timeoutMs: 5,
    });
    const response = await Promise.race([
      handler(
        new Request("http://localhost/api/pets", {
          method: "POST",
          body: JSON.stringify({
            characterName: "천짱",
            catalogVersion: 1,
            states: DEFAULT_STATES,
          }),
        }),
      ),
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error("handler did not stop at its internal limit")),
          100,
        ),
      ),
    ]);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Pet 생성 시간이 초과되었습니다.",
        retryable: true,
      },
    });
  });

  it("uses the common error envelope for malformed input", async () => {
    const handler = createLookupHandler({
      fetchCharacter: async () => character,
    });
    const response = await handler(
      new Request("http://localhost/api/characters/lookup", {
        method: "POST",
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "요청을 확인해 주세요.",
        retryable: false,
      },
    });
  });

  it("streams a package without exposing its Blob URL", async () => {
    const handler = createPackageDownloadHandler({
      isPetId: () => true,
      getPackage: async () => ({
        stream: new Blob(["zip"]).stream(),
        size: 3,
      }),
    });
    const response = await handler(
      new Request(`http://localhost/api/pets/id/package`),
      "12345678-1234-4234-9234-123456789abc",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-length")).toBe("3");
    expect(await response.text()).toBe("zip");
  });

  it("returns a stable 404 for an invalid or expired package id", async () => {
    const handler = createPackageDownloadHandler({
      isPetId: () => false,
      getPackage: async () => {
        throw new Error("must not fetch");
      },
    });
    const response = await handler(
      new Request("http://localhost/api/pets/bad/package"),
      "bad",
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "PET_PACKAGE_NOT_FOUND",
        message: "Pet 패키지를 찾을 수 없거나 만료되었습니다.",
        retryable: false,
      },
    });
  });

  it("returns the common error envelope when package publishing fails", async () => {
    const handler = createPetHandler({
      fetchCharacter: async () => character,
      generateSpritesheet: async () => Buffer.from("png"),
      createPackage: () => Buffer.from("zip"),
      publishPackage: async () => {
        throw new Error("storage detail");
      },
    });
    const response = await handler(
      new Request("http://localhost/api/pets", {
        method: "POST",
        body: JSON.stringify({
          characterName: "천짱",
          catalogVersion: 1,
          states: DEFAULT_STATES,
        }),
      }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Pet을 만들지 못했습니다.",
        retryable: true,
      },
    });
  });

  it("hides the cron route when authorization is invalid", async () => {
    const handler = createCronHandler({
      cronSecret: "cron-secret",
      cleanup: async () => 0,
      now: () => new Date("2026-08-09T03:00:00.000Z"),
    });
    const response = await handler(
      new Request("http://localhost/api/internal/cron/pet-assets"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_REQUEST",
        message: "요청을 확인해 주세요.",
        retryable: false,
      },
    });
  });

  it("returns the 28-day cutoff after an authorized cleanup", async () => {
    const handler = createCronHandler({
      cronSecret: "cron-secret",
      cleanup: async (cutoff) =>
        cutoff.toISOString() === "2026-07-12T03:00:00.000Z" ? 12 : -1,
      now: () => new Date("2026-08-09T03:00:00.000Z"),
    });
    const response = await handler(
      new Request("http://localhost/api/internal/cron/pet-assets", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      deletedCount: 12,
      cutoff: "2026-07-12T03:00:00.000Z",
    });
  });
});

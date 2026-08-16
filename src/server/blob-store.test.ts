// @vitest-environment node

import { describe, expect, it } from "vitest";

import { cleanupExpiredPets, publishPetPackage } from "@/server/blob-store";

const petId = "12345678-1234-4234-9234-123456789abc";

describe("Vercel Blob boundary", () => {
  it("publishes one immutable package to the non-production store", async () => {
    const calls: Array<{ pathname: string; options: Record<string, unknown> }> =
      [];
    const controller = new AbortController();
    await publishPetPackage(Buffer.from("zip"), petId, {
      signal: controller.signal,
      environment: "preview",
      productionToken: "prod-token",
      nonProductionToken: "preview-token",
      put: (async (
        pathname: string,
        _body: unknown,
        options: Record<string, unknown>,
      ) => {
        calls.push({ pathname, options });
        return {
          url: `https://store.public.blob.vercel-storage.com/${pathname}`,
          downloadUrl: "",
          pathname,
          contentType: "application/zip",
          contentDisposition: "",
        };
      }) as never,
      fetchImpl: async () =>
        new Response("zip", {
          headers: { "content-type": "application/zip" },
        }),
    });

    expect(calls).toEqual([
      {
        pathname: `pet-packages/${petId}.codex-pet.zip`,
        options: {
          access: "public",
          addRandomSuffix: false,
          contentType: "application/zip",
          cacheControlMaxAge: 2419200,
          token: "preview-token",
          abortSignal: controller.signal,
        },
      },
    ]);
  });

  it("rejects a published object with the wrong content type", async () => {
    await expect(
      publishPetPackage(Buffer.from("zip"), petId, {
        environment: "production",
        productionToken: "prod-token",
        put: (async (pathname: string) => ({
          url: `https://store.public.blob.vercel-storage.com/${pathname}`,
        })) as never,
        fetchImpl: async () =>
          new Response("zip", { headers: { "content-type": "text/plain" } }),
      }),
    ).rejects.toThrow("SERVICE_UNAVAILABLE");
  });

  it("uses only the production token while deleting expired package pages", async () => {
    const deleted: string[][] = [];
    const pages = [
      {
        blobs: [
          {
            url: "https://blob/old.zip",
            uploadedAt: new Date("2026-07-01T00:00:00Z"),
          },
          {
            url: "https://blob/new.zip",
            uploadedAt: new Date("2026-08-01T00:00:00Z"),
          },
        ],
        cursor: "next",
        hasMore: true,
      },
      {
        blobs: [
          {
            url: "https://blob/old2.zip",
            uploadedAt: new Date("2026-07-02T00:00:00Z"),
          },
        ],
        cursor: undefined,
        hasMore: false,
      },
    ];
    const listCalls: Array<Record<string, unknown>> = [];
    const count = await cleanupExpiredPets(new Date("2026-07-12T03:00:00Z"), {
      productionToken: "prod-token",
      list: async (options) => {
        listCalls.push(options);
        return pages.shift()!;
      },
      del: async (urls, options) => {
        expect(options).toEqual({ token: "prod-token" });
        deleted.push(Array.isArray(urls) ? urls : [urls]);
      },
    });

    expect(count).toBe(2);
    expect(listCalls).toEqual([
      { prefix: "pet-packages/", cursor: undefined, token: "prod-token" },
      { prefix: "pet-packages/", cursor: "next", token: "prod-token" },
    ]);
    expect(deleted).toEqual([
      ["https://blob/old.zip"],
      ["https://blob/old2.zip"],
    ]);
  });
});

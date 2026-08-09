// @vitest-environment node

import { describe, expect, it } from "vitest";

import { cleanupExpiredPets, publishSpritesheet } from "@/server/blob-store";

describe("Vercel Blob boundary", () => {
  it("publishes a unique pets PNG to the non-production public store and verifies HTTPS download", async () => {
    const calls: Array<{ pathname: string; options: Record<string, unknown> }> =
      [];
    const controller = new AbortController();
    const url = await publishSpritesheet(Buffer.from("png"), {
      signal: controller.signal,
      environment: "preview",
      productionToken: "prod-token",
      nonProductionToken: "preview-token",
      randomUUID: () => "12345678-1234-1234-1234-123456789abc",
      put: async (pathname, _body, options) => {
        calls.push({ pathname, options });
        return {
          url: `https://store.public.blob.vercel-storage.com/${pathname}`,
        };
      },
      fetchImpl: async () =>
        new Response(Buffer.from("png"), {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    });

    expect(url).toBe(
      "https://store.public.blob.vercel-storage.com/pets/12345678-1234-1234-1234-123456789abc.png",
    );
    expect(calls).toEqual([
      {
        pathname: "pets/12345678-1234-1234-1234-123456789abc.png",
        options: {
          access: "public",
          addRandomSuffix: false,
          contentType: "image/png",
          cacheControlMaxAge: 2419200,
          token: "preview-token",
          abortSignal: controller.signal,
        },
      },
    ]);
  });

  it("uses only the production token while deleting every expired pets page", async () => {
    const deleted: string[][] = [];
    const pages = [
      {
        blobs: [
          {
            url: "https://blob/old.png",
            uploadedAt: new Date("2026-07-01T00:00:00Z"),
          },
          {
            url: "https://blob/new.png",
            uploadedAt: new Date("2026-08-01T00:00:00Z"),
          },
        ],
        cursor: "next",
        hasMore: true,
      },
      {
        blobs: [
          {
            url: "https://blob/old2.png",
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
      { prefix: "pets/", cursor: undefined, token: "prod-token" },
      { prefix: "pets/", cursor: "next", token: "prod-token" },
    ]);
    expect(deleted).toEqual([
      ["https://blob/old.png"],
      ["https://blob/old2.png"],
    ]);
  });
});

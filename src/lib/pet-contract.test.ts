import { describe, expect, it } from "vitest";

import {
  ACTIONS,
  EMOTIONS,
  DEFAULT_STATES,
  RUNNING_ACTIONS,
  normalizePetRequest,
  planFrames,
} from "@/lib/pet-contract";
import {
  assertAllowedCharacterImageUrl,
  buildCharacterFrameUrl,
} from "@/lib/nexon-url";

describe("pet contract", () => {
  it("normalizes all nine rows and keeps the default running action at A03", () => {
    const normalized = normalizePetRequest({
      characterName: "  천짱  ",
      catalogVersion: 1,
      states: DEFAULT_STATES,
    });

    expect(normalized.characterName).toBe("천짱");
    expect(normalized.includeWeapon).toBe(false);
    expect(Object.keys(normalized.states)).toEqual([
      "idle",
      "running-right",
      "running-left",
      "waving",
      "jumping",
      "failed",
      "waiting",
      "running",
      "review",
    ]);
    expect(normalized.states["running-right"]).toEqual({
      action: "A03",
      emotion: "E00.0",
    });
    expect(normalized.states["running-left"]).toEqual({
      action: "A03",
      emotion: "E00.0",
    });
  });

  it("accepts running walk choices and rejects unsupported running actions", () => {
    const normalized = normalizePetRequest({
      characterName: "천짱",
      catalogVersion: 1,
      states: {
        ...DEFAULT_STATES,
        "running-right": { action: "A02", emotion: "E00" },
        "running-left": { action: "A03", emotion: "E00" },
      },
    });
    expect(normalized.states["running-right"].action).toBe("A02");
    expect(normalized.states["running-left"].action).toBe("A03");

    expect(
      normalizePetRequest({
        characterName: "천짱",
        catalogVersion: 1,
        states: {
          ...DEFAULT_STATES,
          "running-left": { emotion: "E00" },
        },
      }).states["running-left"].action,
    ).toBe("A03");

    expect(() =>
      normalizePetRequest({
        characterName: "천짱",
        catalogVersion: 1,
        states: {
          ...DEFAULT_STATES,
          idle: { action: "A99", emotion: "E00" },
        },
      }),
    ).toThrow("INVALID_REQUEST");

    expect(() =>
      normalizePetRequest({
        characterName: "천짱",
        catalogVersion: 1,
        states: {
          ...DEFAULT_STATES,
          "running-left": { action: "A01", emotion: "E00" },
        },
      }),
    ).toThrow("INVALID_REQUEST");
  });

  it("uses the catalog frame range and repeats it to the row target", () => {
    const plan = planFrames(
      normalizePetRequest({
        characterName: "천짱",
        catalogVersion: 1,
        states: DEFAULT_STATES,
      }).states,
    );

    expect(plan[0].frames.map((frame) => frame.actionFrame)).toEqual([
      "A01.0",
      "A01.1",
      "A01.2",
      "A01.0",
      "A01.1",
      "A01.2",
    ]);
    expect(plan[1]).toMatchObject({ state: "running-right", flip: true });
    expect(plan[1].frames).toHaveLength(8);
    expect(plan[1].frames[0]?.emotionFrame).toBe("E00.0");

    const selectedPlan = planFrames(
      normalizePetRequest({
        characterName: "천짱",
        catalogVersion: 1,
        states: {
          ...DEFAULT_STATES,
          "running-right": { action: "A02", emotion: "E00" },
          "running-left": { action: "A03", emotion: "E00" },
        },
      }).states,
    );
    expect(selectedPlan[1]?.frames[0]?.actionFrame).toBe("A02.0");
    expect(selectedPlan[2]?.frames[0]?.actionFrame).toBe("A03.0");
  });

  it("accepts the optional weapon setting and rejects non-boolean values", () => {
    expect(
      normalizePetRequest({
        characterName: "천짱",
        catalogVersion: 1,
        includeWeapon: true,
        states: DEFAULT_STATES,
      }).includeWeapon,
    ).toBe(true);
    expect(() =>
      normalizePetRequest({
        characterName: "천짱",
        catalogVersion: 1,
        includeWeapon: "true",
        states: DEFAULT_STATES,
      }),
    ).toThrow("INVALID_REQUEST");
  });

  it("provides the complete v1 action and emotion choices to validation and UI", () => {
    expect(ACTIONS).toHaveLength(42);
    expect(RUNNING_ACTIONS.map((entry) => entry.code)).toEqual(["A02", "A03"]);
    expect(ACTIONS[0]).toEqual({
      code: "A00",
      officialName: "stand1",
      label: "기본 자세 1",
      lastFrame: 2,
    });
    expect(ACTIONS[41]?.code).toBe("A41");
    expect(EMOTIONS).toHaveLength(25);
    expect(EMOTIONS[24]?.code).toBe("E24");
  });
});

describe("NEXON image boundary", () => {
  const base =
    "https://open.api.nexon.com/static/maplestory/character/look/abc123";

  it("accepts only the exact HTTPS host and character look path", () => {
    expect(assertAllowedCharacterImageUrl(base).href).toBe(base);
    expect(() =>
      assertAllowedCharacterImageUrl(
        "https://open.api.nexon.com.evil.test/static/maplestory/character/look/abc123",
      ),
    ).toThrow("UPSTREAM_ERROR");
    expect(() =>
      assertAllowedCharacterImageUrl(
        "https://open.api.nexon.com/static/maplestory/character/other/abc123",
      ),
    ).toThrow("UPSTREAM_ERROR");
    expect(() =>
      assertAllowedCharacterImageUrl(
        "http://open.api.nexon.com/static/maplestory/character/look/abc123",
      ),
    ).toThrow("UPSTREAM_ERROR");
    expect(() =>
      assertAllowedCharacterImageUrl(
        "https://user:pass@open.api.nexon.com/static/maplestory/character/look/abc123",
      ),
    ).toThrow("UPSTREAM_ERROR");
  });

  it("rebuilds an official frame URL with only the allowed parameters", () => {
    expect(buildCharacterFrameUrl(base, "A03.2", "E06.0").href).toBe(
      "https://open.api.nexon.com/static/maplestory/character/look/abc123?action=A03.2&emotion=E06.0&wmotion=W04&width=400&height=400&x=200&y=280",
    );
    expect(buildCharacterFrameUrl(base, "A03.2", "E06.0", true).href).toBe(
      "https://open.api.nexon.com/static/maplestory/character/look/abc123?action=A03.2&emotion=E06.0&wmotion=W00&width=400&height=400&x=200&y=280",
    );
  });
});

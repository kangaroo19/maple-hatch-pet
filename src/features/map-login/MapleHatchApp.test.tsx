import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/map-login/MapSceneCanvas", () => ({
  MapSceneCanvas: ({
    creatorState,
    creatorKeyboardCommand,
  }: {
    creatorState: { selectedState: string; hasResult: boolean };
    creatorKeyboardCommand: {
      target: string;
      key: string;
    } | null;
  }) => (
    <div data-testid="canvas-state">
      {creatorState.selectedState}:{String(creatorState.hasResult)}:
      {creatorKeyboardCommand?.target}:{creatorKeyboardCommand?.key}
    </div>
  ),
}));

vi.mock("@/features/map-login/NoticeDialog", () => ({
  NoticeDialog: () => null,
}));

import { MapleHatchApp } from "@/features/map-login/MapleHatchApp";

const character = {
  name: "테스트용사",
  world: "스카니아",
  class: "히어로",
  level: 250,
  imageUrl:
    "https://open.api.nexon.com/static/maplestory/character/look/test.png",
};

const petResult = {
  displayName: "테스트용사",
  description: "테스트",
  spritesheetUrl: "https://example.com/pet.png",
  deepLink:
    "chatgpt://codex/pet/install?url=https%3A%2F%2Fexample.com%2Fpet.png",
  expiresAt: "2026-09-08T00:00:00.000Z",
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/characters/lookup"))
        return new Response(JSON.stringify({ character }), { status: 200 });
      if (url.endsWith("/api/pets"))
        return new Response(JSON.stringify(petResult), { status: 200 });
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("min-width: 1024px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0),
  );
  HTMLDialogElement.prototype.show = function show() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(cleanup);

describe("MapleHatchApp NewChar editor", () => {
  it("uses the framed stage without a separate product header", () => {
    const { container } = render(<MapleHatchApp />);

    expect(
      screen.queryByRole("heading", { name: "Maple Hatch Pet" }),
    ).not.toBeInTheDocument();
    const stage = container.querySelector(".map-stage");
    expect(
      stage?.querySelector(":scope > .frame-attribution"),
    ).toContainElement(
      screen.getByRole("link", { name: "개인정보 처리 안내" }),
    );
    expect(
      container.querySelector(".map-viewport .frame-attribution"),
    ).toBeNull();
  });

  it("keeps per-state values, preserves results across states, and invalidates changed selections", async () => {
    const user = userEvent.setup();
    render(<MapleHatchApp />);

    await user.type(await screen.findByLabelText("닉네임"), character.name);
    await user.click(screen.getByRole("button", { name: "로그인" }));

    const editor = await screen.findByRole("region", { name: "Pet 편집" });
    const previous = screen.getByRole("button", { name: "이전 상태" });
    const next = screen.getByRole("button", { name: "다음 상태" });
    const action = screen.getByLabelText("액션") as HTMLSelectElement;
    const emotion = screen.getByLabelText("표정") as HTMLSelectElement;
    expect(editor).toHaveTextContent("기본 (IDLE) · 1/9");
    expect(previous).toBeDisabled();

    await user.click(emotion);
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("canvas-state")).toHaveTextContent(
      "emotion:Enter",
    );

    await user.click(screen.getByRole("button", { name: "Pet 만들기" }));
    expect(
      await screen.findByRole("dialog", { name: "Pet 설치 정보" }),
    ).toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "닫기" }));
    const installInfo = await screen.findByRole("button", {
      name: "설치 정보",
    });
    await waitFor(() => expect(installInfo).toHaveFocus());

    await user.click(next);
    expect(screen.getByTestId("canvas-state")).toHaveTextContent(
      "running-right:true",
    );
    expect(action).toBeDisabled();
    expect(screen.getByRole("button", { name: "설치 정보" })).toBeVisible();

    await user.selectOptions(emotion, "E02");
    expect(screen.getByRole("button", { name: "Pet 만들기" })).toBeVisible();
    expect(screen.getByTestId("canvas-state")).toHaveTextContent(
      "running-right:false",
    );

    await user.click(next);
    await user.click(next);
    expect(action).not.toBeDisabled();
    await user.selectOptions(action, "A05");
    await user.click(previous);
    await user.click(next);
    expect(action.value).toBe("A05");
  });
});

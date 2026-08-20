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
  petId: "12345678-1234-4234-9234-123456789abc",
  packageUrl:
    "https://example.com/api/pets/12345678-1234-4234-9234-123456789abc/package",
  installCommand:
    "npx maple-hatch-pet add 12345678-1234-4234-9234-123456789abc",
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
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async () => undefined) },
  });
});

afterEach(cleanup);

describe("MapleHatchApp NewChar editor", () => {
  it("uses the framed stage without a separate product header or footer", () => {
    const { container } = render(<MapleHatchApp />);

    expect(
      screen.queryByRole("heading", { name: "Maple Hatch Pet" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector("footer")).toBeNull();
    expect(
      screen.queryByText("Data based on NEXON Open API"),
    ).not.toBeInTheDocument();
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
    expect(editor).toHaveTextContent("기본 · 1/9");
    expect(previous).toBeDisabled();

    await user.click(emotion);
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("canvas-state")).toHaveTextContent(
      "emotion:Enter",
    );

    const copyButton = screen.getByRole("button", { name: "명령어 복사" });
    expect(copyButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Pet 만들기" }));
    await waitFor(() => expect(copyButton).toBeEnabled());
    await user.click(copyButton);
    expect(screen.getByText("설치 명령을 복사했습니다.")).toBeInTheDocument();

    await user.click(next);
    expect(screen.getByTestId("canvas-state")).toHaveTextContent(
      "running-right:true",
    );
    expect(action).toBeDisabled();
    expect(copyButton).toBeEnabled();

    await user.selectOptions(emotion, "E02");
    expect(screen.getByRole("button", { name: "Pet 만들기" })).toBeVisible();
    expect(copyButton).toBeDisabled();
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

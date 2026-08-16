import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";

describe("privacy page attribution", () => {
  it("retains the NEXON attribution after the global footer moves into routes", () => {
    render(<PrivacyPage />);

    expect(screen.getByText("Data based on NEXON Open API")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "개인정보 처리 안내" }),
    ).toHaveAttribute("href", "/privacy");
    expect(screen.getByText(/Pet ID를 아는 누구나/)).toBeVisible();
    expect(screen.getByText(/조기 삭제를 요청할 때는 Pet ID/)).toBeVisible();
  });
});

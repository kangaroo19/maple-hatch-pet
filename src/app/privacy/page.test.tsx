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
  });
});

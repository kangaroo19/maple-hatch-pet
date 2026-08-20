import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";

describe("privacy page", () => {
  it("shows the privacy details without the attribution footer", () => {
    render(<PrivacyPage />);

    expect(
      screen.queryByText("Data based on NEXON Open API"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Pet ID를 아는 누구나/)).toBeVisible();
    expect(screen.getByText(/조기 삭제를 요청할 때는 Pet ID/)).toBeVisible();
  });
});

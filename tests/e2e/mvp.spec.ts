import { expect, test } from "@playwright/test";

const character = {
  name: "천짱",
  world: "스카니아",
  class: "마법사",
  level: 200,
  imageUrl: "https://open.api.nexon.com/static/maplestory/character/look/abc",
};

test("lookup, edit, create, install, invalidate and refresh flow", async ({
  page,
}) => {
  await page.route("**/api/characters/lookup", (route) =>
    route.fulfill({ json: { character, catalogVersion: 1 } }),
  );
  await page.route("**/api/pets", (route) =>
    route.fulfill({
      json: {
        displayName: "천짱",
        description: "스카니아 마법사 캐릭터",
        spritesheetUrl:
          "https://store.public.blob.vercel-storage.com/pets/test.png",
        deepLink:
          "codex://pets/install?name=%EC%B2%9C%EC%A7%B1&imageUrl=https%3A%2F%2Fstore.public.blob.vercel-storage.com%2Fpets%2Ftest.png&description=test&spriteVersionNumber=1",
        expiresAt: "2026-09-06T00:00:00.000Z",
      },
    }),
  );

  await page.goto("/");
  await expect(page.getByText("Data based on NEXON Open API")).toBeVisible();
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("닉네임을 입력해 주세요.")).toBeVisible();

  await page.getByLabel("닉네임").fill("천짱");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("heading", { name: "천짱" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "기본", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Pet 만들기" }).click();
  await expect(page.getByRole("link", { name: "Codex에 설치" })).toBeVisible();
  await expect(
    page.getByText("생성된 이미지는 28일 동안 설치에 사용할 수 있어요."),
  ).toBeVisible();
  const deletionLink = page.getByRole("link", { name: "이미지 삭제 요청" });
  await expect(deletionLink).toHaveAttribute("href", /test\.png/);

  await page.getByRole("button", { name: "검토", exact: true }).click();
  await expect(page.getByRole("link", { name: "Codex에 설치" })).toBeVisible();
  await page.getByLabel("표정").selectOption("E00");
  await expect(page.getByRole("link", { name: "Codex에 설치" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("link", { name: "Codex에 설치" })).toHaveCount(0);
});

test("privacy and narrow viewport contracts", async ({ page }) => {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "개인정보 처리 안내" }),
  ).toBeVisible();
  await expect(page.getByText("28일간 유효")).toBeVisible();
  await expect(page.getByText("최대 30일 이내")).toBeVisible();

  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/");
  await expect(
    page.getByText("너비 1024px 이상의 데스크톱 브라우저에서 이용해 주세요."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인" })).toHaveCount(0);
});

test("login uses the wooden sign already rendered in the map", async ({
  page,
}) => {
  await page.goto("/");

  const panel = page.getByRole("form", { name: "캐릭터 로그인" });
  const controls = panel.locator(".login-controls");

  await expect(panel).toBeVisible();
  await expect(page.getByRole("img", { name: "MapleStory" })).toHaveCount(0);
  await expect(panel).toHaveClass(/scene-login-overlay/);
  await expect(panel.locator(".login-board")).toHaveCount(0);
  await expect(controls).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "닉네임" })).toHaveCount(1);
  await expect(panel.locator('input[type="password"]')).toHaveCount(0);

  const controlsBackground = await controls.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  );
  expect(controlsBackground).toBe("none");
});

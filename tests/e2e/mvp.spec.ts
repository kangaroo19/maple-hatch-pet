import { expect, test, type Page } from "@playwright/test";

const character = {
  name: "천짱",
  world: "스카니아",
  class: "마법사",
  level: 200,
  imageUrl: "https://open.api.nexon.com/static/maplestory/character/look/abc",
};

async function clickCanvasLoginTarget(
  page: Page,
  target: "input" | "button",
) {
  const viewport = page.locator(".map-viewport");
  const canvas = page.locator("canvas.map-canvas");
  await expect(viewport).toHaveAttribute("aria-busy", "false");
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(1000);
  const point = await canvas.evaluate((element, selectedTarget) => {
    const canvasElement = element as HTMLCanvasElement;
    const mapViewport = canvasElement.closest(".map-viewport") as HTMLElement;
    const scale = mapViewport.clientWidth / 849;
    const camera = {
      left: -362,
      top: mapViewport.scrollTop / scale - 2162,
    };
    const mapPoint =
      selectedTarget === "input"
        ? { x: 141, y: -63.5 }
        : { x: 264.5, y: -53 };
    const bounds = canvasElement.getBoundingClientRect();
    return {
      x: bounds.left + (mapPoint.x - camera.left) * scale,
      y: bounds.top + (mapPoint.y - camera.top) * scale,
    };
  }, target);
  const targetClass = await page.evaluate(
    ({ x, y }) => (document.elementFromPoint(x, y) as HTMLElement)?.className,
    point,
  );
  if (!targetClass)
    throw new Error(
      `Canvas target is outside the viewport: ${JSON.stringify(point)}`,
    );
  expect(targetClass).toContain("map-canvas");
  await page.mouse.click(point.x, point.y);
}

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
  await clickCanvasLoginTarget(page, "button");
  await expect(page.getByRole("alertdialog")).toContainText(
    "닉네임을 입력해 주세요.",
  );
  await page.getByRole("button", { name: "확인" }).click();
  await expect(page.getByRole("textbox", { name: "닉네임" })).toBeFocused();

  await clickCanvasLoginTarget(page, "input");
  await page.keyboard.type("천짱");
  await clickCanvasLoginTarget(page, "button");
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

test("Canvas login uses the first-screen panel and keeps only a hidden native form", async ({ page }) => {
  await page.goto("/");

  const panel = page.getByRole("form", { name: "캐릭터 로그인" });

  await expect(page.getByRole("img", { name: "MapleStory" })).toHaveCount(0);
  await expect(panel).toHaveClass(/native-login-form/);
  expect(await panel.boundingBox()).toMatchObject({ width: 1, height: 1 });
  await expect(panel.getByRole("textbox", { name: "닉네임" })).toHaveCount(1);
  await expect(panel.locator('input[type="password"]')).toHaveCount(0);
  await clickCanvasLoginTarget(page, "input");
  await expect(panel.getByRole("textbox", { name: "닉네임" })).toBeFocused();
});

test("Canvas input performs one successful lookup without reloading scene assets", async ({
  page,
}) => {
  let sceneRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/map-login/kms-v43/scene.json"))
      sceneRequests += 1;
  });
  await page.route("**/api/characters/lookup", (route) =>
    route.fulfill({ json: { character, catalogVersion: 1 } }),
  );

  await page.goto("/");
  await clickCanvasLoginTarget(page, "input");
  const initialSceneRequests = sceneRequests;
  await page.keyboard.insertText("천짱");
  await clickCanvasLoginTarget(page, "button");

  await expect(page.getByRole("heading", { name: "천짱" })).toBeVisible();
  expect(sceneRequests).toBe(initialSceneRequests);
});

test("Canvas login blocks duplicate submissions while lookup is pending", async ({
  page,
}) => {
  let lookupRequests = 0;
  await page.route("**/api/characters/lookup", async (route) => {
    lookupRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: { character, catalogVersion: 1 } });
  });

  await page.goto("/");
  await clickCanvasLoginTarget(page, "input");
  await page.keyboard.insertText("천짱");
  await clickCanvasLoginTarget(page, "button");
  await clickCanvasLoginTarget(page, "button");

  await expect(page.getByRole("heading", { name: "천짱" })).toBeVisible();
  expect(lookupRequests).toBe(1);
});

test("camera transitions only through login and find-another-character actions", async ({
  page,
}) => {
  await page.route("**/api/characters/lookup", (route) =>
    route.fulfill({ json: { character, catalogVersion: 1 } }),
  );

  await page.goto("/");
  const viewport = page.locator(".map-viewport");
  await clickCanvasLoginTarget(page, "input");
  const loginScreenTop = await viewport.evaluate((element) => element.scrollTop);
  await page.mouse.wheel(0, -800);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(
    loginScreenTop,
  );

  await page.keyboard.insertText("천짱");
  await clickCanvasLoginTarget(page, "button");
  await expect(page.getByRole("heading", { name: "천짱" })).toBeVisible();
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(0);

  await viewport.hover();
  await page.mouse.wheel(0, 800);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(0);

  await page.getByRole("button", { name: "다른 캐릭터 찾기" }).click();
  await expect
    .poll(() =>
      viewport.evaluate(
        (element) =>
          Math.abs(
            element.scrollTop -
              (element.scrollHeight - element.clientHeight),
          ) < 1,
      ),
    )
    .toBe(true);
  const returnedLoginTop = await viewport.evaluate(
    (element) => element.scrollTop,
  );
  await page.mouse.wheel(0, -800);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(
    returnedLoginTop,
  );
});

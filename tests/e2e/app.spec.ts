import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { today, dateLabel } from "../../src/lib/format";
import { query, getPool } from "../../src/server/db";
test.beforeEach(async () => {
  await query('DELETE FROM "rateLimit"');
});
test.afterAll(async () => {
  await getPool().end();
});
async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill("owner@test.example");
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill("Test-password-2026!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "내가 쓰는 모든 것." }),
  ).toBeVisible();
}
test("protects data and MCP while demo stays read-only", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/data")).status()).toBe(401);
  const mcp = await request.get("/api/mcp");
  expect(mcp.status()).toBe(401);
  expect(mcp.headers()["www-authenticate"]).toContain(
    "oauth-protected-resource",
  );
  await page.goto("/demo?view=%2Fcoffee");
  await expect(page.locator(".coffee-row")).toHaveCount(11);
  await page.getByRole("button", { name: "원두 등록", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("둘러보기");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("platform navigation, filters, details and preferences", async ({
  page,
}, info) => {
  await login(page);
  const nav = page.getByRole("navigation", {
    name: info.project.name === "mobile" ? "모바일 주 메뉴" : "PC 주 메뉴",
  });
  await nav.getByRole("link", { name: /커피 원두/ }).click();
  await expect(page.getByRole("heading", { name: "커피." })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("원두 검색").fill("프루티봉봉");
  await expect(page.locator(".coffee-row")).toHaveCount(1);
  await page.getByRole("heading", { name: "프루티봉봉", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "머신 세팅 기록" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "내 평가 남기기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("경험", { exact: true }).selectOption("먹어봄");
  await dialog
    .getByLabel("나의 평가")
    .fill(`브라우저 ${info.project.name}에서 기록한 취향`);
  await dialog.getByRole("button", { name: "저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByText(`브라우저 ${info.project.name}에서 기록한 취향`),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText(`브라우저 ${info.project.name}에서 기록한 취향`),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-bean-detail.png`,
    fullPage: true,
  });
});
test("wine creation, receipt, consumption, tasting and reversal persist", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/wine");
  await page.getByRole("button", { name: "와인 등록", exact: true }).click();
  let dialog = page.getByRole("dialog");
  const name = `브라우저 와인 ${info.project.name} ${Date.now()}`;
  await dialog.getByLabel("한글 이름").fill(name);
  await dialog.getByLabel("종류", { exact: true }).selectOption("레드");
  await dialog.getByRole("button", { name: "저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("heading", { name, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "구매와 소비의 기록" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "입고", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("입고 수량 (병)").fill("2");
  await dialog.getByLabel("병당 구매가 (원)").fill("32000");
  await dialog.getByRole("button", { name: "저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("dd").filter({ hasText: "2병" })).toBeVisible();
  await page.getByRole("button", { name: "한 병 소비하기" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("시음 노트").fill("함께 마신 한 병");
  await dialog.getByLabel("점수 (0~100)").fill("91");
  await dialog.getByRole("button", { name: "저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("dd").filter({ hasText: "1병" })).toBeVisible();
  await expect(
    page.getByText("함께 마신 한 병", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("dd").filter({ hasText: "1병" })).toBeVisible();
  await expect(page.locator(".event-row").first()).toContainText(
    dateLabel(today()),
  );
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-wine-detail.png`,
    fullPage: true,
  });
  const consumed = page
    .locator(".event-row")
    .filter({ has: page.locator("strong", { hasText: "소비" }) });
  await consumed.getByRole("button", { name: "이 기록 취소" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("취소 사유").fill("동작 검증");
  await dialog.getByRole("button", { name: "저장하기" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("dd").filter({ hasText: "2병" })).toBeVisible();
});
test("keyboard closes forms and all main pages fit the viewport", async ({
  page,
}, info) => {
  await login(page);
  for (const path of [
    "/",
    "/coffee",
    "/coffee/brands",
    "/wine?stock=all",
    "/wine/glasses",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page.locator(".main-content h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      path,
    ).toBe(true);
    if (path === "/coffee")
      await page.screenshot({
        path: `test-results/visual/${info.project.name}-coffee.png`,
        fullPage: true,
      });
    if (path === "/")
      await page.screenshot({
        path: `test-results/visual/${info.project.name}-home.png`,
        fullPage: true,
      });
  }
  await page.getByRole("button", { name: "초대", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".settings-signout").click();
  await expect(
    page.getByRole("button", { name: "로그인", exact: true }),
  ).toBeVisible();
});

test("AI connection keeps OAuth context through login, consent and disconnect", async ({
  page,
  request,
}) => {
  const { randomBytes, createHash } = await import("node:crypto");
  const verifier = randomBytes(32).toString("base64url");
  const registration = await request.post("/api/auth/oauth2/register", {
    data: {
      client_name: "Browser AI connection",
      redirect_uris: ["http://127.0.0.1:8888/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "openid offline_access wine:read wine:write",
      application_type: "native",
    },
  });
  expect(registration.ok()).toBe(true);
  const client = await registration.json();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: "http://127.0.0.1:8888/callback",
    scope: "openid offline_access wine:read wine:write",
    resource: "http://localhost:3100/api/mcp",
    state: "browser-state",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  await page.route("http://127.0.0.1:8888/callback?**", (route) =>
    route.fulfill({ body: "OAuth callback received" }),
  );
  await page.goto(`/api/auth/oauth2/authorize?${params}`);
  await page.getByLabel("이메일", { exact: true }).fill("owner@test.example");
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill("Test-password-2026!");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(
    page.getByText("와인 입고·소비·시음 기록", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "연결 허용" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:8888\/callback\?/);
  const callback = new URL(page.url());
  expect(callback.searchParams.get("state")).toBe("browser-state");
  const token = await request.post("/api/auth/oauth2/token", {
    form: {
      grant_type: "authorization_code",
      client_id: client.client_id,
      code: callback.searchParams.get("code")!,
      redirect_uri: "http://127.0.0.1:8888/callback",
      code_verifier: verifier,
      resource: "http://localhost:3100/api/mcp",
    },
  });
  expect(token.ok(), await token.text()).toBe(true);
  const tokens = await token.json();
  const headers = {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": "2025-11-25",
  };
  const rpc = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
  expect(
    (await request.post("/api/mcp", { headers, data: rpc })).status(),
  ).toBe(200);
  await page.goto("/settings");
  const connection = page
    .locator(".consent-row")
    .filter({ hasText: client.client_id });
  await expect(connection).toBeVisible();
  await connection.getByRole("button", { name: "해제" }).click();
  await expect(connection).not.toBeVisible();
  expect(
    (await request.post("/api/mcp", { headers, data: rpc })).status(),
  ).toBe(401);
});

test("wine photo upload and expanded filters work on both platforms", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/wine?stock=all");
  await expect(page.getByLabel("셀러 대시보드")).toBeVisible();
  await page.getByLabel("와인 정렬").selectOption("price_desc");
  await page.getByText("상세 필터", { exact: true }).click();
  await page.getByLabel("최소 구입가", { exact: true }).fill("30000");
  await expect(page.locator(".cellar-row").first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("최소 구입가", { exact: true })).toHaveValue(
    "30000",
  );
  await expect(page.getByLabel("와인 정렬")).toHaveValue("price_desc");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("heading", { name: /와인 셀러/ })).toBeVisible();
  await expect(page.locator(".cellar-row").first()).toBeVisible();
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cellar.png`,
    fullPage: true,
  });
  await page.locator(".cellar-product").first().click();
  const sharp = (await import("sharp")).default;
  const buffer = await sharp({
    create: { width: 240, height: 360, channels: 3, background: "#a34e67" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("와인 사진 업로드")
    .setInputFiles({ name: "bottle.png", mimeType: "image/png", buffer });
  await expect(
    page.getByText("사진을 저장했습니다.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  const img = page.locator(".wine-detail .product-art img");
  await expect(img).toBeVisible();
  expect(
    await img.evaluate(
      (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
    ),
  ).toBe(true);
});

test("coffee prices without weight, sorting and brand round trips", async ({
  page,
}, info) => {
  await login(page);
  const brandName = `가격 검증 ${info.project.name}`;
  async function command(operation: string, input: Record<string, unknown>) {
    const response = await page.request.post("/api/commands", {
      data: { operation, input: { ...input, idempotency_key: randomUUID() } },
      headers: { Origin: "http://localhost:3100" },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const created = await command("coffee_create_brand", { name: brandName });
  const brandId = created.data.id;
  for (const [name, price, weight_g] of [
    ["부산 테스트", 48000, null],
    ["무료 테스트", 0, 200],
    ["미입력 테스트", null, null],
  ] as const) {
    await command("coffee_create_bean", {
      brand_id: brandId,
      name,
      price,
      weight_g,
    });
  }
  await page.goto("/coffee/brands");
  const brandLink = page.getByRole("link", { name: `${brandName} 원두 보기` });
  await expect(brandLink).toContainText("원두 3개 보기");
  await brandLink.click();
  await expect(page.locator(".coffee-row")).toHaveCount(3);
  const busan = page.locator(".coffee-row").filter({
    has: page.getByRole("heading", { name: "부산 테스트", exact: true }),
  });
  await expect(busan.locator(".coffee-price strong")).toHaveText("48,000원");
  await expect(busan).toContainText("중량 미입력");
  await expect(
    page.locator(".coffee-row img, .coffee-row .product-art"),
  ).toHaveCount(0);
  await page.getByLabel("원두 정렬").selectOption("price-asc");
  await expect(page.locator(".coffee-row h3")).toHaveText([
    "무료 테스트",
    "부산 테스트",
    "미입력 테스트",
  ]);
  await page.getByLabel("원두 정렬").selectOption("kg");
  await expect(page.locator(".coffee-row").first()).toContainText(
    "무료 테스트",
  );
  await page.getByLabel("원두 정렬").selectOption("price-desc");
  await expect(page.locator(".coffee-row h3")).toHaveText([
    "부산 테스트",
    "무료 테스트",
    "미입력 테스트",
  ]);
  await busan.getByRole("heading").click();
  await expect(
    page.locator(".detail-facts").getByText("48,000원", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "원두 컬렉션", exact: true }).click();
  await expect(page.getByLabel("원두 정렬")).toHaveValue("price-desc");
  await expect(page.locator(".coffee-row")).toHaveCount(3);
  await page
    .locator(".section-tabs")
    .getByRole("link", { name: "브랜드 스토어" })
    .click();
  await page
    .locator(".section-tabs")
    .getByRole("link", { name: /원두 컬렉션/ })
    .click();
  await expect(page.getByLabel("브랜드 필터")).toHaveValue(brandId);
  await expect(page.getByLabel("원두 정렬")).toHaveValue("price-desc");
  await page.reload();
  await expect(page.locator(".coffee-row")).toHaveCount(3);
  await expect(page.locator(".coffee-row").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-coffee-prices.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "초기화", exact: true }).click();
  await expect(page.getByLabel("브랜드 필터")).toHaveValue("");
  await expect(page.getByLabel("원두 정렬")).toHaveValue("name");
});

import { cashWorkbook, cashHistoryWorkbook } from "../cash-fixture";
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
  expect((await request.get("/api/cash")).status()).toBe(401);
  expect((await request.get("/api/cash/files")).status()).toBe(401);
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
    "/cash",
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

test("cash workbook upload, replacement, drilldown and platform layout", async ({
  page,
}, info) => {
  await login(page);
  await page.goto("/cash?tab=files");
  const filename = `가계부 ${info.project.name}.xlsx`;
  const input = page.getByLabel("가계부 엑셀 파일");
  await input.setInputFiles({
    name: filename,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: cashWorkbook(),
  });
  await expect(
    page.getByRole("heading", { name: "업로드 미리보기" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "확인한 파일 적용" }).click();
  await expect(page.getByText("반영 완료", { exact: true })).toBeVisible();
  await expect(
    page.locator(".cash-file-card").filter({ hasText: filename }),
  ).toBeVisible();
  await input.setInputFiles({
    name: filename.normalize("NFD"),
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: cashWorkbook(22000),
  });
  await expect(page.getByText("기존 파일 교체", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cash-upload.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "확인한 파일 적용" }).click();
  await expect(page.getByText("반영 완료", { exact: true })).toBeVisible();
  await expect(
    page.locator(".cash-file-card").filter({ hasText: filename }),
  ).toHaveCount(1);
  const nav = page.getByRole("navigation", { name: "가계부 메뉴" });
  await nav.getByRole("button", { name: "요약", exact: true }).click();
  await page.locator(".cash-filter-panel > summary").click();
  await page
    .getByLabel("가계부 자료")
    .selectOption(filename.replace(".xlsx", ""));
  await page.getByLabel("종료 월").fill("2026-03");
  await page.getByLabel("시작 월").fill("2026-01");
  await expect(page.locator(".cash-refreshing")).toHaveCount(0);
  await expect(page.locator(".cash-year-table")).toContainText("29,000원");
  await expect(page.locator(".cash-kpis")).toHaveCount(0);
  await expect(page.getByText("결제수단별 지출")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("시작 월").fill("2025-01");
  await expect(page.locator(".cash-year-table tbody tr")).toHaveCount(2);
  await page.locator(".cash-filter-panel > summary").click();
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cash-summary.png`,
    fullPage: true,
  });
  await page.locator(".cash-filter-panel > summary").click();
  await page.getByLabel("시작 월").fill("2026-01");
  await expect(page.locator(".cash-year-table tbody tr")).toHaveCount(1);
  await page.locator(".cash-filter-panel > summary").click();
  const summaryUrl = page.url();
  const average = page.getByRole("button", {
    name: "2026년 항목별 월 평균 지출",
    exact: true,
  });
  await average.scrollIntoViewIfNeeded();
  const summaryScroll = await page.evaluate(() => window.scrollY);
  await average.click();
  const averageDialog = page.getByRole("dialog", {
    name: "2026년 항목별 월 평균 지출",
    exact: true,
  });
  await expect(averageDialog).toBeVisible();
  const foodAverage = averageDialog
    .locator(".cash-breakdown-group")
    .filter({ hasText: "식비" });
  await expect(foodAverage).toContainText("6,667원");
  await expect(foodAverage).toContainText("69.0%");
  await foodAverage.getByRole("button", { name: "식비", exact: true }).click();
  await expect(foodAverage.locator(".cash-breakdown-child")).toContainText(
    "식사",
  );
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cash-average.png`,
    animations: "disabled",
  });
  await foodAverage
    .locator(".cash-breakdown-child")
    .getByRole("button")
    .click();
  await expect(
    page.getByRole("dialog", { name: "식비 · 식사 · 지출 · 거래 내역" }),
  ).toBeVisible();
  await expect(page.locator(".cash-result-count")).toContainText("20,000원");
  await page.keyboard.press("Escape");
  await expect(averageDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(average).toBeFocused();
  expect(page.url()).toBe(summaryUrl);
  expect(await page.evaluate(() => window.scrollY)).toBe(summaryScroll);
  await nav.getByRole("button", { name: "분류 분석" }).click();
  await expect(page.locator(".cash-refreshing")).toHaveCount(0);
  await page
    .getByRole("button", { name: "식비 추이", exact: true })
    .filter({ visible: true })
    .click();
  const trendDialog = page.getByRole("dialog");
  await trendDialog.getByRole("button", { name: "비중", exact: true }).click();
  await expect(trendDialog.locator(".cash-share")).toContainText(["69.0%"]);
  await expect(
    trendDialog.getByRole("img", { name: "식비 비중 추이" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "전체 항목 비교", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog").getByRole("img")).toHaveAccessibleName(
    /식비.*여행.*추이/,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "식비", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "식비", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "월별", exact: true }).click();
  await expect(page.getByLabel("분석 연도")).toHaveValue("2026");
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cash-categories.png`,
    fullPage: true,
  });
  const analysisUrl = page.url();
  // Period composition opens matching transactions while leaving all analysis controls intact.
  await page.getByLabel("비교 기간", { exact: true }).selectOption("2026-01");
  await page
    .locator(".cash-composition-list")
    .getByRole("button")
    .filter({ hasText: "식비" })
    .click();
  await expect(page.locator(".cash-result-count")).toContainText("2건");
  await expect(page.locator(".cash-result-count")).toContainText("20,000원");
  const detailDialog = page.getByRole("dialog", {
    name: "식비 · 지출 · 거래 내역",
  });
  await expect(detailDialog).toBeVisible();
  await page.getByRole("button", { name: "그래프 보기", exact: true }).click();
  await expect(detailDialog.getByRole("img")).toBeVisible();
  await page.getByLabel("상세 거래 정렬").selectOption("amount-asc");
  await expect(page.locator(".cash-transaction").first()).toContainText(
    "-2,000원",
  );
  expect(page.url()).toBe(analysisUrl);
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cash-detail.png`,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("비교 기간", { exact: true })).toHaveValue(
    "2026-01",
  );
  await expect(page.getByLabel("분석 연도")).toHaveValue("2026");
  expect(page.url()).toBe(analysisUrl);
  await nav.getByRole("button", { name: "거래 내역", exact: true }).click();
  await expect(page.locator(".cash-result-count")).toContainText("5건");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await nav.getByRole("button", { name: "파일 관리" }).click();
  await input.setInputFiles({
    name: filename,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("invalid workbook"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "확인한 파일 적용" }),
  ).toBeDisabled();
  await expect(
    page.locator(".cash-file-card").filter({ hasText: filename }),
  ).toHaveCount(1);
});

test("single HTML cash page loads private originals once and keeps original analysis", async ({
  page,
}, info) => {
  const unauth = await page.request.get("/api/html-pages/cash-old");
  expect(unauth.status()).toBe(401);
  await login(page);
  const upload = await page.request.post(
    `/api/cash/files?filename=${encodeURIComponent(`원본 연결 ${info.project.name}.xlsx`)}&version=0`,
    {
      headers: {
        Origin: "http://localhost:3100",
        "Content-Type": "application/octet-stream",
      },
      data: cashWorkbook(),
    },
  );
  expect(upload.ok()).toBe(true);
  expect((await page.request.get("/api/html-pages/__proto__")).status()).toBe(
    404,
  );
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/cash/files?id=")) requests.push(r.url());
  });
  await page.goto("/cash/old");
  const frame = page.frameLocator('iframe[title="가계부 원본 HTML"]');
  await expect(frame.locator("#year-summary-table table")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(requests.length).toBeGreaterThan(0);
  expect(new Set(requests).size).toBe(requests.length);
  const fileCount = requests.length;
  await frame.locator('[data-avg-year="2026"]').click();
  await expect(frame.locator("#detail-title")).toHaveText(
    "2026년 항목별 월 평균 지출",
  );
  await frame.locator("#detail-chart-toggle").click();
  await expect(frame.locator("#detailChart")).toBeVisible();
  expect(requests).toHaveLength(fileCount);
  const iframe = page.locator("iframe");
  await expect(iframe).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-downloads",
  );
  expect(
    await iframe.evaluate(
      (el: HTMLIFrameElement) => el.contentDocument === null,
    ),
  ).toBe(true);
  await expect(frame.locator("#btn-folder")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cash-old.png`,
    animations: "disabled",
  });
});

test("cash dense history keeps mobile comparisons readable and all detail pages scoped", async ({
  page,
}, info) => {
  await login(page);
  const filename = `흐름 검증 ${info.project.name}.xlsx`;
  const upload = await page.request.post(
    `/api/cash/files?filename=${encodeURIComponent(filename)}&version=0`,
    {
      headers: {
        Origin: "http://localhost:3100",
        "Content-Type": "application/octet-stream",
      },
      data: cashHistoryWorkbook(),
    },
  );
  expect(upload.ok()).toBe(true);
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(
    `/cash?member=${encodeURIComponent(filename.replace(".xlsx", ""))}`,
  );
  await expect(page.locator(".cash-year-table tbody tr")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cash-history.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "2025년 지출 내역" }).click();
  await expect(
    page.getByRole("dialog").locator(".cash-result-count"),
  ).toContainText("84건");
  await expect(
    page.getByRole("dialog").locator(".cash-transaction"),
  ).toHaveCount(50);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "다음", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".cash-transaction"),
  ).toHaveCount(34);
  await page.getByLabel("상세 거래 정렬").selectOption("amount-desc");
  await expect(
    page.getByRole("dialog").locator(".cash-pagination"),
  ).toContainText("1 / 2");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "가계부 메뉴" })
    .getByRole("button", { name: "분류 분석" })
    .click();
  await page.getByRole("button", { name: "월별", exact: true }).click();
  await page.getByLabel("분석 연도").selectOption("2025");
  const categoryButton = page
    .getByRole("button", {
      name: "생활용품과 정기 구독 서비스 추이",
      exact: true,
    })
    .filter({ visible: true });
  await categoryButton.click();
  await expect(
    page.getByRole("dialog").locator(".cash-insight-values details"),
  ).toHaveCount(12);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "비중", exact: true })
    .click();
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cash-history-trend.png`,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.locator(".cash-category-panel").scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/visual/${info.project.name}-cash-history-comparison.png`,
  });
});

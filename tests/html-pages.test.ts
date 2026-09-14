import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findHtmlPage } from "@/lib/html-pages";
import { htmlPage } from "@/server/html-pages";

describe("HTML pages registration and loader", () => {
  it("registers asset-return in htmlPages list", () => {
    const page = findHtmlPage("asset-return");
    expect(page).toBeDefined();
    expect(page?.filename).toBe("asset_return_calculator.html");
    expect(page?.title).toContain("아파트 vs 주식 자산 비교 계산기");
  });

  it("loads and isolates asset-return HTML with CSP", async () => {
    const html = await htmlPage("asset-return");
    expect(html).not.toBeNull();
    expect(html).toContain("http-equiv=\"Content-Security-Policy\"");
    expect(html).toContain("calculateAcquisitionTax");
    expect(html).toContain("transferA");
    expect(html).toContain("transferB");
    expect(html).toContain("갈아타기 (이사)");
  });

  it("returns null for unknown html page", async () => {
    const html = await htmlPage("unknown-page");
    expect(html).toBeNull();
  });

  it("calculates 84m2 acquisition tax correctly for all tiers", async () => {
    const html = (await htmlPage("asset-return"))!;
    // Evaluate the calculateAcquisitionTax function from the HTML in a sandbox Function context
    const fnMatch = html.match(/function calculateAcquisitionTax\(price\) \{[\s\S]*?return \{ total, acquisition, education \};\s*\}/);
    expect(fnMatch).not.toBeNull();
    const calculateAcquisitionTax = new Function(`${fnMatch![0]}; return calculateAcquisitionTax;`)();

    // 1. 6억원 이하 (1.1% = 취득 1.0% + 교육 0.1%)
    const tax5Eok = calculateAcquisitionTax(5e8);
    expect(tax5Eok.acquisition).toBe(5_000_000);
    expect(tax5Eok.education).toBe(500_000);
    expect(tax5Eok.total).toBe(5_500_000);

    // 2. 6억원 초과 ~ 9억원 이하 (7억원: 취득세율 (7 * 2/3 - 3)% = 1.6667%)
    const tax7Eok = calculateAcquisitionTax(7e8);
    expect(tax7Eok.acquisition).toBe(Math.floor(7e8 * 0.016667));
    expect(tax7Eok.education).toBe(Math.floor(tax7Eok.acquisition * 0.1));
    expect(tax7Eok.total).toBe(tax7Eok.acquisition + tax7Eok.education);
    // 7억 기준 약 1283만원
    expect(tax7Eok.total).toBeGreaterThan(12_800_000);
    expect(tax7Eok.total).toBeLessThan(12_900_000);

    // 3. 9억원 초과 (3.3% = 취득 3.0% + 교육 0.3%)
    const tax15Eok = calculateAcquisitionTax(15e8);
    expect(tax15Eok.acquisition).toBe(45_000_000);
    expect(tax15Eok.education).toBe(4_500_000);
    expect(tax15Eok.total).toBe(49_500_000);
  });
});

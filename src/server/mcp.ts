import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  commandSchemas,
  commandScopes,
  listSchema,
  webOnlyCommands,
  type Operation,
} from "@/lib/contracts";
import { snapshot, execute } from "./service";
import { photoSchema, uploadWinePhoto } from "./wine-photos";
import { wineFacts, filterWines, type WineFilters } from "@/lib/wine-cellar";
import { readAssetHistory, readAssetItems, readAssetOverview } from "./assets";
import {
  assetClassificationRules,
  assetGroupName,
  assetRulesVersion,
  classifyAsset,
} from "@/lib/assets";
import { query } from "./db";
import { AppError, rateLimit } from "./security";
import { appUrl } from "./auth";
import type { Actor, Scope } from "@/lib/types";
function output(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: { data: JSON.parse(JSON.stringify(data)) },
  };
}
const descriptions: Partial<Record<Operation, string>> = {
  coffee_create_bean:
    "원두 상품을 등록합니다. 확인하지 못한 가격·배전은 null로 남깁니다.",
  coffee_log_brew_setting:
    "내 머신의 분쇄도·용량 설정 숫자를 기록합니다. g 단위로 추정하지 마세요.",
  wine_receive_stock: "구매일·가격을 보존하고 와인 재고를 입고합니다.",
  wine_consume:
    "와인 재고를 소비합니다. 부족하면 거부합니다. 시음도 함께 기록할 수 있습니다.",
  coffee_save_preference: "인증된 사용자 본인의 원두 취향을 저장합니다.",
  wine_log_tasting: "재고 변화 없이 시음을 기록합니다.",
  asset_record_snapshot:
    "한 사람의 그 날짜 자산 현황 전체를 저장합니다. 원본 자산 목록의 한 줄이 items 한 개입니다. 그룹별로 합산하지 말고 종목명을 그대로 name에 넣으세요. 같은 사람·같은 날짜로 저장하면 기존 값을 통째로 교체하므로 항상 전체 포트폴리오를 한 번에 보냅니다. 금액은 원화 환산 정수이며 group_key는 asset_get_classification_rules의 값을 사용합니다.",
  asset_update_item:
    "이미 저장된 기록에서 항목 한 줄의 자산그룹이나 금액만 고칩니다. 나머지 항목은 그대로 둡니다. 분류를 잘못 넣었거나 금액에 오타가 난 한 줄을 바로잡을 때 쓰고, 그 날짜 전체를 다시 보내야 하면 asset_record_snapshot을 씁니다. snapshot_id·item_id는 asset_list_records에서 얻고 expected_version은 그 스냅샷의 version입니다.",
  asset_delete_snapshot: "잘못 등록한 날짜의 자산 기록을 삭제합니다.",
};
export function mcpHandler(actor: Actor) {
  return createMcpHandler(
    (server) => {
      for (const [operation, schema] of Object.entries(commandSchemas)) {
        const scope = commandScopes[operation as Operation];
        if (!scope || !actor.scopes.includes(scope)) continue;
        // 웹 전용 명령은 scope가 있어도 도구로 내보내지 않는다.
        if (webOnlyCommands.has(operation as Operation)) continue;
        server.registerTool(
          operation,
          {
            description:
              (descriptions[operation as Operation] ??
                "가족의 " + operation + " 작업을 수행합니다.") +
              " 변경 요청은 idempotency_key(UUID)가 필수입니다. 통신 재시도에는 같은 키와 같은 입력을 사용하세요. 새 작업에만 새 키를 만드세요.",
            inputSchema: schema as z.ZodObject<z.ZodRawShape>,
            annotations: {
              readOnlyHint: false,
              destructiveHint:
                operation === "wine_consume" ||
                operation === "wine_reverse_event" ||
                operation === "asset_delete_snapshot" ||
                operation === "asset_record_snapshot",
              idempotentHint: true,
              openWorldHint: false,
            },
            _meta: { securitySchemes: [{ type: "oauth2", scopes: [scope] }] },
          },
          async (input: unknown) => {
            try {
              return output(
                await execute(actor, operation as Operation, input),
              );
            } catch (error) {
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify({
                      code:
                        error instanceof AppError
                          ? error.code
                          : "INVALID_OPERATION",
                      message:
                        error instanceof AppError
                          ? error.message
                          : "입력 또는 중복 항목을 확인해주세요.",
                    }),
                  },
                ],
              };
            }
          },
        );
      }
      if (actor.scopes.includes("wine:write")) {
        server.registerTool(
          "wine_upload_photo",
          {
            description:
              "등록한 와인의 대표 사진을 업로드합니다. wine_create 후 반환된 id/version을 사용하세요. JPEG/PNG/WebP 파일을 실제로 읽을 수 있을 때만 base64로 전달합니다(원본 최대 2MB). 파일에 접근할 수 없으면 wine_photo_upload_link를 사용하세요. 위치정보를 제거하고 압축하며 가족에게만 공개합니다.",
            inputSchema: photoSchema,
            annotations: {
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: true,
              openWorldHint: false,
            },
          },
          async (input) => {
            try {
              await rateLimit(`photo:${actor.userId}`, 12);
              return output(await uploadWinePhoto(actor, input));
            } catch (e) {
              return {
                isError: true,
                content: [
                  {
                    type: "text" as const,
                    text:
                      e instanceof AppError
                        ? e.message
                        : "사진 입력을 확인해주세요.",
                  },
                ],
              };
            }
          },
        );
        server.registerTool(
          "wine_photo_upload_link",
          {
            description:
              "AI에서 첨부파일을 전달할 수 없을 때 사용자가 직접 사진을 올릴 가족 로그인 화면을 반환합니다.",
            inputSchema: z.object({ wine_id: z.uuid() }),
            annotations: { readOnlyHint: true, openWorldHint: false },
          },
          async ({ wine_id }) => {
            const rows = await query(
              "SELECT id FROM wines WHERE id=$1 AND household_id=$2",
              [wine_id, actor.householdId],
            );
            if (!rows.length)
              return {
                isError: true,
                content: [{ type: "text" as const, text: "NOT_FOUND" }],
              };
            return output({
              url: `${appUrl()}/wine/${wine_id}#photo-upload`,
              instruction: "가족 계정으로 로그인 후 사진을 선택해주세요.",
            });
          },
        );
      }
      const collections = {
        coffee_list_brands: "brands",
        coffee_list_beans: "beans",
        coffee_list_machines: "machines",
        wine_list: "wines",
        wine_list_glasses: "glasses",
      } as const;
      for (const [name, collection] of Object.entries(collections)) {
        const scope: Scope = name.startsWith("coffee")
          ? "coffee:read"
          : "wine:read";
        if (!actor.scopes.includes(scope)) continue;
        server.registerTool(
          name,
          {
            description:
              "가족 목록을 조회합니다. next_cursor가 있으면 다음 페이지를 조회하세요.",
            inputSchema: listSchema.extend({
              country: z.string().max(100).optional(),
              region: z.string().max(200).optional(),
              grape: z.string().max(200).optional(),
              vintage: z.string().max(10).optional(),
              min_price: z.number().nonnegative().optional(),
              max_price: z.number().nonnegative().optional(),
              from: z.iso.date().optional(),
              to: z.iso.date().optional(),
              min_score: z.number().min(0).max(100).optional(),
              sort: z
                .enum([
                  "added_desc",
                  "price_asc",
                  "price_desc",
                  "date_desc",
                  "date_asc",
                  "name_asc",
                  "vintage_asc",
                  "stock_desc",
                  "score_desc",
                ])
                .optional(),
            }),
            annotations: { readOnlyHint: true, openWorldHint: false },
            _meta: { securitySchemes: [{ type: "oauth2", scopes: [scope] }] },
          },
          async (input) => {
            const data = await snapshot(actor);
            let rows = (
              data[collection as "beans"] as unknown as Record<
                string,
                unknown
              >[]
            ).filter((r) => !r.archived);
            if (collection === "wines") {
              const filters: WineFilters = {
                q: input.query,
                type: input.type,
                country: input.country,
                region: input.region,
                grape: input.grape,
                vintage: input.vintage,
                sort: input.sort,
                stock: input.in_stock ? "" : "all",
                from: input.from,
                to: input.to,
                min_price: input.min_price?.toString(),
                max_price: input.max_price?.toString(),
                min_score: input.min_score?.toString(),
              };
              rows = filterWines(
                data.wines.map((w) => wineFacts(w, data)),
                filters,
              );
            }
            if (input.query && collection !== "wines")
              rows = rows.filter((r) =>
                String(r.name)
                  .toLowerCase()
                  .includes(input.query!.toLowerCase()),
              );
            if (input.type && collection !== "wines")
              rows = rows.filter((r) => r.type === input.type);
            if (input.in_stock) rows = rows.filter((r) => Number(r.stock) > 0);
            const items = rows
              .slice(input.cursor, input.cursor + input.limit)
              .map((r) => ({
                ...r,
                url: `${appUrl()}${collection === "beans" ? `/coffee/beans/${r.id}` : collection === "wines" ? `/wine/${r.id}` : collection === "brands" ? "/coffee/brands" : collection === "glasses" ? "/wine/glasses" : "/settings"}`,
              }));
            return output({
              items,
              next_cursor:
                input.cursor + input.limit < rows.length
                  ? input.cursor + input.limit
                  : null,
              total: rows.length,
            });
          },
        );
      }
      for (const domain of ["coffee", "wine"] as const) {
        const scope: Scope = `${domain}:read`;
        if (!actor.scopes.includes(scope)) continue;
        server.registerTool(
          domain === "coffee" ? "coffee_get_bean" : "wine_get",
          {
            description: "안정적인 ID로 상세 정보와 가족 기록을 조회합니다.",
            inputSchema: z.object({ id: z.uuid() }),
            annotations: { readOnlyHint: true, openWorldHint: false },
          },
          async ({ id }) => {
            const s = await snapshot(actor);
            const item = (domain === "coffee" ? s.beans : s.wines).find(
              (x) => x.id === id,
            );
            if (!item)
              return {
                isError: true,
                content: [{ type: "text" as const, text: "NOT_FOUND" }],
              };
            return output(
              domain === "coffee"
                ? {
                    ...item,
                    preferences: s.preferences.filter((x) => x.bean_id === id),
                    settings: s.brews.filter((x) => x.bean_id === id),
                    url: `${appUrl()}/coffee/beans/${id}`,
                  }
                : {
                    ...wineFacts(item as import("@/lib/types").Wine, s),
                    tastings: s.tastings.filter((x) => x.wine_id === id),
                    purchases: s.purchases.filter((x) => x.wine_id === id),
                    url: `${appUrl()}/wine/${id}`,
                  },
            );
          },
        );
      }
      if (actor.scopes.includes("wine:read"))
        server.registerTool(
          "wine_get_pairing_context",
          {
            description:
              "보유 와인·잔·시음 기록을 반환합니다. 음식에 맞는 추천은 이 근거로 직접 설명하세요. 재고는 소비 시 다시 확인됩니다.",
            inputSchema: listSchema,
            annotations: { readOnlyHint: true, openWorldHint: false },
          },
          async (input) => {
            const s = await snapshot(actor);
            const all = s.wines.filter(
              (w) =>
                !w.archived &&
                w.stock > 0 &&
                (!input.type || w.type === input.type),
            );
            const wines = all.slice(input.cursor, input.cursor + input.limit);
            return output({
              wines,
              glasses: s.glasses,
              tastings: s.tastings.filter((t) =>
                wines.some((w) => w.id === t.wine_id),
              ),
              as_of: new Date().toISOString(),
              next_cursor:
                input.cursor + input.limit < all.length
                  ? input.cursor + input.limit
                  : null,
            });
          },
        );
      if (actor.scopes.includes("asset:read")) {
        const assetScope = {
          _meta: {
            securitySchemes: [{ type: "oauth2", scopes: ["asset:read"] }],
          },
          annotations: { readOnlyHint: true, openWorldHint: false },
        };
        const view = z.object({
          owner_id: z.uuid().optional(),
          axis: z
            .enum(["group", "parent", "currency", "risk"])
            .default("group"),
          period: z.enum(["month", "year"]).default("month"),
        });
        server.registerTool(
          "asset_get_classification_rules",
          {
            description:
              "증권사 화면의 원본 자산 목록을 자산 그룹으로 나누는 기준을 반환합니다. 그룹 목록·우선순위 규칙·금액 단위·저장 규칙이 함께 들어 있습니다. 자산을 기록하기 전에 먼저 호출하세요.",
            inputSchema: z.object({}),
            ...assetScope,
          },
          async () => output(assetClassificationRules()),
        );
        server.registerTool(
          "asset_classify_rows",
          {
            description:
              "원본 자산 행을 규칙으로만 분류해 돌려줍니다. 규칙은 금융상품과 국내 ETF만 확정합니다. needs_review가 true인 개별 종목은 상장 거래소를 기준으로 직접 판단하세요. 저장은 이 응답이 아니라 원본 행에 group_key를 합쳐 만든 items로 합니다.",
            inputSchema: z.object({
              rows: z
                .array(
                  z
                    .object({
                      name: z.string().trim().min(1).max(200),
                      broker: z.string().trim().max(100).optional(),
                      amount: z
                        .number()
                        .int()
                        .min(0)
                        .max(1000000000000)
                        .optional(),
                    })
                    .strict(),
                )
                .min(1)
                .max(300),
            }),
            ...assetScope,
          },
          async ({ rows }) => {
            const items = rows.map((row) => {
              const result = classifyAsset(row.name);
              return {
                ...row,
                group_key: result.group_key,
                group_name: assetGroupName(result.group_key),
                matched_priority: result.priority,
                needs_review: result.needs_review,
              };
            });
            const totals = new Map<string, number>();
            for (const item of items)
              if (item.amount !== undefined)
                totals.set(
                  item.group_key,
                  (totals.get(item.group_key) ?? 0) + item.amount,
                );
            return output({
              rules_version: assetRulesVersion,
              items,
              needs_review: items.filter((i) => i.needs_review).length,
              // 합계 대조용이다. 저장 단위가 아니므로 lines라는 옛 이름을 쓰지 않는다.
              group_totals_for_check: [...totals]
                .filter(([, amount]) => amount > 0)
                .map(([group_key, amount]) => ({ group_key, amount })),
            });
          },
        );
        server.registerTool(
          "asset_list_owners",
          {
            description:
              "자산 소유자와 각자의 최신 등록일·총액을 조회합니다. asset_record_snapshot에 쓸 owner_id를 여기서 얻습니다.",
            inputSchema: z.object({}),
            ...assetScope,
          },
          async () => {
            const data = await readAssetOverview(actor, {});
            return output({
              owners: data.owners.map((o) => ({
                id: o.id,
                name: o.name,
                active: o.active,
                version: o.version,
                linked_to_me: o.linked,
                latest:
                  data.ownerTotals.find((t) => t.owner_id === o.id) ?? null,
              })),
              url: `${appUrl()}/assets/status`,
            });
          },
        );
        server.registerTool(
          "asset_get_summary",
          {
            description:
              "최신 기간의 자산 구성과 직전 기간 대비 증감을 조회합니다. owner_id를 생략하면 활성 소유자 전체 합계입니다. axis로 자산그룹·상위그룹·통화·위험 기준을 고릅니다.",
            inputSchema: view,
            ...assetScope,
          },
          async ({ owner_id, axis, period }) => {
            const data = await readAssetOverview(actor, {
              owner: owner_id,
              period,
            });
            return output({
              axis,
              period: data.period,
              scope: owner_id ? "owner" : "all",
              summary: data.summaries[axis],
              cagr: data.cagr,
              currency_mix: data.currencyMix,
              owners: data.ownerTotals,
              unclassified: data.unclassified,
              rules_version: data.rules_version,
              url: `${appUrl()}/assets/status`,
            });
          },
        );
        server.registerTool(
          "asset_list_snapshots",
          {
            description:
              "자산 시계열을 조회합니다. 기간에 기록이 여러 건이면 그 기간의 최신 기록을 쓰고, 기록이 없는 소유자는 직전 기록을 이어 씁니다. carried에 그런 소유자가 들어갑니다.",
            inputSchema: view.extend({
              from: z.iso.date().optional(),
              to: z.iso.date().optional(),
            }),
            ...assetScope,
          },
          async ({ owner_id, axis, period, from, to }) => {
            const data = await readAssetOverview(actor, {
              owner: owner_id,
              period,
              from,
              to,
            });
            return output({
              axis,
              period: data.period,
              points: data.timelines[axis],
            });
          },
        );
        server.registerTool(
          "asset_list_items",
          {
            description:
              "어떤 기간의 한 묶음에 실제로 어떤 종목이 들어 있는지 조회합니다. at은 월이면 YYYY-MM, 연이면 YYYY입니다. bucket을 생략하면 그 기간 전체 항목을 돌려줍니다.",
            inputSchema: view.extend({
              at: z.string().regex(/^\d{4}(-\d{2})?$/),
              bucket: z.string().max(60).optional(),
            }),
            ...assetScope,
          },
          async ({ owner_id, axis, period, at, bucket }) =>
            output(
              await readAssetItems(actor, {
                owner: owner_id,
                period,
                axis,
                at,
                bucket,
              }),
            ),
        );
        server.registerTool(
          "asset_list_records",
          {
            description:
              "등록 이력과 한 등록 건의 원본 항목 전체를 조회합니다. snapshot을 생략하면 가장 최근 등록 건을 폅니다.",
            inputSchema: z.object({ snapshot: z.uuid().optional() }),
            ...assetScope,
          },
          async ({ snapshot }) =>
            output(await readAssetHistory(actor, { snapshot })),
        );
      }
      server.registerTool(
        "household_get_summary",
        {
          description: "권한 있는 도메인의 현재 집계를 반환합니다.",
          inputSchema: z.object({}),
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async () => {
          const s = await snapshot(actor);
          return output({
            ...(actor.scopes.includes("coffee:read")
              ? { coffee_beans: s.beans.filter((b) => !b.archived).length }
              : {}),
            ...(actor.scopes.includes("wine:read")
              ? { wine_bottles: s.wines.reduce((n, w) => n + w.stock, 0) }
              : {}),
            ...(actor.scopes.includes("asset:read")
              ? await (async () => {
                  const a = await readAssetOverview(actor, {});
                  return {
                    asset_total: a.summaries.group?.total ?? 0,
                    asset_as_of: a.summaries.group?.as_of ?? null,
                  };
                })()
              : {}),
          });
        },
      );
    },
    {
      serverInfo: { name: "daily-cellar", version: "0.1.0" },
      maxSubscriptions: 0,
    },
  );
}

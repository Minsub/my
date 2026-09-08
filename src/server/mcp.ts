import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { commandSchemas, listSchema, type Operation } from "@/lib/contracts";
import { snapshot, execute } from "./service";
import { AppError } from "./security";
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
};
export function mcpHandler(actor: Actor) {
  return createMcpHandler(
    (server) => {
      for (const [operation, schema] of Object.entries(commandSchemas)) {
        if (operation.startsWith("family_") || operation === "archive_item")
          continue;
        const scope: Scope = operation.startsWith("coffee_")
          ? "coffee:write"
          : "wine:write";
        if (!actor.scopes.includes(scope)) continue;
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
                operation === "wine_reverse_event",
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
            inputSchema: listSchema,
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
            if (input.query)
              rows = rows.filter((r) =>
                String(r.name)
                  .toLowerCase()
                  .includes(input.query!.toLowerCase()),
              );
            if (input.type) rows = rows.filter((r) => r.type === input.type);
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
                    ...item,
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

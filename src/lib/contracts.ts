import { z } from "zod";
import { today } from "./format";
import { assetGroupKeys } from "./assets";
import type { Scope } from "./types";
const id = z.uuid();
const text = z.string().trim().max(5000);
const name = z.string().trim().min(1).max(200);
const date = z.iso.date().default(today);
const version = z.number().int().positive();
const amount = z.number().int().min(0).max(100000000).nullable();
// 자산 금액은 원화 환산 정수다. 원두 가격용 amount(1억)를 재사용할 수 없다.
const krwAmount = z.number().int().min(0).max(1000000000000);
const assetGroupKey = z.enum(assetGroupKeys);
const ownerName = z.string().trim().min(1).max(40);
const url = z.union([
  z.literal(""),
  z
    .url()
    .max(2000)
    .refine(
      (v) => new URL(v).protocol === "https:",
      "HTTPS 링크만 사용할 수 있습니다.",
    ),
]);
const key = { idempotency_key: id };
const bean = {
  brand_id: id,
  name,
  product_url: url.default(""),
  image_url: url.nullable().default(null),
  roast: z.enum(["약배전", "중배전", "강배전"]).nullable().default(null),
  flavor: text.default(""),
  price: amount.default(null),
  weight_g: z.number().int().positive().max(100000).nullable().default(null),
};
const wine = {
  name,
  english_name: text.default(""),
  producer: text.default(""),
  type: z.enum(["레드", "화이트", "로제", "스파클링", "디저트", "주정강화"]),
  country: text.default(""),
  region: text.default(""),
  grapes: text.default(""),
  vintage_kind: z.enum(["year", "non_vintage", "unknown"]).default("unknown"),
  vintage: z.number().int().min(1800).max(2200).nullable().default(null),
  volume_ml: z.number().int().positive().max(100000).nullable().default(null),
};
const tasting = {
  score: z.number().int().min(0).max(100).nullable().default(null),
  note: text.default(""),
  repurchase: z.boolean().nullable().default(null),
  tasted_on: date,
};
export const commandSchemas = {
  coffee_create_brand: z
    .object({
      ...key,
      name,
      url: url.default(""),
      description: text.default(""),
    })
    .strict(),
  coffee_update_brand: z
    .object({
      ...key,
      id,
      expected_version: version,
      name,
      url: url.default(""),
      description: text.default(""),
    })
    .strict(),
  coffee_create_bean: z.object({ ...key, ...bean }).strict(),
  coffee_update_bean: z
    .object({ ...key, id, expected_version: version, ...bean })
    .strict(),
  coffee_save_preference: z
    .object({
      ...key,
      bean_id: id,
      expected_version: version.nullable(),
      status: z.enum(["구매예정", "먹어봄"]).nullable(),
      recommendation: z.enum(["추천", "보통", "비추천"]).nullable(),
      note: text.default(""),
    })
    .strict(),
  coffee_log_brew_setting: z
    .object({
      ...key,
      bean_id: id,
      grind: z.number().min(0).max(1000),
      dose: z.number().min(0).max(1000),
      note: text.default(""),
    })
    .strict(),
  wine_create: z.object({ ...key, ...wine }).strict(),
  wine_update: z
    .object({ ...key, id, expected_version: version, ...wine })
    .strict(),
  wine_receive_stock: z
    .object({
      ...key,
      wine_id: id,
      quantity: z.number().int().min(1).max(1000),
      unit_price: amount.default(null),
      purchased_on: date,
      store: text.default(""),
    })
    .strict(),
  // 입고한 병의 가격만 고친다. 수량·구매일은 재고 이벤트와 묶여 있어 바꾸지 않는다.
  // purchase_id가 없으면 구매 내역이 없는 이관 와인의 참고 가격(reference_price)을 고친다.
  // expected_version은 와인 version이며, 수정하면 와인 version이 올라간다.
  wine_update_price: z
    .object({
      ...key,
      wine_id: id,
      expected_version: version,
      purchase_id: id.optional(),
      unit_price: amount,
    })
    .strict(),
  wine_consume: z
    .object({
      ...key,
      wine_id: id,
      quantity: z.number().int().min(1).max(1000).default(1),
      occurred_on: date,
      tasting: z.object(tasting).optional(),
    })
    .strict(),
  wine_log_tasting: z.object({ ...key, wine_id: id, ...tasting }).strict(),
  wine_reverse_event: z.object({ ...key, event_id: id, reason: name }).strict(),
  wine_save_glass: z
    .object({
      ...key,
      id: id.optional(),
      expected_version: version.optional(),
      name,
      brand: text.default(""),
      type: name,
      note: text.default(""),
    })
    .strict(),
  archive_item: z
    .object({
      ...key,
      domain: z.enum(["coffee", "wine"]),
      id,
      expected_version: version,
      archived: z.boolean(),
    })
    .strict(),
  asset_save_owner: z
    .object({
      ...key,
      id: id.optional(),
      expected_version: version.optional(),
      name: ownerName,
      // 사용자 ID를 인자로 받지 않는다. 연결은 인증된 본인 계정으로만 한다.
      // 생략하면 기존 연결을 유지하고, true는 내 계정 연결, false는 연결 해제다.
      link_to_me: z.boolean().optional(),
      sort_order: z.number().int().min(0).max(999).default(0),
      active: z.boolean().default(true),
    })
    .strict(),
  asset_record_snapshot: z
    .object({
      ...key,
      owner_id: id.optional(),
      owner_name: ownerName.optional(),
      as_of: date,
      // 기존 기록을 덮어쓸 때만 필요하다. 값을 주면 다른 곳에서 바뀐 경우 거부한다.
      expected_version: version.nullable().default(null),
      rules_version: z.string().trim().max(40).default(""),
      note: text.default(""),
      // 그룹 합계가 아니라 원본 항목을 그대로 보낸다. 같은 이름이 여러 번 나올 수 있다.
      items: z
        .array(
          z
            .object({
              group_key: assetGroupKey,
              name: z.string().trim().min(1).max(200),
              broker: z.string().trim().max(100).default(""),
              amount: krwAmount,
              quantity: z
                .number()
                .nonnegative()
                .max(1e12)
                .nullable()
                .default(null),
              profit: z
                .number()
                .int()
                .min(-1000000000000)
                .max(1000000000000)
                .nullable()
                .default(null),
              // 비율이다. 1.94%는 0.0194로 보낸다.
              profit_rate: z
                .number()
                .min(-1)
                .max(1000)
                .nullable()
                .default(null),
            })
            .strict(),
        )
        .min(1)
        .max(300),
    })
    .strict()
    .refine(
      (d) => Boolean(d.owner_id) !== Boolean(d.owner_name),
      "소유자를 owner_id 또는 owner_name 중 하나로 지정해주세요.",
    ),
  // 기록 한 줄만 고친다. 스냅샷을 통째로 다시 보내는 asset_record_snapshot과 달리
  // 나머지 항목은 건드리지 않으므로, 분류를 잘못 넣었거나 금액에 오타가 난 한 줄을 바로잡는 데 쓴다.
  asset_update_item: z
    .object({
      ...key,
      snapshot_id: id,
      item_id: id,
      // 스냅샷 단위 버전이다. 다른 곳에서 그 날짜를 다시 저장했으면 거부한다.
      expected_version: version,
      group_key: assetGroupKey.optional(),
      // 0원 항목은 저장하지 않는 규칙이라 여기서도 0으로 내릴 수 없다.
      // 그 줄을 없애려면 그 날짜를 다시 기록한다.
      amount: krwAmount.min(1).optional(),
    })
    .strict()
    .refine(
      (d) => d.group_key !== undefined || d.amount !== undefined,
      "바꿀 값을 하나 이상 보내주세요.",
    ),
  asset_delete_snapshot: z.object({ ...key, id }).strict(),
  family_invite: z
    .object({
      ...key,
      email: z.email().transform((v) => v.toLowerCase()),
      role: z.enum(["owner", "member"]).default("member"),
    })
    .strict(),
  family_remove: z
    .object({ ...key, user_id: z.string().min(1).max(200) })
    .strict(),
  family_cancel_invite: z.object({ ...key, id }).strict(),
};
export type Operation = keyof typeof commandSchemas;
// 접두사로 scope를 추론하면 새 도메인이 조용히 다른 도메인 권한에 실려 나간다.
// Record<Operation, ...>이므로 명령을 추가하고 여기에 넣지 않으면 타입 검사가 실패한다.
// null은 scope가 아닌 다른 규칙으로 막는 명령이다(가족 관리는 웹 관리자, 보관은 domain별 write).
export const commandScopes: Record<Operation, Scope | null> = {
  coffee_create_brand: "coffee:write",
  coffee_update_brand: "coffee:write",
  coffee_create_bean: "coffee:write",
  coffee_update_bean: "coffee:write",
  coffee_save_preference: "coffee:write",
  coffee_log_brew_setting: "coffee:write",
  wine_create: "wine:write",
  wine_update: "wine:write",
  wine_receive_stock: "wine:write",
  wine_update_price: "wine:write",
  wine_consume: "wine:write",
  wine_log_tasting: "wine:write",
  wine_reverse_event: "wine:write",
  wine_save_glass: "wine:write",
  asset_save_owner: "asset:write",
  asset_record_snapshot: "asset:write",
  asset_update_item: "asset:write",
  asset_delete_snapshot: "asset:write",
  archive_item: null,
  family_invite: null,
  family_remove: null,
  family_cancel_invite: null,
};
// MCP 도구로 내보내지 않는 명령. scope는 그대로 두고 노출만 막는다.
// 자산 소유자는 공간 안의 라벨이라 AI가 임의로 만들면 같은 사람이 두 이름으로 갈린다.
// 웹의 "소유자 추가"에서만 만들고, MCP는 없는 이름을 만나면 그 화면을 안내한다.
export const webOnlyCommands = new Set<Operation>(["asset_save_owner"]);
export type Command = {
  [K in Operation]: {
    operation: K;
    input: z.infer<(typeof commandSchemas)[K]>;
  };
}[Operation];
export function parseCommand(operation: string, input: unknown): Command {
  if (!Object.hasOwn(commandSchemas, operation))
    throw new Error("Unknown operation");
  const op = operation as Operation;
  return { operation: op, input: commandSchemas[op].parse(input) } as Command;
}
export const listSchema = z
  .object({
    query: z.string().max(200).optional(),
    cursor: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(100).default(30),
    in_stock: z.boolean().optional(),
    type: z.string().max(50).optional(),
  })
  .strict();

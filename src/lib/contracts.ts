import { z } from "zod";
import { today } from "./format";
const id = z.uuid();
const text = z.string().trim().max(5000);
const name = z.string().trim().min(1).max(200);
const date = z.iso.date().default(today);
const version = z.number().int().positive();
const amount = z.number().int().min(0).max(100000000).nullable();
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
  coffee_create_machine: z.object({ ...key, name }).strict(),
  coffee_log_brew_setting: z
    .object({
      ...key,
      bean_id: id,
      machine_id: id,
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

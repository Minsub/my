import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { query, transaction } from "./db";
import { AppError, requireScope } from "./security";
import { parseCommand, type Operation } from "@/lib/contracts";
import type { Actor, Snapshot } from "@/lib/types";
const tables = {
  brand: "coffee_brands",
  bean: "coffee_beans",
  machine: "coffee_machines",
  wine: "wines",
  glass: "wine_glasses",
} as const;
async function record(
  client: PoolClient,
  actor: Actor,
  kind: keyof typeof tables,
  id: string,
) {
  const [row] = await query(
    `SELECT * FROM ${tables[kind]} WHERE household_id=$1 AND id=$2 FOR UPDATE`,
    [actor.householdId, id],
    client,
  );
  if (!row) throw new AppError("NOT_FOUND", "항목을 찾을 수 없습니다.", 404);
  return row;
}
function canEdit(
  actor: Actor,
  row: { created_by?: string | null; version?: number },
  version?: number,
) {
  if (actor.role !== "owner" && row.created_by !== actor.userId)
    throw new AppError(
      "FORBIDDEN",
      "작성자 또는 가족 관리자만 수정할 수 있습니다.",
      403,
    );
  if (version !== undefined && row.version !== version)
    throw new AppError(
      "VERSION_CONFLICT",
      "다른 곳에서 변경되었습니다. 새로고침 후 다시 시도해주세요.",
      409,
    );
}
function validWine(input: { vintage_kind: string; vintage: number | null }) {
  if ((input.vintage_kind === "year") !== (input.vintage !== null))
    throw new AppError("INVALID_INPUT", "빈티지 연도와 구분을 확인해주세요.");
}
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  return (
    "{" +
    Object.keys(value)
      .sort()
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          stable((value as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}
async function stock(client: PoolClient, actor: Actor, wineId: string) {
  const [row] = await query(
    "SELECT COALESCE(sum(delta),0)::int AS stock FROM wine_stock_events WHERE household_id=$1 AND wine_id=$2",
    [actor.householdId, wineId],
    client,
  );
  return row.stock as number;
}
async function addTasting(
  client: PoolClient,
  actor: Actor,
  wineId: string,
  input: {
    score: number | null;
    note: string;
    repurchase: boolean | null;
    tasted_on: string;
  },
  eventId: string | null = null,
) {
  const [row] = await query(
    "INSERT INTO wine_tastings(household_id,wine_id,user_id,tasted_on,score,note,repurchase,event_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    [
      actor.householdId,
      wineId,
      actor.userId,
      input.tasted_on,
      input.score,
      input.note,
      input.repurchase,
      eventId,
    ],
    client,
  );
  return row;
}
export async function execute(
  actor: Actor,
  operation: Operation,
  raw: unknown,
) {
  const command = parseCommand(operation, raw);
  if (operation.startsWith("coffee_")) requireScope(actor, "coffee:write");
  if (operation.startsWith("wine_")) requireScope(actor, "wine:write");
  if (
    operation.startsWith("family_") &&
    (actor.role !== "owner" || actor.channel !== "web")
  )
    throw new AppError("FORBIDDEN", "가족 관리자만 변경할 수 있습니다.", 403);
  if (command.operation === "archive_item")
    requireScope(actor, `${command.input.domain}:write`);
  const hash = createHash("sha256").update(stable(command.input)).digest("hex");
  return transaction(async (client) => {
    const [membership] = await query(
      "SELECT role FROM household_members WHERE household_id=$1 AND user_id=$2 AND active=true FOR SHARE",
      [actor.householdId, actor.userId],
      client,
    );
    if (!membership || membership.role !== actor.role)
      throw new AppError("FORBIDDEN", "가족 권한이 변경되었습니다.", 403);
    const keys = [
      actor.householdId,
      actor.userId,
      operation,
      command.input.idempotency_key,
    ];
    const reserved = await query(
      "INSERT INTO mutation_requests(household_id,user_id,operation,request_key,input_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING request_key",
      [...keys, hash],
      client,
    );
    if (!reserved.length) {
      const [prior] = await query(
        "SELECT input_hash,result FROM mutation_requests WHERE household_id=$1 AND user_id=$2 AND operation=$3 AND request_key=$4",
        keys,
        client,
      );
      if (prior.input_hash !== hash)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "같은 요청 키에 다른 내용이 전달되었습니다.",
          409,
        );
      return prior.result as Record<string, unknown>;
    }
    let result: Record<string, unknown> = {};
    let label = "기록 변경";
    switch (command.operation) {
      case "coffee_create_brand": {
        const d = command.input;
        [result] = await query(
          "INSERT INTO coffee_brands(household_id,name,url,description,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *",
          [actor.householdId, d.name, d.url, d.description, actor.userId],
          client,
        );
        label = d.name;
        break;
      }
      case "coffee_update_brand": {
        const d = command.input;
        canEdit(
          actor,
          await record(client, actor, "brand", d.id),
          d.expected_version,
        );
        [result] = await query(
          "UPDATE coffee_brands SET name=$3,url=$4,description=$5,version=version+1 WHERE household_id=$1 AND id=$2 RETURNING *",
          [actor.householdId, d.id, d.name, d.url, d.description],
          client,
        );
        label = d.name;
        break;
      }
      case "coffee_create_bean":
      case "coffee_update_bean": {
        const d = command.input;
        await record(client, actor, "brand", d.brand_id);
        if (command.operation === "coffee_update_bean") {
          const u = command.input;
          canEdit(
            actor,
            await record(client, actor, "bean", u.id),
            u.expected_version,
          );
          [result] = await query(
            "UPDATE coffee_beans SET brand_id=$3,name=$4,product_url=$5,image_url=$6,roast=$7,flavor=$8,price=$9,weight_g=$10,version=version+1 WHERE household_id=$1 AND id=$2 RETURNING *",
            [
              actor.householdId,
              u.id,
              d.brand_id,
              d.name,
              d.product_url,
              d.image_url,
              d.roast,
              d.flavor,
              d.price,
              d.weight_g,
            ],
            client,
          );
        } else
          [result] = await query(
            "INSERT INTO coffee_beans(household_id,brand_id,name,product_url,image_url,roast,flavor,price,weight_g,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *",
            [
              actor.householdId,
              d.brand_id,
              d.name,
              d.product_url,
              d.image_url,
              d.roast,
              d.flavor,
              d.price,
              d.weight_g,
              actor.userId,
            ],
            client,
          );
        label = d.name;
        break;
      }
      case "coffee_save_preference": {
        const d = command.input;
        const bean = await record(client, actor, "bean", d.bean_id);
        const [old] = await query(
          "SELECT * FROM coffee_preferences WHERE household_id=$1 AND bean_id=$2 AND user_id=$3",
          [actor.householdId, d.bean_id, actor.userId],
          client,
        );
        if ((old?.version ?? null) !== d.expected_version)
          throw new AppError(
            "VERSION_CONFLICT",
            "평가가 변경되었습니다. 새로고침해주세요.",
            409,
          );
        [result] = await query(
          "INSERT INTO coffee_preferences(household_id,bean_id,user_id,status,recommendation,note) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(household_id,bean_id,user_id) DO UPDATE SET status=EXCLUDED.status,recommendation=EXCLUDED.recommendation,note=EXCLUDED.note,version=coffee_preferences.version+1 RETURNING *",
          [
            actor.householdId,
            d.bean_id,
            actor.userId,
            d.status,
            d.recommendation,
            d.note,
          ],
          client,
        );
        label = bean.name;
        break;
      }
      case "coffee_create_machine": {
        const d = command.input;
        [result] = await query(
          "INSERT INTO coffee_machines(household_id,name) VALUES($1,$2) RETURNING *",
          [actor.householdId, d.name],
          client,
        );
        label = d.name;
        break;
      }
      case "coffee_log_brew_setting": {
        const d = command.input;
        const bean = await record(client, actor, "bean", d.bean_id);
        await record(client, actor, "machine", d.machine_id);
        [result] = await query(
          "INSERT INTO coffee_brew_settings(household_id,bean_id,user_id,machine_id,grind,dose,note) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
          [
            actor.householdId,
            d.bean_id,
            actor.userId,
            d.machine_id,
            d.grind,
            d.dose,
            d.note,
          ],
          client,
        );
        label = bean.name;
        break;
      }
      case "wine_create":
      case "wine_update": {
        const d = command.input;
        validWine(d);
        if (command.operation === "wine_update") {
          const u = command.input;
          canEdit(
            actor,
            await record(client, actor, "wine", u.id),
            u.expected_version,
          );
          [result] = await query(
            "UPDATE wines SET name=$3,english_name=$4,producer=$5,type=$6,country=$7,region=$8,grapes=$9,vintage_kind=$10,vintage=$11,volume_ml=$12,version=version+1 WHERE household_id=$1 AND id=$2 RETURNING *",
            [
              actor.householdId,
              u.id,
              d.name,
              d.english_name,
              d.producer,
              d.type,
              d.country,
              d.region,
              d.grapes,
              d.vintage_kind,
              d.vintage,
              d.volume_ml,
            ],
            client,
          );
        } else
          [result] = await query(
            "INSERT INTO wines(household_id,name,english_name,producer,type,country,region,grapes,vintage_kind,vintage,volume_ml,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *",
            [
              actor.householdId,
              d.name,
              d.english_name,
              d.producer,
              d.type,
              d.country,
              d.region,
              d.grapes,
              d.vintage_kind,
              d.vintage,
              d.volume_ml,
              actor.userId,
            ],
            client,
          );
        label = d.name;
        break;
      }
      case "wine_receive_stock": {
        const d = command.input;
        const wine = await record(client, actor, "wine", d.wine_id);
        if (wine.archived)
          throw new AppError("ARCHIVED", "보관 해제 후 입고해주세요.");
        const [p] = await query(
          "INSERT INTO wine_purchases(household_id,wine_id,quantity,unit_price,purchased_on,store) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
          [
            actor.householdId,
            d.wine_id,
            d.quantity,
            d.unit_price,
            d.purchased_on,
            d.store,
          ],
          client,
        );
        const [event] = await query(
          "INSERT INTO wine_stock_events(household_id,wine_id,kind,delta,occurred_on,created_by,purchase_id) VALUES($1,$2,'receive',$3,$4,$5,$6) RETURNING *",
          [
            actor.householdId,
            d.wine_id,
            d.quantity,
            d.purchased_on,
            actor.userId,
            p.id,
          ],
          client,
        );
        result = {
          purchase: p,
          event,
          stock: await stock(client, actor, d.wine_id),
        };
        label = wine.name;
        break;
      }
      case "wine_consume": {
        const d = command.input;
        const wine = await record(client, actor, "wine", d.wine_id);
        const before = await stock(client, actor, d.wine_id);
        if (before < d.quantity)
          throw new AppError(
            "INSUFFICIENT_STOCK",
            `현재 ${before}병 보유 중입니다.`,
            409,
          );
        const [event] = await query(
          "INSERT INTO wine_stock_events(household_id,wine_id,kind,delta,occurred_on,created_by) VALUES($1,$2,'consume',$3,$4,$5) RETURNING *",
          [
            actor.householdId,
            d.wine_id,
            -d.quantity,
            d.occurred_on,
            actor.userId,
          ],
          client,
        );
        const tasting = d.tasting
          ? await addTasting(client, actor, d.wine_id, d.tasting, event.id)
          : null;
        result = { event, tasting, stock: before - d.quantity };
        label = wine.name;
        break;
      }
      case "wine_log_tasting": {
        const d = command.input;
        const wine = await record(client, actor, "wine", d.wine_id);
        result = await addTasting(client, actor, d.wine_id, d);
        label = wine.name;
        break;
      }
      case "wine_reverse_event": {
        const d = command.input;
        const [event] = await query(
          "SELECT * FROM wine_stock_events WHERE household_id=$1 AND id=$2",
          [actor.householdId, d.event_id],
          client,
        );
        if (!event)
          throw new AppError("NOT_FOUND", "기록을 찾을 수 없습니다.", 404);
        canEdit(actor, event);
        const wine = await record(client, actor, "wine", event.wine_id);
        if (event.kind === "reverse" || event.kind === "opening_balance")
          throw new AppError("INVALID_INPUT", "이 기록은 취소할 수 없습니다.");
        const before = await stock(client, actor, event.wine_id);
        if (before - event.delta < 0)
          throw new AppError(
            "INSUFFICIENT_STOCK",
            "입고 취소에 필요한 재고가 부족합니다.",
            409,
          );
        [result] = await query(
          "INSERT INTO wine_stock_events(household_id,wine_id,kind,delta,created_by,reverses_id,reason) VALUES($1,$2,'reverse',$3,$4,$5,$6) RETURNING *",
          [
            actor.householdId,
            event.wine_id,
            -event.delta,
            actor.userId,
            event.id,
            d.reason,
          ],
          client,
        );
        label = wine.name;
        break;
      }
      case "wine_save_glass": {
        const d = command.input;
        if (d.id) {
          if (!d.expected_version)
            throw new AppError("INVALID_INPUT", "버전이 필요합니다.");
          canEdit(
            actor,
            await record(client, actor, "glass", d.id),
            d.expected_version,
          );
          [result] = await query(
            "UPDATE wine_glasses SET name=$3,brand=$4,type=$5,note=$6,version=version+1 WHERE household_id=$1 AND id=$2 RETURNING *",
            [actor.householdId, d.id, d.name, d.brand, d.type, d.note],
            client,
          );
        } else
          [result] = await query(
            "INSERT INTO wine_glasses(household_id,name,brand,type,note,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
            [actor.householdId, d.name, d.brand, d.type, d.note, actor.userId],
            client,
          );
        label = d.name;
        break;
      }
      case "archive_item": {
        const d = command.input;
        const kind = d.domain === "coffee" ? "bean" : "wine";
        const row = await record(client, actor, kind, d.id);
        canEdit(actor, row, d.expected_version);
        if (
          d.domain === "wine" &&
          d.archived &&
          (await stock(client, actor, d.id)) > 0
        )
          throw new AppError(
            "IN_STOCK",
            "재고가 있는 와인은 보관할 수 없습니다.",
          );
        [result] = await query(
          `UPDATE ${tables[kind]} SET archived=$3,version=version+1 WHERE household_id=$1 AND id=$2 RETURNING *`,
          [actor.householdId, d.id, d.archived],
          client,
        );
        label = row.name;
        break;
      }
      case "family_invite": {
        const d = command.input;
        [result] = await query(
          "INSERT INTO household_invites(household_id,email,role) VALUES($1,$2,$3) ON CONFLICT(household_id,email) DO UPDATE SET role=EXCLUDED.role,active=true RETURNING *",
          [actor.householdId, d.email, d.role],
          client,
        );
        label = "가족 초대";
        break;
      }
      case "family_remove": {
        const d = command.input;
        if (d.user_id === actor.userId)
          throw new AppError(
            "INVALID_INPUT",
            "자신의 접근 권한은 해제할 수 없습니다.",
          );
        const [target] = await query(
          'SELECT m.*,u.email FROM household_members m JOIN "user" u ON u.id=m.user_id WHERE m.household_id=$1 AND m.user_id=$2 FOR UPDATE OF m',
          [actor.householdId, d.user_id],
          client,
        );
        if (!target)
          throw new AppError("NOT_FOUND", "가족을 찾을 수 없습니다.", 404);
        if (target.role === "owner")
          throw new AppError(
            "FORBIDDEN",
            "관리자 해제는 운영자가 처리해야 합니다.",
            403,
          );
        await query(
          "UPDATE household_members SET active=false WHERE household_id=$1 AND user_id=$2",
          [actor.householdId, d.user_id],
          client,
        );
        await query(
          "UPDATE household_invites SET active=false WHERE household_id=$1 AND email=$2",
          [actor.householdId, target.email],
          client,
        );
        await query(
          'DELETE FROM session WHERE "userId"=$1',
          [d.user_id],
          client,
        );
        result = { removed: true };
        label = "가족 접근 해제";
        break;
      }
      case "family_cancel_invite": {
        const d = command.input;
        const rows = await query(
          "UPDATE household_invites SET active=false WHERE household_id=$1 AND id=$2 RETURNING id",
          [actor.householdId, d.id],
          client,
        );
        if (!rows.length)
          throw new AppError("NOT_FOUND", "초대를 찾을 수 없습니다.", 404);
        result = { cancelled: true };
        label = "초대 취소";
        break;
      }
    }
    await query(
      "INSERT INTO activity_log(household_id,user_id,operation,channel,client_id,label) VALUES($1,$2,$3,$4,$5,$6)",
      [
        actor.householdId,
        actor.userId,
        operation,
        actor.channel,
        actor.clientId ?? null,
        label,
      ],
      client,
    );
    await query(
      "UPDATE mutation_requests SET result=$5::jsonb WHERE household_id=$1 AND user_id=$2 AND operation=$3 AND request_key=$4",
      [...keys, JSON.stringify(result)],
      client,
    );
    return JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
  });
}
export async function snapshot(actor: Actor): Promise<Snapshot> {
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const [member] = await query(
      'SELECT m.role,u.name FROM household_members m JOIN "user" u ON u.id=m.user_id WHERE household_id=$1 AND user_id=$2 AND active=true',
      [actor.householdId, actor.userId],
      client,
    );
    if (!member)
      throw new AppError("FORBIDDEN", "가족 접근 권한이 없습니다.", 403);
    const [household] = await query(
      "SELECT id,name FROM households WHERE id=$1",
      [actor.householdId],
      client,
    );
    const read = (table: string, order = "id") =>
      query(
        `SELECT * FROM ${table} WHERE household_id=$1 ORDER BY ${order}`,
        [actor.householdId],
        client,
      );
    const coffee = actor.scopes.includes("coffee:read"),
      wine = actor.scopes.includes("wine:read");
    const data = {
      household,
      user: { id: actor.userId, name: member.name, role: member.role },
      brands: coffee ? await read("coffee_brands", "name") : [],
      beans: coffee ? await read("coffee_beans", "created_at DESC,id") : [],
      preferences: coffee ? await read("coffee_preferences") : [],
      machines: coffee ? await read("coffee_machines", "name") : [],
      brews: coffee
        ? await read("coffee_brew_settings", "created_at DESC,id")
        : [],
      wines: wine
        ? await query(
            "SELECT w.*,EXISTS(SELECT 1 FROM wine_photos ph WHERE ph.wine_id=w.id) AS has_photo,w.display_id::int,COALESCE(s.stock,0)::int AS stock FROM wines w LEFT JOIN (SELECT wine_id,sum(delta) stock FROM wine_stock_events WHERE household_id=$1 GROUP BY wine_id) s ON s.wine_id=w.id WHERE w.household_id=$1 ORDER BY w.display_id DESC",
            [actor.householdId],
            client,
          )
        : [],
      events: wine ? await read("wine_stock_events", "created_at DESC,id") : [],
      purchases: wine
        ? await read("wine_purchases", "purchased_on DESC,id")
        : [],
      tastings: wine ? await read("wine_tastings", "tasted_on DESC,id") : [],
      glasses: wine ? await read("wine_glasses", "name") : [],
      members:
        actor.channel === "web"
          ? await query(
              'SELECT m.user_id,u.name,m.role,m.active FROM household_members m JOIN "user" u ON u.id=m.user_id WHERE household_id=$1',
              [actor.householdId],
              client,
            )
          : [],
      invites:
        actor.channel === "web" && actor.role === "owner"
          ? await read("household_invites")
          : [],
      activities:
        actor.channel === "web"
          ? await query(
              "SELECT id,operation,user_id,channel,created_at,label FROM activity_log WHERE household_id=$1 ORDER BY created_at DESC LIMIT 30",
              [actor.householdId],
              client,
            )
          : [],
    };
    return JSON.parse(JSON.stringify(data)) as Snapshot;
  });
}

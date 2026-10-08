import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { query, transaction } from "./db";
import { AppError, requireScope } from "./security";
import type { commandSchemas } from "@/lib/contracts";
import {
  WINE_SHARE_DAYS,
  priceBandLabel,
  wineFacts,
  type PublicShare,
  type WineShareSummary,
} from "@/lib/wine-cellar";
import type { Actor, Purchase, StockEvent, Wine } from "@/lib/types";
// 와인 목록 공유. 만들기·끄기는 execute(웹 전용 명령)를 거치고, 공개 쪽은 토큰만으로 읽고 고른다.
// 공개 쪽은 Actor가 없으므로 모든 조회에 공유 행의 household_id와 wine_ids를 함께 건다.
type CreateInput = z.infer<(typeof commandSchemas)["wine_share_create"]>;
// 32자 base64url(192bit). 추측해서 맞힐 수 없는 길이다.
const tokenPattern = /^[A-Za-z0-9_-]{32}$/;
export const validShareToken = (token: string) => tokenPattern.test(token);
const shareActive = "revoked_at IS NULL AND expires_at > now()";
export async function createWineShare(
  client: PoolClient,
  actor: Actor,
  d: CreateInput,
) {
  const found = await query<{ id: string }>(
    "SELECT id FROM wines WHERE household_id=$1 AND id=ANY($2::uuid[])",
    [actor.householdId, d.wine_ids],
    client,
  );
  if (found.length !== d.wine_ids.length)
    throw new AppError("NOT_FOUND", "공유할 와인을 찾을 수 없습니다.", 404);
  const [row] = await query(
    `INSERT INTO wine_shares(household_id,token,title,note,wine_ids,price_display,max_picks,show_results,created_by,expires_at)
     VALUES($1,$2,$3,$4,$5::uuid[],$6,$7,$8,$9,now()+make_interval(days=>$10)) RETURNING *`,
    [
      actor.householdId,
      randomBytes(24).toString("base64url"),
      d.title,
      d.note,
      d.wine_ids,
      d.price_display,
      d.max_picks,
      d.show_results,
      actor.userId,
      WINE_SHARE_DAYS,
    ],
    client,
  );
  return row;
}
export async function revokeWineShare(
  client: PoolClient,
  actor: Actor,
  id: string,
) {
  const [share] = await query(
    "SELECT * FROM wine_shares WHERE household_id=$1 AND id=$2 FOR UPDATE",
    [actor.householdId, id],
    client,
  );
  if (!share) throw new AppError("NOT_FOUND", "공유를 찾을 수 없습니다.", 404);
  if (actor.role !== "owner" && share.created_by !== actor.userId)
    throw new AppError(
      "FORBIDDEN",
      "만든 사람 또는 관리자만 끌 수 있습니다.",
      403,
    );
  const [row] = await query(
    "UPDATE wine_shares SET revoked_at=COALESCE(revoked_at,now()) WHERE household_id=$1 AND id=$2 RETURNING *",
    [actor.householdId, id],
    client,
  );
  return row;
}
// 셀러의 "공유한 목록" 화면. 같은 공간의 공유와 받은 선택을 모두 돌려준다.
export async function listWineShares(actor: Actor) {
  requireScope(actor, "wine:read");
  if (actor.channel !== "web")
    throw new AppError("FORBIDDEN", "웹 화면에서만 볼 수 있습니다.", 403);
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const shares = await query(
      `SELECT s.id,s.token,s.title,s.note,s.wine_ids,s.price_display,s.max_picks,s.show_results,
        s.created_by,u.name AS created_by_name,s.created_at,s.expires_at,s.revoked_at,
        (s.revoked_at IS NULL AND s.expires_at > now()) AS active
       FROM wine_shares s LEFT JOIN "user" u ON u.id=s.created_by
       WHERE s.household_id=$1 ORDER BY s.created_at DESC LIMIT 100`,
      [actor.householdId],
      client,
    );
    const votes = await query(
      `SELECT share_id,name,picks,comment,updated_at FROM wine_share_votes
       WHERE household_id=$1 AND share_id=ANY($2::uuid[]) ORDER BY updated_at DESC`,
      [actor.householdId, shares.map((s) => s.id)],
      client,
    );
    return JSON.parse(
      JSON.stringify(
        shares.map((s) => ({
          ...s,
          votes: votes.filter((v) => v.share_id === s.id),
        })),
      ),
    ) as WineShareSummary[];
  });
}
async function activeShare(token: string, client?: PoolClient, lock = false) {
  if (!validShareToken(token)) return null;
  const [share] = await query(
    `SELECT * FROM wine_shares WHERE token=$1 AND ${shareActive}${lock ? " FOR UPDATE" : ""}`,
    [token],
    client,
  );
  return share ?? null;
}
async function tally(client: PoolClient, shareId: string) {
  const rows = await query<{ id: string; n: number }>(
    "SELECT pick AS id,count(*)::int AS n FROM wine_share_votes, unnest(picks) AS pick WHERE share_id=$1 GROUP BY pick",
    [shareId],
    client,
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.n]));
}
// 공개 페이지 데이터. 없는 토큰은 null, 끝난 공유는 ended로 구분한다.
export async function publicWineShare(
  token: string,
): Promise<PublicShare | { ended: true } | null> {
  if (!validShareToken(token)) return null;
  return transaction(async (client) => {
    await client.query(
      "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const [share] = await query(
      `SELECT *,(revoked_at IS NULL AND expires_at > now()) AS active FROM wine_shares WHERE token=$1`,
      [token],
      client,
    );
    if (!share) return null;
    if (!share.active) return { ended: true as const };
    const args = [share.household_id, share.wine_ids];
    const wines = await query<Wine>(
      `SELECT w.*,EXISTS(SELECT 1 FROM wine_photos ph WHERE ph.wine_id=w.id) AS has_photo
       FROM wines w WHERE w.household_id=$1 AND w.id=ANY($2::uuid[])`,
      args,
      client,
    );
    // 가격은 셀러와 같은 기준(최근 유효 입고가, 없으면 이관 참고 가격)으로 계산한다.
    const priced = share.price_display !== "none";
    const purchases = priced
      ? await query<Purchase>(
          "SELECT * FROM wine_purchases WHERE household_id=$1 AND wine_id=ANY($2::uuid[])",
          args,
          client,
        )
      : [];
    const events = priced
      ? await query<StockEvent>(
          "SELECT * FROM wine_stock_events WHERE household_id=$1 AND wine_id=ANY($2::uuid[])",
          args,
          client,
        )
      : [];
    const byId = new Map(wines.map((w) => [w.id, w]));
    const [{ voters }] = await query<{ voters: number }>(
      "SELECT count(*)::int AS voters FROM wine_share_votes WHERE share_id=$1",
      [share.id],
      client,
    );
    const list = (share.wine_ids as string[])
      .map((id) => byId.get(id))
      .filter((w): w is Wine => Boolean(w))
      .map((w, i) => {
        const price = priced
          ? wineFacts(
              { ...w, stock: 0 },
              {
                purchases,
                events: JSON.parse(JSON.stringify(events)),
                tastings: [],
              },
            ).price
          : null;
        return {
          id: w.id,
          no: i + 1,
          name: w.name,
          english_name: w.english_name,
          producer: w.producer,
          type: w.type,
          country: w.country,
          region: w.region,
          grapes: w.grapes,
          vintage_kind: w.vintage_kind,
          vintage: w.vintage,
          volume_ml: w.volume_ml,
          photo: w.has_photo
            ? `/api/share/wine/${token}/photo/${w.id}?v=${w.version}`
            : null,
          price:
            price === null
              ? null
              : share.price_display === "band"
                ? priceBandLabel(price)
                : new Intl.NumberFormat("ko-KR").format(price) + "원",
        };
      });
    return {
      title: share.title,
      note: share.note,
      created_at: new Date(share.created_at).toISOString(),
      expires_at: new Date(share.expires_at).toISOString(),
      max_picks: Math.min(share.max_picks, list.length),
      show_results: share.show_results,
      price_display: share.price_display,
      wines: list,
      voters,
      tally: share.show_results ? await tally(client, share.id) : null,
    };
  });
}
// 공유에 들어 있는 와인의 사진만 돌려준다. 다른 와인 id를 넣으면 없는 것과 같다.
export async function publicSharePhoto(token: string, wineId: string) {
  if (!z.uuid().safeParse(wineId).success) return null;
  const share = await activeShare(token);
  if (!share || !(share.wine_ids as string[]).includes(wineId)) return null;
  const [row] = await query(
    "SELECT p.content FROM wine_photos p JOIN wines w ON w.id=p.wine_id WHERE w.household_id=$1 AND w.id=$2",
    [share.household_id, wineId],
  );
  return row ? (row.content as Buffer) : null;
}
// 한 공유에 받는 선택 수 상한. 링크가 퍼져도 표가 끝없이 쌓이지 않게 한다.
const MAX_VOTERS = 100;
export const voteSchema = z
  .object({
    voter_key: z.uuid(),
    name: z.string().trim().min(1).max(30),
    picks: z.array(z.uuid()).min(1).max(10),
    comment: z.string().trim().max(300).default(""),
  })
  .strict();
export async function submitShareVote(token: string, raw: unknown) {
  const d = voteSchema.parse(raw);
  return transaction(async (client) => {
    // 공유 행을 잠가 상한 검사와 저장 사이에 다른 표가 끼어들지 않게 한다.
    const share = await activeShare(token, client, true);
    if (!share)
      throw new AppError("ENDED", "공유가 끝났거나 없는 링크입니다.", 404);
    const ids = share.wine_ids as string[];
    const picks = Array.from(new Set(d.picks));
    if (picks.some((p) => !ids.includes(p)))
      throw new AppError("INVALID_INPUT", "목록에 없는 와인입니다.");
    if (picks.length > share.max_picks)
      throw new AppError(
        "INVALID_INPUT",
        `최대 ${share.max_picks}개까지 고를 수 있습니다.`,
      );
    const [existing] = await query(
      "SELECT 1 FROM wine_share_votes WHERE share_id=$1 AND voter_key=$2",
      [share.id, d.voter_key],
      client,
    );
    if (!existing) {
      const [{ n }] = await query<{ n: number }>(
        "SELECT count(*)::int AS n FROM wine_share_votes WHERE share_id=$1",
        [share.id],
        client,
      );
      if (n >= MAX_VOTERS)
        throw new AppError("FULL", "더 이상 받을 수 없는 공유입니다.", 409);
    }
    await query(
      `INSERT INTO wine_share_votes(household_id,share_id,voter_key,name,picks,comment)
       VALUES($1,$2,$3,$4,$5::uuid[],$6)
       ON CONFLICT(share_id,voter_key) DO UPDATE SET name=EXCLUDED.name,picks=EXCLUDED.picks,comment=EXCLUDED.comment,updated_at=now()`,
      [share.household_id, share.id, d.voter_key, d.name, picks, d.comment],
      client,
    );
    const [{ voters }] = await query<{ voters: number }>(
      "SELECT count(*)::int AS voters FROM wine_share_votes WHERE share_id=$1",
      [share.id],
      client,
    );
    return {
      picks,
      voters,
      tally: share.show_results ? await tally(client, share.id) : null,
    };
  });
}

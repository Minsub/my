-- 분할매수 전략. 자산 소유자마다 월급·현금 두 그룹의 금액과 종목 비중을 남긴다.
-- 연금저축·IRP는 모든 구성원이 같은 고정 전략이라 src/lib/asset-plans.ts의 상수이며 여기 두지 않는다.
CREATE TABLE asset_buy_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES households(id),
 owner_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('salary','cash')),
 -- salary는 매달 투자하는 금액, cash는 나눠서 투자할 총액. 원 단위 정수.
 amount bigint NOT NULL CHECK(amount>=0 AND amount<=1000000000000),
 -- cash만 쓴다. 총액을 몇 달에 나눠 사는지.
 months int CHECK(months BETWEEN 1 AND 120),
 version int NOT NULL DEFAULT 1 CHECK(version>0),
 created_by text NOT NULL REFERENCES "user"(id),
 updated_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(household_id,id), UNIQUE(household_id,owner_id,kind),
 FOREIGN KEY(household_id,owner_id) REFERENCES asset_owners(household_id,id),
 CHECK((kind='cash')=(months IS NOT NULL))
);

-- 종목 비중은 전략을 저장할 때마다 통째로 교체한다. 합계 100%는 contracts.ts가 검증한다.
CREATE TABLE asset_buy_plan_items (
 household_id uuid NOT NULL,
 plan_id uuid NOT NULL,
 position int NOT NULL CHECK(position>=0),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 code text NOT NULL DEFAULT '' CHECK(length(code)<=40),
 market text NOT NULL DEFAULT '' CHECK(length(market)<=40),
 weight numeric(5,2) NOT NULL CHECK(weight>0 AND weight<=100),
 PRIMARY KEY(household_id,plan_id,position),
 FOREIGN KEY(household_id,plan_id) REFERENCES asset_buy_plans(household_id,id) ON DELETE CASCADE
);

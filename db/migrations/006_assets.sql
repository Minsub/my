-- 자산 현황 스냅샷. 소유자 라벨 x 등록일 x 자산 그룹의 원화 환산 금액을 시계열로 남긴다.
-- 그룹 카탈로그와 분류 룰은 src/lib/assets.ts가 단일 기준이며 group_key에 CHECK를 걸지 않는다.
-- 그룹을 늘릴 때마다 새 migration을 요구하지 않기 위해서다. 입력 검증은 contracts.ts의 zod enum이 담당한다.
-- 과거 스냅샷은 카탈로그에서 사라진 group_key도 그대로 보존하고 화면에서 지원 종료 그룹으로 표시한다.
CREATE TABLE asset_owners (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES households(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 40),
 user_id text REFERENCES "user"(id),
 sort_order int NOT NULL DEFAULT 0,
 active boolean NOT NULL DEFAULT true,
 version int NOT NULL DEFAULT 1 CHECK(version>0),
 created_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(household_id,id), UNIQUE(household_id,name)
);
-- 로그인 계정 연결은 선택이다. 계정이 없는 구성원의 자산도 등록할 수 있어야 한다.
CREATE UNIQUE INDEX asset_owner_account ON asset_owners(household_id,user_id) WHERE user_id IS NOT NULL;

-- 한 소유자의 한 날짜에는 스냅샷 1건만 존재한다. 같은 날 재등록은 그 날짜를 통째로 교체한다.
CREATE TABLE asset_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES households(id),
 owner_id uuid NOT NULL,
 as_of date NOT NULL,
 source text NOT NULL DEFAULT 'web' CHECK(source IN ('web','mcp')),
 rules_version text NOT NULL DEFAULT '',
 note text NOT NULL DEFAULT '',
 version int NOT NULL DEFAULT 1 CHECK(version>0),
 created_by text NOT NULL REFERENCES "user"(id),
 updated_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(household_id,id), UNIQUE(household_id,owner_id,as_of),
 FOREIGN KEY(household_id,owner_id) REFERENCES asset_owners(household_id,id)
);
CREATE INDEX asset_snapshot_timeline ON asset_snapshots(household_id,as_of DESC,owner_id);

-- 금액은 원화로 환산된 정수다. 서버는 환율을 적용하지 않는다.
CREATE TABLE asset_snapshot_lines (
 household_id uuid NOT NULL,
 snapshot_id uuid NOT NULL,
 group_key text NOT NULL,
 amount bigint NOT NULL CHECK(amount>=0 AND amount<=1000000000000),
 PRIMARY KEY(household_id,snapshot_id,group_key),
 FOREIGN KEY(household_id,snapshot_id) REFERENCES asset_snapshots(household_id,id) ON DELETE CASCADE
);

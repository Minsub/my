-- 자산을 그룹 합계가 아니라 원본 항목 단위로 저장한다. 그룹 합계는 항목의 합으로 유도한다.
-- 그룹을 눌렀을 때 어떤 종목이 들어 있는지 보여주려면 항목이 남아 있어야 한다.
CREATE TABLE asset_snapshot_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL,
 snapshot_id uuid NOT NULL,
 position int NOT NULL,
 group_key text NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 broker text NOT NULL DEFAULT '',
 amount bigint NOT NULL CHECK(amount>=0 AND amount<=1000000000000),
 -- 증권사가 주지 않는 값이 있다. 수량은 채권·발행어음에 없고 수익률은 원금이 0이면 없다.
 quantity numeric(24,8) CHECK(quantity>=0),
 profit bigint CHECK(profit BETWEEN -1000000000000 AND 1000000000000),
 profit_rate numeric(12,6),
 UNIQUE(household_id,snapshot_id,position),
 FOREIGN KEY(household_id,snapshot_id) REFERENCES asset_snapshots(household_id,id) ON DELETE CASCADE
);
CREATE INDEX asset_item_group ON asset_snapshot_items(household_id,snapshot_id,group_key);

-- 006의 그룹 합계는 그룹마다 항목 1건으로 옮긴다.
INSERT INTO asset_snapshot_items(household_id,snapshot_id,position,group_key,name,amount)
SELECT l.household_id, l.snapshot_id,
       row_number() OVER (PARTITION BY l.snapshot_id ORDER BY l.group_key)::int,
       l.group_key, l.group_key, l.amount
FROM asset_snapshot_lines l;

DROP TABLE asset_snapshot_lines;

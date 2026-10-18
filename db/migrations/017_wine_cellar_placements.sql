-- 와인 셀러 안의 위치. 와인 × 층마다 들어 있는 병 수를 저장한다. 층 안의 칸 번호는 저장하지 않는다.
-- 위치는 재고가 아니다. 재고는 여전히 wine_stock_events 합계이고, 이 테이블은 그중 셀러에 넣은 병만 센다.
-- 와인별 합계 ≤ 재고, 층별 합계 ≤ 층 용량은 서버가 셀러 잠금 안에서 검사한다.
-- 층 수(14)와 층 용량(8)은 셀러를 바꿀 때 migration 없이 고치도록 코드 상수(lib/wine-cellar.ts)에 둔다.
CREATE TABLE IF NOT EXISTS wine_cellar_placements (
 household_id uuid NOT NULL,
 wine_id uuid NOT NULL,
 shelf smallint NOT NULL CHECK(shelf >= 1),
 quantity int NOT NULL CHECK(quantity >= 1),
 placed_at timestamptz NOT NULL DEFAULT now(),
 updated_by text REFERENCES "user"(id),
 PRIMARY KEY(household_id,wine_id,shelf),
 FOREIGN KEY(household_id,wine_id) REFERENCES wines(household_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS wine_cellar_by_shelf ON wine_cellar_placements(household_id,shelf,placed_at);

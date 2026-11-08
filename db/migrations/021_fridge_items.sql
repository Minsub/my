-- 취미 / 냉장고. 냉장고에 있는 재료를 냉장·냉동 두 칸으로만 둔다. 개수·양·유통기한은 적지 않는다.
-- place는 cold(냉장)·frozen(냉동). added_on은 넣은 날(서울 날짜)이고 칸을 옮겨도 바뀌지 않는다.
-- 뺀 재료는 지우지 않고 removed(eaten 다 먹음·wasted 버림)와 removed_at을 남긴다.
-- 최근 다 먹은 재료를 "다시 넣기"로 제안하고 달마다 버린 수를 세는 데 쓴다.
-- 냉장고는 구성원이 함께 쓰므로 누가 넣었든 누구나 빼고 옮긴다. 같은 재료를 동시에 바꾸면 version으로 막는다.
CREATE TABLE IF NOT EXISTS fridge_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 40),
 place text NOT NULL CHECK(place IN ('cold','frozen')),
 added_on date NOT NULL,
 removed text CHECK(removed IN ('eaten','wasted')),
 removed_at timestamptz,
 version int NOT NULL DEFAULT 1 CHECK(version > 0),
 created_by text NOT NULL REFERENCES "user"(id),
 updated_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((removed IS NULL) = (removed_at IS NULL)),
 UNIQUE(household_id,id)
);
CREATE INDEX IF NOT EXISTS fridge_items_in ON fridge_items(household_id,added_on) WHERE removed IS NULL;
CREATE INDEX IF NOT EXISTS fridge_items_removed ON fridge_items(household_id,removed_at DESC) WHERE removed IS NOT NULL;

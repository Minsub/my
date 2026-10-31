-- 취미 / 집밥. 집에서 해먹을 요리 목록. 재료는 메인 재료만 적는다.
-- 카테고리 목록은 migration 없이 고치도록 코드 상수(lib/meals.ts)에 두고 SQL CHECK를 걸지 않는다.
-- title_key는 공백을 뺀 소문자 제목이다. "참치 김치찌개"와 "참치김치찌개"를 같은 요리로 보고 막는다.
-- 해보고 싶음(want_to_try)은 태그·카테고리와 따로 관리하는 표시다.
-- links는 출처 링크 여러 개를 입력 순서대로 둔다. 미리보기(썸네일)는 저장하지 않고 볼 때 링크에서 읽는다.
CREATE TABLE IF NOT EXISTS meal_dishes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 100),
 title_key text NOT NULL CHECK(length(title_key) >= 1),
 category text NOT NULL,
 ingredients text[] NOT NULL DEFAULT '{}',
 tags text[] NOT NULL DEFAULT '{}',
 links text[] NOT NULL DEFAULT '{}',
 memo text NOT NULL DEFAULT '' CHECK(length(memo) <= 2000),
 want_to_try boolean NOT NULL DEFAULT false,
 version int NOT NULL DEFAULT 1 CHECK(version > 0),
 created_by text NOT NULL REFERENCES "user"(id),
 updated_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(household_id,id),
 UNIQUE(household_id,title_key)
);
CREATE INDEX IF NOT EXISTS meal_dishes_recent ON meal_dishes(household_id,created_at DESC);

-- 취미 / 커피 정리.
-- 1) 원두 하나에 용량별 판매 가격을 여러 개 둔다. 목록은 가장 비싼 옵션 하나만 보여준다.
--    position은 입력 순서다. 중량 또는 가격 중 하나는 있어야 한다(중량 없는 가격, 0원도 기록한다).
--    기존 coffee_beans.price·weight_g를 옵션 한 줄로 옮긴다. 두 열은 이전 코드와의 호환을 위해 남기고 새 코드는 읽거나 쓰지 않는다.
-- 2) 브랜드 대표 이미지. 웹에서만 올린다. 와인 사진과 같은 1000px WebP·300KB 상한.
-- 3) 경험(구매예정/먹어봄)은 취향 기록 여부로 정한다. 기록이 있으면 먹어봄, 없으면 구매예정이다.
--    아무 평가 없이 '구매예정'만 남긴 기록은 기본값과 같아 지우고, 남는 기록은 먹어봄으로 맞춘다.
-- 4) 원두 보관(archived)은 쓰지 않는다. 열은 이전 코드 호환을 위해 남긴다.
CREATE TABLE IF NOT EXISTS coffee_bean_prices (
 household_id uuid NOT NULL,
 bean_id uuid NOT NULL,
 position int NOT NULL CHECK(position >= 0),
 weight_g int CHECK(weight_g > 0 AND weight_g <= 100000),
 price int CHECK(price >= 0 AND price <= 100000000),
 CHECK(weight_g IS NOT NULL OR price IS NOT NULL),
 PRIMARY KEY(bean_id, position),
 FOREIGN KEY(household_id, bean_id) REFERENCES coffee_beans(household_id, id) ON DELETE CASCADE
);
INSERT INTO coffee_bean_prices(household_id, bean_id, position, weight_g, price)
SELECT household_id, id, 0, weight_g, price FROM coffee_beans
WHERE (price IS NOT NULL OR weight_g IS NOT NULL)
ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS coffee_brand_photos (
 brand_id uuid PRIMARY KEY REFERENCES coffee_brands(id) ON DELETE CASCADE,
 content bytea NOT NULL CHECK(octet_length(content) <= 300000),
 content_hash text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
DELETE FROM coffee_preferences
WHERE recommendation IS NULL AND note = '' AND status IS DISTINCT FROM '먹어봄';
UPDATE coffee_preferences SET status = '먹어봄' WHERE status IS DISTINCT FROM '먹어봄';

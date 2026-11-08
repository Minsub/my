-- 취미 / 냉장고. 재료와 완성된 음식을 나눈다.
-- kind: ingredient(재료) · dish(반찬·남은 음식, 만들어 둔 것) · ready(간편식, 사 온 완성품).
-- 이미 넣은 것은 이름으로 한 번 나눠 둔다. 규칙은 lib/fridge.ts의 guessFridgeKind와 같은 낱말이다.
-- 틀린 것은 화면에서 재료를 눌러 고친다.
ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'ingredient'
 CHECK(kind IN ('ingredient','dish','ready'));
UPDATE fridge_items SET kind='ready'
 WHERE kind='ingredient'
   AND name ~ '(짬뽕|짜장|우동|라면|피자|돈까스|돈가스|너겟|핫도그|아이스크림|볶음밥|만두|밀키트|도시락|김밥|샌드위치)';
UPDATE fridge_items SET kind='dish'
 WHERE kind='ingredient'
   AND regexp_replace(name,'\s+','','g') ~ '(조림|무침|볶음|나물|찌개|국|탕|전|장아찌|절임|샐러드|카레|겉절이|잡채|반찬|남은것|남은거)$'
   AND regexp_replace(name,'\s+','','g') !~ '(설탕|사탕)$';

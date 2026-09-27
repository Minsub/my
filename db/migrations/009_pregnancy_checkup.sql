-- 꼬미 / 진료·검사 기록. 진료나 NST 수축검사처럼 정해진 형식이 없는 병원 기록을 한 시점으로 남긴다.
-- 자궁경부길이·양수량·아기 심박수만 따로 두고 나머지는 메모에 쓴다. 사진은 기존 표에 최대 10장(position 0~9).
ALTER TABLE pregnancy_events
 ADD COLUMN cervix_length_cm numeric(4,2) CHECK(cervix_length_cm>0 AND cervix_length_cm<=8),
 ADD COLUMN amniotic_fluid text CHECK(amniotic_fluid IN ('enough','low')),
 ADD COLUMN fetal_heart_rate smallint CHECK(fetal_heart_rate BETWEEN 50 AND 250);

ALTER TABLE pregnancy_events
 DROP CONSTRAINT pregnancy_events_kind_check,
 ADD CONSTRAINT pregnancy_events_kind_check CHECK(kind IN ('tightening','pain','bleeding','checkup'));

-- 진료 메모는 길어질 수 있어 2000자까지 둔다. 나머지 타입은 그대로 500자.
ALTER TABLE pregnancy_events
 DROP CONSTRAINT pregnancy_events_memo_check,
 ADD CONSTRAINT pregnancy_events_memo_check
  CHECK(length(memo)<=CASE WHEN kind='checkup' THEN 2000 ELSE 500 END);

ALTER TABLE pregnancy_events
 DROP CONSTRAINT pregnancy_events_check,
 ADD CONSTRAINT pregnancy_events_check CHECK(
  (kind IN ('tightening','pain') AND ended_at IS NOT NULL AND ended_at>started_at
   AND ended_at<=started_at+interval '1 hour' AND bleeding IS NULL AND bleeding_color IS NULL)
  OR
  (kind='bleeding' AND ended_at IS NULL AND intensity IS NULL AND bleeding IS NOT NULL
   AND (bleeding<>'none' OR bleeding_color IS NULL))
  OR
  (kind='checkup' AND ended_at IS NULL AND intensity IS NULL AND bleeding IS NULL AND bleeding_color IS NULL)
 ),
 ADD CONSTRAINT pregnancy_events_checkup_fields CHECK(
  kind='checkup' OR (cervix_length_cm IS NULL AND amniotic_fluid IS NULL AND fetal_heart_rate IS NULL)
 );

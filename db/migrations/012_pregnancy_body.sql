-- 꼬미 / 산모 기록. 몸무게·배둘레를 한 시점의 기록으로 남기고, 설정에 임신 전 몸무게를 둔다.
-- 둘 중 하나만 재도 기록할 수 있다. 사진은 없고 메모는 다른 타입과 같은 500자다.
ALTER TABLE pregnancy_settings
 ADD COLUMN pre_weight_kg numeric(4,1) CHECK(pre_weight_kg BETWEEN 30 AND 200);

ALTER TABLE pregnancy_events
 ADD COLUMN weight_kg numeric(4,1) CHECK(weight_kg BETWEEN 30 AND 200),
 ADD COLUMN belly_cm numeric(4,1) CHECK(belly_cm BETWEEN 40 AND 200);

ALTER TABLE pregnancy_events
 DROP CONSTRAINT pregnancy_events_kind_check,
 ADD CONSTRAINT pregnancy_events_kind_check CHECK(kind IN ('tightening','pain','bleeding','checkup','body'));

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
  OR
  (kind='body' AND ended_at IS NULL AND intensity IS NULL AND bleeding IS NULL AND bleeding_color IS NULL
   AND (weight_kg IS NOT NULL OR belly_cm IS NOT NULL))
 ),
 ADD CONSTRAINT pregnancy_events_body_fields CHECK(
  kind='body' OR (weight_kg IS NULL AND belly_cm IS NULL)
 );

-- 추이 그래프는 진료·검사와 산모 기록을 기간 제한 없이 읽는다.
CREATE INDEX pregnancy_event_measures ON pregnancy_events(household_id,started_at DESC)
 WHERE kind IN ('checkup','body');

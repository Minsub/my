-- 꼬미 / 태동 기록. 배뭉침·통증처럼 시작·종료가 있는 완성된 기록만 저장하고, 종료할 때 강도(하·중·상 = 1~3)를 붙인다.
-- 진통 상태 판정에는 넣지 않고 하루 단위 횟수로 본다. 다른 타입과 같은 시각·강도 칸을 쓰므로 새 칸은 없다.
ALTER TABLE pregnancy_events
 DROP CONSTRAINT pregnancy_events_kind_check,
 ADD CONSTRAINT pregnancy_events_kind_check CHECK(kind IN ('tightening','pain','bleeding','checkup','body','movement'));

ALTER TABLE pregnancy_events
 DROP CONSTRAINT pregnancy_events_check,
 ADD CONSTRAINT pregnancy_events_check CHECK(
  (kind IN ('tightening','pain','movement') AND ended_at IS NOT NULL AND ended_at>started_at
   AND ended_at<=started_at+interval '1 hour' AND bleeding IS NULL AND bleeding_color IS NULL)
  OR
  (kind='bleeding' AND ended_at IS NULL AND intensity IS NULL AND bleeding IS NOT NULL
   AND (bleeding<>'none' OR bleeding_color IS NULL))
  OR
  (kind='checkup' AND ended_at IS NULL AND intensity IS NULL AND bleeding IS NULL AND bleeding_color IS NULL)
  OR
  (kind='body' AND ended_at IS NULL AND intensity IS NULL AND bleeding IS NULL AND bleeding_color IS NULL
   AND (weight_kg IS NOT NULL OR belly_cm IS NOT NULL))
 );

-- 태동은 하루에도 여러 번 쌓이므로 조회 한도를 배뭉침·통증과 따로 둔다.
CREATE INDEX pregnancy_event_movements ON pregnancy_events(household_id,started_at DESC)
 WHERE kind='movement';

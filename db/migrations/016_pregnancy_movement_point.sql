-- 꼬미 / 태동을 한 시점 기록으로 바꾼다. 버튼을 한 번 누르면 바로 저장하고 지속 시간은 0(시작=종료)으로 둔다.
-- 앞서 배포된 화면(시작·종료 타이머)이 남아 있어도 저장되도록 DB는 종료가 시작과 같거나 늦은 값을 받고,
-- 서버가 항상 시작=종료로 저장한다. 제약을 먼저 넓힌 뒤 이미 쌓인 태동의 지속 시간을 지운다.
ALTER TABLE pregnancy_events
 DROP CONSTRAINT pregnancy_events_check,
 ADD CONSTRAINT pregnancy_events_check CHECK(
  (kind IN ('tightening','pain') AND ended_at IS NOT NULL AND ended_at>started_at
   AND ended_at<=started_at+interval '1 hour' AND bleeding IS NULL AND bleeding_color IS NULL)
  OR
  (kind='movement' AND ended_at IS NOT NULL AND ended_at>=started_at
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

UPDATE pregnancy_events SET ended_at=started_at, version=version+1, updated_at=now()
 WHERE kind='movement' AND ended_at<>started_at;

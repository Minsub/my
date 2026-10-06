-- 꼬미 / 진료·검사의 아기 몸무게(초음파 추정 체중, g). 다른 진료 값처럼 선택이고 진료·검사에만 둔다.
ALTER TABLE pregnancy_events
 ADD COLUMN fetal_weight_g smallint CHECK(fetal_weight_g BETWEEN 1 AND 7000);

ALTER TABLE pregnancy_events
 DROP CONSTRAINT pregnancy_events_checkup_fields,
 ADD CONSTRAINT pregnancy_events_checkup_fields CHECK(
  kind='checkup' OR (cervix_length_cm IS NULL AND amniotic_fluid IS NULL AND fetal_heart_rate IS NULL
   AND fetal_weight_g IS NULL)
 );

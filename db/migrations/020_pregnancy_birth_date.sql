-- 꼬미 / 출산일. 출산예정일(주수 계산 기준, 40주 0일)과 따로 실제 분만하기로 정한 날(유도분만·제왕절개 등)을 둔다.
-- 비어 있으면 D-day는 출산예정일을 기준으로 센다.
ALTER TABLE pregnancy_settings
 ADD COLUMN birth_date date;

-- 꼬미 / 임신 중 통증 기록. 배뭉침·통증은 시작과 종료가 모두 있는 완성된 기록만 저장한다.
-- 진행 중 타이머는 입력하는 기기의 브라우저에 두고 종료할 때 한 번에 저장한다.
-- 출혈은 한 시점의 기록이다. 확인했지만 출혈이 없던 것도 'none'으로 남긴다.
CREATE TABLE pregnancy_settings (
 household_id uuid PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
 due_date date,
 version int NOT NULL DEFAULT 1 CHECK(version>0),
 updated_by text NOT NULL REFERENCES "user"(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pregnancy_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('tightening','pain','bleeding')),
 started_at timestamptz NOT NULL,
 ended_at timestamptz,
 intensity smallint CHECK(intensity BETWEEN 1 AND 3),
 bleeding text CHECK(bleeding IN ('none','spotting','light','moderate','heavy')),
 bleeding_color text CHECK(bleeding_color IN ('brown','pink','red','dark')),
 memo text NOT NULL DEFAULT '' CHECK(length(memo)<=500),
 -- 기기가 저장을 재시도해도 한 건만 남도록 클라이언트가 만든 키를 보관한다.
 request_key uuid NOT NULL,
 version int NOT NULL DEFAULT 1 CHECK(version>0),
 created_by text NOT NULL REFERENCES "user"(id),
 updated_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(household_id,id),
 UNIQUE(household_id,request_key),
 CHECK(
  (kind IN ('tightening','pain') AND ended_at IS NOT NULL AND ended_at>started_at
   AND ended_at<=started_at+interval '1 hour' AND bleeding IS NULL AND bleeding_color IS NULL)
  OR
  (kind='bleeding' AND ended_at IS NULL AND intensity IS NULL AND bleeding IS NOT NULL
   AND (bleeding<>'none' OR bleeding_color IS NULL))
 )
);
CREATE INDEX pregnancy_event_timeline ON pregnancy_events(household_id,started_at DESC);

-- 출혈 사진. 와인 사진과 같이 서버에서 회전 보정·축소·WebP 변환한 결과만 저장한다.
CREATE TABLE pregnancy_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL,
 event_id uuid NOT NULL,
 position smallint NOT NULL CHECK(position BETWEEN 0 AND 9),
 content bytea NOT NULL CHECK(octet_length(content)<=300000),
 content_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(household_id,event_id) REFERENCES pregnancy_events(household_id,id) ON DELETE CASCADE
);
CREATE INDEX pregnancy_photo_event ON pregnancy_photos(household_id,event_id,position);

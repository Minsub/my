-- 기타 / HTML 도구. 배포 없이 웹에서 올린 단일 HTML 한 파일. 공간 구성원 누구나 보고, 올린 사람·관리자가 교체·삭제한다.
-- 원본은 UTF-8 텍스트 그대로 둔다. 실행할 때 서버가 CSP를 넣고 iframe sandbox에서만 연다. 이전 버전은 보관하지 않는다.
CREATE TABLE IF NOT EXISTS html_uploads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 80),
 description text NOT NULL DEFAULT '' CHECK(length(description) <= 200),
 filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 200),
 content text NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 3000000),
 content_hash text NOT NULL,
 version int NOT NULL DEFAULT 1 CHECK(version > 0),
 created_by text NOT NULL REFERENCES "user"(id),
 updated_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS html_uploads_household ON html_uploads(household_id, updated_at DESC);

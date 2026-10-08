-- 와인 목록 공유. 셀러에서 추린 와인 목록을 로그인 없이 볼 수 있는 링크로 열고, 받은 사람이 마음에 드는 와인을 고른다.
-- wine_ids는 만들 때 고른 목록과 순서를 고정한다. 배열이라 FK를 걸 수 없으므로 만들 때 같은 공간의 와인인지 서버가 확인하고,
-- 읽을 때도 공유의 household_id로 다시 거른다.
CREATE TABLE IF NOT EXISTS wine_shares (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES households(id),
 token text NOT NULL UNIQUE CHECK(length(token) >= 32),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 80),
 note text NOT NULL DEFAULT '' CHECK(length(note) <= 500),
 wine_ids uuid[] NOT NULL CHECK(cardinality(wine_ids) BETWEEN 1 AND 60),
 price_display text NOT NULL DEFAULT 'band' CHECK(price_display IN ('none','band','exact')),
 max_picks smallint NOT NULL CHECK(max_picks BETWEEN 1 AND 10),
 show_results boolean NOT NULL DEFAULT false,
 created_by text NOT NULL REFERENCES "user"(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 UNIQUE(household_id,id)
);
CREATE INDEX IF NOT EXISTS wine_shares_by_household ON wine_shares(household_id,created_at DESC);
-- 받은 사람의 선택. 로그인이 없으므로 브라우저에 저장한 voter_key로 한 사람의 선택을 덮어쓴다.
CREATE TABLE IF NOT EXISTS wine_share_votes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL,
 share_id uuid NOT NULL,
 voter_key uuid NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 30),
 picks uuid[] NOT NULL CHECK(cardinality(picks) BETWEEN 1 AND 10),
 comment text NOT NULL DEFAULT '' CHECK(length(comment) <= 300),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(share_id,voter_key),
 FOREIGN KEY(household_id,share_id) REFERENCES wine_shares(household_id,id) ON DELETE CASCADE
);

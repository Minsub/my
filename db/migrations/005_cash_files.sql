-- One current workbook per normalized filename and space. No transaction rows or historical file versions.
CREATE TABLE cash_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
 filename text NOT NULL, filename_key text NOT NULL,
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 3000000),
 content_hash text NOT NULL, metadata jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_by text NOT NULL REFERENCES "user"(id),
 updated_by text NOT NULL REFERENCES "user"(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(household_id,filename_key)
);

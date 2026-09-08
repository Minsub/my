ALTER TABLE wines ADD COLUMN reference_price integer CHECK(reference_price >= 0), ADD COLUMN reference_purchased_on date;
UPDATE wines w SET reference_price = CASE WHEN r.raw->>'구매가' ~ '^\d{1,8}$' THEN (r.raw->>'구매가')::integer END,
 reference_purchased_on = CASE WHEN r.raw->>'구매일' ~ '^\d{4}-\d{2}-\d{2}$' THEN (r.raw->>'구매일')::date END
FROM import_records r WHERE r.target_id=w.id AND r.household_id=w.household_id AND r.source='airtable:wines';
CREATE TABLE wine_photos (
 wine_id uuid PRIMARY KEY REFERENCES wines(id) ON DELETE CASCADE,
 content bytea NOT NULL CHECK(octet_length(content)<=300000),
 content_hash text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE wine_photo_requests (
 household_id uuid NOT NULL REFERENCES households(id), user_id text NOT NULL,
 request_key uuid NOT NULL, input_hash text NOT NULL, result jsonb NOT NULL,
 PRIMARY KEY(household_id,user_id,request_key)
);

CREATE TABLE oauth_revocations (
 user_id text NOT NULL REFERENCES "user"(id), client_id text NOT NULL,
 revoked_before bigint NOT NULL,
 PRIMARY KEY(user_id,client_id)
);

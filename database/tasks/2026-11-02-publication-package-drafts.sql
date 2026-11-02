-- Local draft-only schema. Not a production migration or execution queue.
CREATE TABLE publication_package_drafts (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 request_key TEXT NOT NULL,
 draft_identity TEXT NOT NULL,
 payload_json TEXT NOT NULL,
 item_count INTEGER NOT NULL CHECK(item_count BETWEEN 1 AND 1000),
 created_at_ms INTEGER NOT NULL,
 UNIQUE(user_id,request_key), UNIQUE(id,user_id,project_id)
);
CREATE TABLE publication_package_draft_items (
 id TEXT PRIMARY KEY, package_id TEXT NOT NULL, user_id TEXT NOT NULL, project_id TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position>=0),
 channel TEXT NOT NULL CHECK(channel IN ('instagram','facebook','pinterest','whatsapp','x','linkedin','email','website')),
 connection_id TEXT NOT NULL, destination_id TEXT NOT NULL, target_kind TEXT NOT NULL, draft_json TEXT NOT NULL,
 FOREIGN KEY(package_id,user_id,project_id) REFERENCES publication_package_drafts(id,user_id,project_id) ON DELETE CASCADE,
 UNIQUE(package_id,position), UNIQUE(package_id,channel,connection_id,destination_id,target_kind)
);
CREATE TABLE publication_package_draft_receipts (
 package_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, project_id TEXT NOT NULL, request_key TEXT NOT NULL,
 complete INTEGER NOT NULL CHECK(complete=1),
 FOREIGN KEY(package_id,user_id,project_id) REFERENCES publication_package_drafts(id,user_id,project_id) ON DELETE CASCADE,
 UNIQUE(user_id,request_key)
);

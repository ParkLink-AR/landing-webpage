-- vine_por and emailed were added later via ALTER TABLE on the live DB;
-- this file reflects the full current shape for a fresh setup.
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    comentario TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    vine_por TEXT,
    emailed INTEGER NOT NULL DEFAULT 0
);

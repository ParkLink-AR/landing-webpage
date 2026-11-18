CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    comentario TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

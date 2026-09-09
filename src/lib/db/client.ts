import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  const customPath = process.env.PROOFUI_DB_PATH;
  if (customPath) return customPath;

  const dataDir = path.join(process.cwd(), ".proofui");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "proofui.sqlite");
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = getDatabasePath();
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initTables(db);
  dbInstance = db;
  return db;
}

export function initTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      revision INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_data (
      project_id TEXT PRIMARY KEY,
      canonical_source TEXT NOT NULL,
      revision INTEGER NOT NULL,
      document_context TEXT NOT NULL,
      conversations TEXT NOT NULL,
      messages TEXT NOT NULL,
      versions TEXT NOT NULL,
      review TEXT,
      active_conversation_id TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
  `);
}

/**
 * Creates an in-memory database instance specifically for testing.
 */
export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  initTables(db);
  return db;
}

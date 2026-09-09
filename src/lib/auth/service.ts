import crypto from "crypto";
import type Database from "better-sqlite3";
import { getDb } from "../db/client";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
}

const SESSION_COOKIE_NAME = "proofui_session";
const SESSION_TTL_DAYS = 14;

export function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString("hex"));
    });
  });
}

export class AuthService {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDb();
  }

  async register(params: {
    email: string;
    password?: string;
    name: string;
    role?: string;
  }): Promise<{ user: UserRecord; sessionToken: string }> {
    const email = params.email.trim().toLowerCase();
    const name = params.name.trim() || email.split("@")[0];

    // Check duplicate
    const existing = this.db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string } | undefined;
    if (existing) {
      throw new Error("User with this email already exists");
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = params.password
      ? await hashPassword(params.password, salt)
      : await hashPassword(crypto.randomBytes(32).toString("hex"), salt);

    const now = Date.now();
    const role = params.role || "user";

    this.db.prepare(`
      INSERT INTO users (id, email, name, password_hash, salt, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, email, name, passwordHash, salt, role, now);

    const sessionToken = this.createSession(userId);
    return {
      user: { id: userId, email, name, role, createdAt: now },
      sessionToken,
    };
  }

  async login(params: {
    email: string;
    password?: string;
  }): Promise<{ user: UserRecord; sessionToken: string }> {
    const email = params.email.trim().toLowerCase();
    const row = this.db.prepare(`
      SELECT id, email, name, password_hash, salt, role, created_at
      FROM users WHERE email = ?
    `).get(email) as {
      id: string;
      email: string;
      name: string;
      password_hash: string;
      salt: string;
      role: string;
      created_at: number;
    } | undefined;

    if (!row) {
      throw new Error("Invalid email or password");
    }

    if (params.password) {
      const computedHash = await hashPassword(params.password, row.salt);
      if (computedHash !== row.password_hash) {
        throw new Error("Invalid email or password");
      }
    }

    const sessionToken = this.createSession(row.id);
    return {
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.created_at,
      },
      sessionToken,
    };
  }

  createSession(userId: string): string {
    const sessionId = `ses_${crypto.randomUUID()}`;
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

    this.db.prepare(`
      INSERT INTO sessions (id, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, userId, expiresAt, now);

    return sessionId;
  }

  validateSession(sessionId: string): { user: UserRecord; session: SessionRecord } | null {
    if (!sessionId) return null;

    const row = this.db.prepare(`
      SELECT s.id as session_id, s.user_id, s.expires_at, s.created_at as session_created_at,
             u.id as user_id, u.email, u.name, u.role, u.created_at as user_created_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(sessionId) as {
      session_id: string;
      user_id: string;
      expires_at: number;
      session_created_at: number;
      email: string;
      name: string;
      role: string;
      user_created_at: number;
    } | undefined;

    if (!row) return null;

    if (Date.now() > row.expires_at) {
      this.deleteSession(sessionId);
      return null;
    }

    return {
      user: {
        id: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.user_created_at,
      },
      session: {
        id: row.session_id,
        userId: row.user_id,
        expiresAt: row.expires_at,
        createdAt: row.session_created_at,
      },
    };
  }

  deleteSession(sessionId: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  /**
   * Helper for quick evaluation / guest accounts.
   */
  async getOrCreateDemoUser(role = "designer"): Promise<{ user: UserRecord; sessionToken: string }> {
    const email = `demo.${role}@proofui.local`;
    try {
      return await this.login({ email });
    } catch {
      return await this.register({
        email,
        name: `Demo ${role.toUpperCase()}`,
        role,
      });
    }
  }
}

export const authService = new AuthService();
export { SESSION_COOKIE_NAME };

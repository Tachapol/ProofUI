import crypto from "crypto";
import type Database from "better-sqlite3";
import { getDb } from "../db/client";
import { StoredEditorProject, getDefaultDocumentContext } from "../editor/persistence";
import { getSampleTailwindDocument } from "../sample-document";

export interface ProjectMetadata {
  id: string;
  userId: string;
  name: string;
  slug: string;
  isArchived: boolean;
  revision: number;
  createdAt: number;
  updatedAt: number;
}

export interface FullProjectRecord {
  metadata: ProjectMetadata;
  data: StoredEditorProject;
}

export class ProjectsService {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDb();
  }

  listProjects(userId: string, includeArchived = false): ProjectMetadata[] {
    const query = includeArchived
      ? `SELECT id, user_id, name, slug, is_archived, revision, created_at, updated_at
         FROM projects WHERE user_id = ? ORDER BY updated_at DESC`
      : `SELECT id, user_id, name, slug, is_archived, revision, created_at, updated_at
         FROM projects WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC`;

    const rows = this.db.prepare(query).all(userId) as Array<{
      id: string;
      user_id: string;
      name: string;
      slug: string;
      is_archived: number;
      revision: number;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      name: r.name,
      slug: r.slug,
      isArchived: Boolean(r.is_archived),
      revision: r.revision,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  getProject(userId: string, projectId: string): FullProjectRecord | null {
    const row = this.db.prepare(`
      SELECT p.id, p.user_id, p.name, p.slug, p.is_archived, p.revision, p.created_at, p.updated_at,
             d.canonical_source, d.revision as data_revision, d.document_context,
             d.conversations, d.messages, d.versions, d.review, d.active_conversation_id
      FROM projects p
      LEFT JOIN project_data d ON p.id = d.project_id
      WHERE p.id = ? AND p.user_id = ?
    `).get(projectId, userId) as {
      id: string;
      user_id: string;
      name: string;
      slug: string;
      is_archived: number;
      revision: number;
      created_at: number;
      updated_at: number;
      canonical_source?: string;
      data_revision?: number;
      document_context?: string;
      conversations?: string;
      messages?: string;
      versions?: string;
      review?: string;
      active_conversation_id?: string;
    } | undefined;

    if (!row) return null;

    const metadata: ProjectMetadata = {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      slug: row.slug,
      isArchived: Boolean(row.is_archived),
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    let data: StoredEditorProject;
    if (row.canonical_source !== undefined) {
      data = {
        schemaVersion: 3,
        document: {
          source: row.canonical_source,
          revision: row.data_revision ?? row.revision,
          context: row.document_context ? JSON.parse(row.document_context) : getDefaultDocumentContext(row.name),
        },
        conversations: row.conversations ? JSON.parse(row.conversations) : [],
        messages: row.messages ? JSON.parse(row.messages) : [],
        versions: row.versions ? JSON.parse(row.versions) : [],
        review: row.review ? JSON.parse(row.review) : undefined,
        activeConversationId: row.active_conversation_id || null,
        timestamp: row.updated_at,
      };
    } else {
      // Fallback default
      const defaultSource = getSampleTailwindDocument(`proj-${row.id}`);
      data = {
        schemaVersion: 3,
        document: {
          source: defaultSource,
          revision: 1,
          context: getDefaultDocumentContext(row.name),
        },
        conversations: [],
        messages: [],
        versions: [
          {
            id: `ver_${Date.now()}`,
            parentVersionId: null,
            source: "initial",
            revision: 1,
            htmlReference: defaultSource,
            summary: "Initial Document Template",
            createdAt: new Date().toISOString(),
          },
        ],
        activeConversationId: null,
        timestamp: row.updated_at,
      };
    }

    return { metadata, data };
  }

  createProject(
    userId: string,
    name: string,
    initialData?: Partial<StoredEditorProject>
  ): FullProjectRecord {
    const trimmedName = name.trim() || "Untitled Project";
    const projectId = `proj_${crypto.randomUUID()}`;
    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) || "project";
    const now = Date.now();
    const source = initialData?.document?.source || getSampleTailwindDocument(`session-${projectId}`);
    const revision = initialData?.document?.revision || 1;
    const context = initialData?.document?.context || getDefaultDocumentContext(trimmedName);
    const conversations = initialData?.conversations || [];
    const messages = initialData?.messages || [];
    const versions = initialData?.versions || [
      {
        id: `ver_${Date.now()}`,
        parentVersionId: null,
        source: "initial",
        revision: 1,
        htmlReference: source,
        summary: "Initial Document Template",
        createdAt: new Date().toISOString(),
      },
    ];

    const insertTx = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO projects (id, user_id, name, slug, is_archived, revision, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)
      `).run(projectId, userId, trimmedName, slug, revision, now, now);

      this.db.prepare(`
        INSERT INTO project_data (
          project_id, canonical_source, revision, document_context,
          conversations, messages, versions, review, active_conversation_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        source,
        revision,
        JSON.stringify(context),
        JSON.stringify(conversations),
        JSON.stringify(messages),
        JSON.stringify(versions),
        initialData?.review ? JSON.stringify(initialData.review) : null,
        initialData?.activeConversationId || null,
        now
      );
    });

    insertTx();

    const result = this.getProject(userId, projectId);
    if (!result) throw new Error("Failed to create project");
    return result;
  }

  updateProject(
    userId: string,
    projectId: string,
    data: StoredEditorProject,
    expectedRevision?: number
  ): FullProjectRecord {
    const current = this.getProject(userId, projectId);
    if (!current) {
      throw new Error("Project not found or unauthorized");
    }

    // Revision conflict check:
    // If expectedRevision is given and doesn't match current stored revision, throw conflict.
    if (typeof expectedRevision === "number" && current.metadata.revision !== expectedRevision) {
      const conflictError = new Error(
        `Revision conflict: Server is at revision ${current.metadata.revision}, but update expected revision ${expectedRevision}`
      );
      (conflictError as unknown as { status: number }).status = 409;
      throw conflictError;
    }

    const nextRevision = Math.max(data.document.revision, current.metadata.revision);
    const now = Date.now();

    const updateTx = this.db.transaction(() => {
      this.db.prepare(`
        UPDATE projects
        SET revision = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(nextRevision, now, projectId, userId);

      this.db.prepare(`
        INSERT INTO project_data (
          project_id, canonical_source, revision, document_context,
          conversations, messages, versions, review, active_conversation_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          canonical_source = excluded.canonical_source,
          revision = excluded.revision,
          document_context = excluded.document_context,
          conversations = excluded.conversations,
          messages = excluded.messages,
          versions = excluded.versions,
          review = excluded.review,
          active_conversation_id = excluded.active_conversation_id,
          updated_at = excluded.updated_at
      `).run(
        projectId,
        data.document.source,
        nextRevision,
        JSON.stringify(data.document.context),
        JSON.stringify(data.conversations),
        JSON.stringify(data.messages),
        JSON.stringify(data.versions),
        data.review ? JSON.stringify(data.review) : null,
        data.activeConversationId || null,
        now
      );
    });

    updateTx();

    const updated = this.getProject(userId, projectId);
    if (!updated) throw new Error("Failed to update project");
    return updated;
  }

  renameProject(userId: string, projectId: string, newName: string): ProjectMetadata {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("Project name cannot be empty");

    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) || "project";
    const now = Date.now();

    const result = this.db.prepare(`
      UPDATE projects
      SET name = ?, slug = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(trimmed, slug, now, projectId, userId);

    if (result.changes === 0) throw new Error("Project not found or unauthorized");

    const project = this.getProject(userId, projectId);
    if (!project) throw new Error("Project not found");
    return project.metadata;
  }

  setArchiveStatus(userId: string, projectId: string, isArchived: boolean): ProjectMetadata {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE projects
      SET is_archived = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(isArchived ? 1 : 0, now, projectId, userId);

    if (result.changes === 0) throw new Error("Project not found or unauthorized");

    const project = this.getProject(userId, projectId);
    if (!project) throw new Error("Project not found");
    return project.metadata;
  }
}

export const projectsService = new ProjectsService();

import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { AuthService } from "@/lib/auth/service";
import { ProjectsService } from "@/lib/projects/service";

describe("Milestone 6.1: Accounts & Persistent Projects Backend", () => {
  let db: ReturnType<typeof createTestDb>;
  let auth: AuthService;
  let projects: ProjectsService;

  beforeEach(() => {
    db = createTestDb();
    auth = new AuthService(db);
    projects = new ProjectsService(db);
  });

  it("registers and logs in a new user with secure password hash", async () => {
    const reg = await auth.register({
      email: "designer@proofui.com",
      password: "securePassword123!",
      name: "Alex Designer",
      role: "designer",
    });

    expect(reg.user.id).toMatch(/^usr_/);
    expect(reg.user.email).toBe("designer@proofui.com");
    expect(reg.user.name).toBe("Alex Designer");
    expect(reg.sessionToken).toMatch(/^ses_/);

    // Validate active session
    const validated = auth.validateSession(reg.sessionToken);
    expect(validated).not.toBeNull();
    expect(validated?.user.email).toBe("designer@proofui.com");

    // Login with valid credentials
    const loggedIn = await auth.login({
      email: "designer@proofui.com",
      password: "securePassword123!",
    });
    expect(loggedIn.user.id).toBe(reg.user.id);

    // Login with invalid credentials throws
    await expect(
      auth.login({ email: "designer@proofui.com", password: "wrongPassword" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("handles instant guest/demo accounts for evaluation studies", async () => {
    const demo = await auth.getOrCreateDemoUser("evaluator");
    expect(demo.user.email).toBe("demo.evaluator@proofui.local");
    expect(demo.sessionToken).toBeDefined();

    // Re-login returns existing account
    const secondCall = await auth.getOrCreateDemoUser("evaluator");
    expect(secondCall.user.id).toBe(demo.user.id);
  });

  it("creates, lists, and loads database-backed projects", async () => {
    const { user } = await auth.register({ email: "team@proofui.com", name: "Team" });

    const proj1 = projects.createProject(user.id, "Homepage Redesign");
    const proj2 = projects.createProject(user.id, "Checkout Flow V2");

    expect(proj1.metadata.id).toMatch(/^proj_/);
    expect(proj1.metadata.name).toBe("Homepage Redesign");
    expect(proj1.metadata.revision).toBe(1);

    const list = projects.listProjects(user.id);
    expect(list.length).toBe(2);
    expect(list.map((p) => p.name)).toContain("Homepage Redesign");
    expect(list.map((p) => p.name)).toContain("Checkout Flow V2");

    const loaded = projects.getProject(user.id, proj1.metadata.id);
    expect(loaded).not.toBeNull();
    expect(loaded?.data.document.source).toContain("<!DOCTYPE html>");
  });

  it("updates project state and enforces revision conflict detection (409)", async () => {
    const { user } = await auth.register({ email: "alice@proofui.com", name: "Alice" });
    const project = projects.createProject(user.id, "Landing Page");

    const updatedData = {
      ...project.data,
      document: {
        ...project.data.document,
        source: "<!DOCTYPE html><html><body><h1>Updated Version</h1></body></html>",
        revision: 2,
      },
    };

    // Update with matching expected revision (1) succeeds
    const saved = projects.updateProject(user.id, project.metadata.id, updatedData, 1);
    expect(saved.metadata.revision).toBe(2);
    expect(saved.data.document.source).toContain("<h1>Updated Version</h1>");

    // Attempting to update with stale expected revision (1 instead of 2) throws conflict
    expect(() => {
      projects.updateProject(user.id, project.metadata.id, updatedData, 1);
    }).toThrow(/Revision conflict/);
  });

  it("renames and archives projects", async () => {
    const { user } = await auth.register({ email: "bob@proofui.com", name: "Bob" });
    const project = projects.createProject(user.id, "Initial Name");

    const renamed = projects.renameProject(user.id, project.metadata.id, "New Brand Identity");
    expect(renamed.name).toBe("New Brand Identity");

    // Archive project
    projects.setArchiveStatus(user.id, project.metadata.id, true);
    expect(projects.listProjects(user.id, false).length).toBe(0);
    expect(projects.listProjects(user.id, true).length).toBe(1);

    // Unarchive
    projects.setArchiveStatus(user.id, project.metadata.id, false);
    expect(projects.listProjects(user.id, false).length).toBe(1);
  });
});

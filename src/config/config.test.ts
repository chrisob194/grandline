import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// Override HOME so config reads/writes go to a temp dir
let tmpDir: string;

function setHome(dir: string): void {
  process.env["HOME"] = dir;
}

// Re-import modules after HOME is set
async function importConfig() {
  // Clear module cache by using dynamic import with cache busting
  const { readConfig, writeConfig, readProject, writeProject, listProjects, deleteProject, ensureGrandlineDir } =
    await import("./config.js");
  return { readConfig, writeConfig, readProject, writeProject, listProjects, deleteProject, ensureGrandlineDir };
}

describe("ensureGrandlineDir", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "grandline-test-"));
    setHome(tmpDir);
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates .grandline dirs and empty config.json", async () => {
    const { ensureGrandlineDir } = await importConfig();
    const result = await ensureGrandlineDir();
    expect(result.ok).toBe(true);

    const configExists = await fs.access(path.join(tmpDir, ".grandline", "config.json")).then(() => true).catch(() => false);
    expect(configExists).toBe(true);

    const projectsDirExists = await fs.stat(path.join(tmpDir, ".grandline", "projects")).then(s => s.isDirectory()).catch(() => false);
    expect(projectsDirExists).toBe(true);

    const reposDirExists = await fs.stat(path.join(tmpDir, ".grandline", "repos")).then(s => s.isDirectory()).catch(() => false);
    expect(reposDirExists).toBe(true);
  });

  it("does not overwrite existing config.json", async () => {
    const { ensureGrandlineDir, writeConfig, readConfig } = await importConfig();
    await ensureGrandlineDir();

    // Write a config with an agent
    await writeConfig({ agents: [{ name: "my-agent", bin: "/bin/agent" }] });

    // Call ensureGrandlineDir again
    await ensureGrandlineDir();

    const result = await readConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.agents).toHaveLength(1);
      expect(result.value.agents[0]?.name).toBe("my-agent");
    }
  });
});

describe("readConfig / writeConfig", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "grandline-test-"));
    setHome(tmpDir);
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty config when file does not exist", async () => {
    const { readConfig } = await importConfig();
    const result = await readConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.agents).toEqual([]);
    }
  });

  it("round-trips config", async () => {
    const { readConfig, writeConfig, ensureGrandlineDir } = await importConfig();
    await ensureGrandlineDir();

    const config = {
      agents: [{ name: "claude", bin: "/usr/bin/claude" }],
      defaultAgent: "claude",
    };
    const writeResult = await writeConfig(config);
    expect(writeResult.ok).toBe(true);

    const readResult = await readConfig();
    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value).toEqual(config);
    }
  });

  it("returns config-invalid for malformed JSON data", async () => {
    const { readConfig, ensureGrandlineDir } = await importConfig();
    await ensureGrandlineDir();

    // Write invalid structure (missing agents array)
    await fs.writeFile(
      path.join(tmpDir, ".grandline", "config.json"),
      JSON.stringify({ agents: "not-an-array" })
    );

    const result = await readConfig();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("config-invalid");
    }
  });
});

describe("readProject / writeProject", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "grandline-test-"));
    setHome(tmpDir);
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("round-trips project", async () => {
    const { readProject, writeProject } = await importConfig();

    const project = {
      name: "test-project",
      workspacePath: "/tmp/workspace/test-project",
      type: "multirepo" as const,
      repos: [
        { name: "my-repo", source: { kind: "local" as const, path: "/home/user/my-repo" } },
      ],
    };

    const writeResult = await writeProject(project);
    expect(writeResult.ok).toBe(true);

    const readResult = await readProject("test-project");
    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value).toEqual(project);
    }
  });

  it("returns project-not-found for missing project", async () => {
    const { readProject } = await importConfig();
    const result = await readProject("does-not-exist");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("project-not-found");
    }
  });
});

describe("listProjects", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "grandline-test-"));
    setHome(tmpDir);
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when no projects", async () => {
    const { listProjects } = await importConfig();
    const result = await listProjects();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });

  it("returns sorted project names", async () => {
    const { writeProject, listProjects } = await importConfig();

    for (const name of ["beta", "alpha", "gamma"]) {
      await writeProject({
        name,
        workspacePath: `/tmp/workspace/${name}`,
        type: "multirepo",
        repos: [],
      });
    }

    const result = await listProjects();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(["alpha", "beta", "gamma"]);
    }
  });
});

describe("deleteProject", () => {
  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "grandline-test-"));
    setHome(tmpDir);
  });
  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("removes project directory", async () => {
    const { writeProject, deleteProject, listProjects } = await importConfig();

    await writeProject({
      name: "to-delete",
      workspacePath: "/tmp/ws",
      type: "multirepo",
      repos: [],
    });

    let list = await listProjects();
    expect(list.ok && list.value).toContain("to-delete");

    const del = await deleteProject("to-delete");
    expect(del.ok).toBe(true);

    list = await listProjects();
    expect(list.ok && list.value).not.toContain("to-delete");
  });
});

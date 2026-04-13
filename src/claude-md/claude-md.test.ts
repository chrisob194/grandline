import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as path from "path";
import { buildGrandlineSection, writeWorkspaceClaude } from "./claude-md.js";
import { type Project } from "../config/index.js";

const testProject: Project = {
  name: "my-project",
  workspacePath: "/workspace/my-project",
  type: "multirepo",
  repos: [
    { name: "frontend", source: { kind: "local", path: "/home/user/frontend" } },
    { name: "backend", source: { kind: "remote", url: "https://github.com/org/backend" } },
  ],
};

describe("buildGrandlineSection", () => {
  it("includes project name as heading", () => {
    const content = buildGrandlineSection(testProject);
    expect(content).toContain("# my-project");
  });

  it("includes multirepo label", () => {
    const content = buildGrandlineSection(testProject);
    expect(content).toContain("Multi-repo project");
  });

  it("includes monorepo label for monorepo type", () => {
    const content = buildGrandlineSection({ ...testProject, type: "monorepo" });
    expect(content).toContain("Monorepo project");
  });

  it("includes repo names and sources in table", () => {
    const content = buildGrandlineSection(testProject);
    expect(content).toContain("| frontend | /home/user/frontend |");
    expect(content).toContain("| backend | https://github.com/org/backend |");
  });

  it("includes subpath source label", () => {
    const project: Project = {
      ...testProject,
      repos: [
        { name: "pkg", source: { kind: "subpath", url: "https://github.com/org/mono", subpath: "packages/pkg" } },
      ],
    };
    const content = buildGrandlineSection(project);
    expect(content).toContain("https://github.com/org/mono (packages/pkg)");
  });

  it("includes workspace root", () => {
    const content = buildGrandlineSection(testProject);
    expect(content).toContain("/workspace/my-project");
  });
});

describe("writeWorkspaceClaude", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = (await Bun.$`mktemp -d`.text()).trim();
  });
  afterEach(async () => {
    await Bun.$`rm -rf ${tmpDir}`;
  });

  it("writes full content when file does not exist", async () => {
    const result = await writeWorkspaceClaude(tmpDir, testProject);
    expect(result.ok).toBe(true);

    const content = await Bun.file(path.join(tmpDir, "CLAUDE.md")).text();
    expect(content).toContain("# my-project");
    expect(content).toContain("| frontend |");
    expect(content).not.toContain("<!-- logpose:start -->");
  });

  it("overwrites entirely when no fence in existing file", async () => {
    await Bun.write(
      path.join(tmpDir, "CLAUDE.md"),
      "# old content\n\nsome old text\n"
    );

    const result = await writeWorkspaceClaude(tmpDir, testProject);
    expect(result.ok).toBe(true);

    const content = await Bun.file(path.join(tmpDir, "CLAUDE.md")).text();
    expect(content).toContain("# my-project");
    expect(content).not.toContain("# old content");
    expect(content).not.toContain("some old text");
  });

  it("preserves logpose block when fence is present", async () => {
    const logposeBlock = `<!-- logpose:start -->
## Active Issue

| Field | Value |
|-------|-------|
| Issue | #42 |
<!-- logpose:end -->
`;
    const existing = "# old-project\n\nOld content.\n\n" + logposeBlock;
    await Bun.write(path.join(tmpDir, "CLAUDE.md"), existing);

    const result = await writeWorkspaceClaude(tmpDir, testProject);
    expect(result.ok).toBe(true);

    const content = await Bun.file(path.join(tmpDir, "CLAUDE.md")).text();
    // Grandline section updated
    expect(content).toContain("# my-project");
    expect(content).not.toContain("# old-project");
    // Logpose block intact
    expect(content).toContain("<!-- logpose:start -->");
    expect(content).toContain("<!-- logpose:end -->");
    expect(content).toContain("| Issue | #42 |");
  });

  it("updates project name while keeping logpose block intact", async () => {
    const logposeBlock = `<!-- logpose:start -->
## Working Mode

feature
<!-- logpose:end -->
`;
    const existing = "# original-name\n\nOld.\n\n" + logposeBlock;
    await Bun.write(path.join(tmpDir, "CLAUDE.md"), existing);

    const renamedProject: Project = { ...testProject, name: "renamed-project" };
    await writeWorkspaceClaude(tmpDir, renamedProject);

    const content = await Bun.file(path.join(tmpDir, "CLAUDE.md")).text();
    expect(content).toContain("# renamed-project");
    expect(content).not.toContain("# original-name");
    expect(content).toContain("feature");
    expect(content).toContain("<!-- logpose:end -->");
  });
});

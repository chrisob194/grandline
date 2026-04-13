import * as path from "path";
import { type Project, type RepoEntry } from "../config/index.js";
import { type Result } from "../config/config.js";

function sourceLabel(entry: RepoEntry): string {
  switch (entry.source.kind) {
    case "remote":
      return entry.source.url;
    case "local":
      return entry.source.path;
    case "subpath":
      return `${entry.source.url} (${entry.source.subpath})`;
  }
}

export function buildGrandlineSection(project: Project): string {
  const typeLabel = project.type === "monorepo" ? "Monorepo" : "Multi-repo";
  const rows = project.repos
    .map((r) => `| ${r.name} | ${sourceLabel(r)} |`)
    .join("\n");

  return `# ${project.name}

${typeLabel} project. Workspace root contains all repos as symlinks.

## Repos

| Name | Source |
|------|--------|
${rows}

## Workspace Root

${project.workspacePath}
`;
}

export async function writeWorkspaceClaude(
  workspacePath: string,
  project: Project
): Promise<Result<void>> {
  const filePath = path.join(workspacePath, "CLAUDE.md");
  const grandlineContent = buildGrandlineSection(project);

  let existing = "";
  try {
    existing = await Bun.file(filePath).text();
  } catch {
    // File does not exist — write from scratch
  }

  const fenceStart = "<!-- logpose:start -->";
  const fenceIdx = existing.indexOf(fenceStart);

  try {
    if (fenceIdx === -1) {
      await Bun.write(filePath, grandlineContent);
    } else {
      const logposeBlock = existing.slice(fenceIdx);
      await Bun.write(filePath, grandlineContent + "\n" + logposeBlock);
    }
    return { ok: true, value: undefined };
  } catch (err: unknown) {
    return { ok: false, error: { kind: "io-error", message: String(err) } };
  }
}

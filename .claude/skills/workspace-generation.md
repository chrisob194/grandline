---
name: workspace-generation
description: Use when implementing or modifying the code that writes the workspace CLAUDE.md — covers what to write, the fencing contract with logpose, and the detection algorithm
---

# Workspace CLAUDE.md Generation

## What Grandline Writes

Grandline writes the **top section** of the workspace `CLAUDE.md` on every agent launch.
Content is derived from `project.json`:

```markdown
# <project.name>

<project.type> project. Workspace root contains all repos as symlinks.

## Repos

| Name | Source |
|------|--------|
| <entry.name> | <entry.source.url or path> |
...

## Workspace Root

<project.workspacePath>
```

## Fencing Contract

Logpose owns a block at the bottom of the same file, fenced with HTML comment markers:

```
<!-- logpose:start -->
...logpose content (working mode, issue table, etc.)...
<!-- logpose:end -->
```

**Grandline's rule:** Never write inside or below `<!-- logpose:start -->`.

## Generation Algorithm

```ts
async function writeWorkspaceClaude(workspacePath: string, project: Project) {
  const filePath = path.join(workspacePath, "CLAUDE.md");
  const grandlineContent = buildGrandlineSection(project); // top section only

  let existing = "";
  try { existing = await fs.readFile(filePath, "utf-8"); } catch {}

  const fenceStart = "<!-- logpose:start -->";
  const fenceIdx = existing.indexOf(fenceStart);

  if (fenceIdx === -1) {
    // No logpose fence — write entire file
    await fs.writeFile(filePath, grandlineContent);
  } else {
    // Preserve everything from fence onwards
    const logposeBlock = existing.slice(fenceIdx);
    await fs.writeFile(filePath, grandlineContent + "\n" + logposeBlock);
  }
}
```

**Critical:** detect by string search, not line number — content above the fence changes with every project update.

## What NOT to Write

- Working mode, issue table, branch mappings → logpose-owned
- Per-repo `CLAUDE.md` content → future feature (auto-discovery), not implemented yet
- Any `<!-- logpose:... -->` markers → logpose writes and owns these

## Future: Per-Repo CLAUDE.md Auto-Discovery

Planned but not yet implemented: scan each repo root for its own `CLAUDE.md` and append it
to the workspace `CLAUDE.md` under a per-repo heading. The fencing contract still applies —
per-repo content goes above `<!-- logpose:start -->`.

## Testing Generation

1. Create a test workspace with a dummy `project.json`
2. Call `writeWorkspaceClaude` with no existing file → verify full content written
3. Manually add a `<!-- logpose:start -->...`<!-- logpose:end -->` block at the bottom
4. Call `writeWorkspaceClaude` again → verify grandline section updated, logpose block unchanged
5. Change project name and call again → verify name updated, logpose block still intact

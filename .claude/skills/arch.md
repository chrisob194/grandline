---
name: arch
description: Use when building, modifying, or navigating grandline's source — provides module map, CLI flow breakdown, config schema, and workspace composition logic
---

# grandline Architecture

## Module Map

```
src/
  cli/          ← Ink TUI entry point; three top-level flows
  workspace/    ← compose/teardown workspace dirs and symlinks
  config/       ← read/write ~/.grandline/ config with Zod validation
  claude-md/    ← generate workspace CLAUDE.md (fencing logic lives here)
  launch/       ← exec claude from workspace root
index.ts        ← CLI entry, Ink render
```

## Three CLI Flows

### 1. Launch Agent
1. Select project (from `config.json` projects list)
2. Select agent (from `config.json` agents list)
3. Compose workspace: ensure symlinks exist for all repos
4. Generate/update workspace `CLAUDE.md` (see `/workspace-generation` skill)
5. `exec claude` from workspace root

### 2. Manage Projects

```
Create  → prompt: name, workspacePath, type (monorepo|multirepo), repos[]
Edit    → add or remove repos from existing project
Delete  → remove project.json + workspace directory
```

### 3. Manage Agents

```
Add     → prompt: name, binary path
Remove  → remove from config.json agents list
```

## Config Schema

### `~/.grandline/config.json`

```ts
{
  agents: { name: string; bin: string }[];
  defaultAgent?: string;
}
```

### `~/.grandline/projects/<name>/project.json`

```ts
{
  name: string;
  workspacePath: string;           // absolute path to workspace dir
  type: "monorepo" | "multirepo";
  repos: RepoEntry[];
}

type RepoEntry = {
  name: string;                    // symlink name inside workspace
  source:
    | { kind: "remote"; url: string }     // cloned to ~/.grandline/repos/<name>/
    | { kind: "local"; path: string }     // symlinked directly
    | { kind: "subpath"; url: string; subpath: string }; // clone + symlink subdir
};
```

### `~/.grandline/projects/<name>/logpose.json`

Logpose-owned. Grandline reads it to discover if logpose is configured but never writes it.

## Workspace Composition

1. For each `RepoEntry` in `project.json`:
   - `remote` → clone to `~/.grandline/repos/<name>/` if not present, symlink to `workspace/<entry.name>`
   - `local` → symlink `entry.source.path` to `workspace/<entry.name>`
   - `subpath` → clone as above, symlink `~/.grandline/repos/<name>/<subpath>` to `workspace/<entry.name>`
2. Agent edits via symlinks go directly to real files — no indirection at write time

## What Grandline Does NOT Own

- `logpose.json` — logpose-owned config
- The `<!-- logpose:start -->` / `<!-- logpose:end -->` fenced block in workspace `CLAUDE.md`
- `.issues/` directory at workspace root — logpose-owned

## Key Invariants

- Workspace root is always **above** all repos, never inside one
- `project.json` is the single source of truth for workspace shape
- All config reads go through Zod validation — no raw `JSON.parse`

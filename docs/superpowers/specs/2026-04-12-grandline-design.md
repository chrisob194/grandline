# grandline — Design Spec

**Date:** 2026-04-12  
**Status:** Approved

---

## What It Is

grandline is a CLI for managing and launching coding agents across multi-repo projects.
It composes workspaces (symlinked repos above individual repos), auto-generates CLAUDE.md
at the workspace root, and launches agents from that root.

---

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Entry mode | Menu-first TUI | Discoverable; user picks flow from top menu |
| TUI library | @inkjs/ui | Official Ink component library; Select + TextInput |
| Arg parsing | Node.js built-in `parseArgs` | No extra deps for 2 flags |
| Error handling | Discriminated `Result<T>` union | Never throw for recoverable errors |
| Config validation | Zod | Safe, typed parsing of external JSON |
| Scope | Full system | All 3 flows in one pass |

---

## Entry Point

`grandline` renders a top-level Ink menu:

```
? What do you want to do?
❯ Launch Agent
  Manage Projects
  Manage Agents
  Exit
```

Selecting navigates to that flow. Escape returns to menu.

**Programmatic use (`--json`):** bypasses Ink, prints JSON, exits.
```
grandline --json --query list-projects
grandline --json --query list-agents
```

---

## CLI Flows

### Launch Agent
1. `<Select>` project from `~/.grandline/projects/`
2. `<Select>` agent from `config.json` agents list
3. Spinner → `composeWorkspace()` (symlinks + git clone)
4. Spinner → `writeWorkspaceClaude()` (fencing preserved)
5. `app.exit()` → `execAgent(bin, workspacePath)` — agent takes over stdio

### Manage Projects
- List projects (+ "Create new" + "← Back")
- Create: multi-step TextInput form (name → workspacePath → type → repos loop)
  - Per repo: name → source kind (remote/local/subpath) → source fields → "Add another?"
- Edit existing: Add repo / Remove repo / Delete project / ← Back
- Delete: confirm → `deleteProject()`

### Manage Agents
- List agents (+ "Add agent" + "← Back")
- Add: TextInput name + binary path → `writeConfig()`
- Remove: select → confirm → `writeConfig()`

---

## Module Map

```
src/
  config/
    schemas.ts        ← Zod schemas + TS types
    config.ts         ← readConfig, writeConfig, readProject, writeProject,
                         listProjects, deleteProject, ensureGrandlineDir
    config.test.ts
    index.ts
  workspace/
    workspace.ts      ← composeWorkspace (symlinks + git clone)
    workspace.test.ts
    index.ts
  claude-md/
    claude-md.ts      ← buildGrandlineSection, writeWorkspaceClaude
    claude-md.test.ts
    index.ts
  launch/
    launch.ts         ← execAgent(bin, workspacePath): never
    index.ts
  cli/
    app.tsx           ← top-level Ink app, screen router
    launch-flow.tsx
    projects-flow.tsx
    agents-flow.tsx
    index.ts
index.ts              ← parseArgs, --json path, Ink render
```

---

## Config Schema

### `~/.grandline/config.json`
```ts
{ agents: { name: string; bin: string }[]; defaultAgent?: string }
```

### `~/.grandline/projects/<name>/project.json`
```ts
{
  name: string;
  workspacePath: string;    // absolute path, always above all repos
  type: "monorepo" | "multirepo";
  repos: RepoEntry[];
}

type RepoEntry =
  | { name: string; source: { kind: "remote"; url: string } }
  | { name: string; source: { kind: "local"; path: string } }
  | { name: string; source: { kind: "subpath"; url: string; subpath: string } }
```

---

## CLAUDE.md Fencing Contract

Grandline owns the **top section** of workspace `CLAUDE.md`.
Logpose owns a fenced block at the bottom:

```
<!-- logpose:start -->
...logpose content...
<!-- logpose:end -->
```

**Rule:** detect fence by `indexOf` (not line number). If present, replace only content
above the fence. Never write inside or below it.

---

## Error Handling

```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

type AppError =
  | { kind: "config-not-found"; path: string }
  | { kind: "config-invalid"; issues: ZodIssue[] }
  | { kind: "project-not-found"; name: string }
  | { kind: "project-invalid"; issues: ZodIssue[] }
  | { kind: "io-error"; message: string }
  | { kind: "clone-failed"; url: string; stderr: string }
  | { kind: "symlink-failed"; target: string; dest: string; message: string }
  | { kind: "workspace-dir-error"; message: string };
```

---

## Invariants

- Workspace root always **above** all repos — never inside one
- All config reads through Zod — no raw `JSON.parse as T`
- `Result<T>` for all recoverable errors — no `throw`
- Ink: functional components, `useApp()` for exit, no side effects in render body
- `--json` output shape is stable across releases

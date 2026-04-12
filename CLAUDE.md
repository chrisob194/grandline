# grandline

CLI for managing and launching coding agents across multi-repo projects. Composes workspaces
(symlinked repos above individual repos), auto-generates CLAUDE.md at workspace root, and
launches Claude from that root.

## Stack

- Runtime: Bun
- Language: TypeScript (strict)
- TUI: Ink + React
- Tests: `bun test`

## Commands

| Command           | Purpose              |
|-------------------|----------------------|
| `bun install`     | Install dependencies |
| `bun run dev`     | Run CLI (dev mode)   |
| `bun test`        | Run tests            |
| `bun run build`   | Compile to dist/     |

## Architecture

Three top-level domains: **workspace composition** (clone/symlink repos), **config management**
(`~/.grandline/`), and **CLAUDE.md generation** (writes workspace context file on launch).

Config layout:
```
~/.grandline/
    config.json                  ← agents + global settings
    projects/<name>/
        project.json             ← grandline-owned: name, workspace path, repos[]
        logpose.json             ← logpose-owned: working mode, active issue
    repos/<name>/                ← cloned remote repos
```

Invoke the `/arch` skill for full module map and data flow.

## CLAUDE.md Generation — Critical Constraint

Grandline writes the **top section** of workspace `CLAUDE.md` files. Logpose owns a **fenced
block** at the bottom using HTML comment markers:

```
<!-- logpose:start -->
...logpose content...
<!-- logpose:end -->
```

**Rule:** Never write or overwrite content inside `<!-- logpose:start -->` / `<!-- logpose:end -->`.
Detect the fence via string search. If absent, write the full file. If present, replace only
content above `<!-- logpose:start -->` and leave the rest untouched.

Invoke the `/workspace-generation` skill for the full generation algorithm.

## Conventions

TypeScript strict mode throughout. Ink components for all TUI flows. Every command with
structured output must support a `--json` flag that bypasses Ink and prints JSON to stdout
(used by agents invoking grandline programmatically).

Invoke the `/conventions` skill for the full style guide and patterns.

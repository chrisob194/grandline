---
name: conventions
description: Use when writing or reviewing grandline TypeScript source — covers strict TS rules, Ink/React patterns, --json flag convention, error handling, Zod config, and test structure
---

# grandline Conventions

## TypeScript

- `strict: true` in `tsconfig.json` — no `any`, no implicit `any`
- Prefer `unknown` + type narrowing over `any` for external/parsed data
- Explicit return types on all exported functions
- No `!` non-null assertions — handle nullability explicitly

## File Organization

- One module per file; barrel `index.ts` per directory for public exports
- Internal helpers stay in the same file or a `_helpers.ts` sibling
- Co-locate tests: `foo.ts` → `foo.test.ts` in the same directory
- No deep import paths across module boundaries — import from barrel only

## Ink / React (TUI)

- Functional components only — no class components
- Use `useApp()` from ink for controlled exit (`app.exit()`)
- Each CLI flow (`launch`, `manage-projects`, `manage-agents`) is its own top-level component
- No side effects in render — use `useEffect` for async operations (file I/O, exec)
- Keep component files small; extract sub-components when a component exceeds ~80 lines

## `--json` Flag Convention

Every command with structured output **must** support `--json`:

```ts
if (flags.json) {
  // Bypass Ink entirely — print JSON to stdout and exit
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
// Otherwise render Ink component
```

`--json` output must be stable (same shape across releases) — agents depend on it.

## Error Handling

Use discriminated unions for expected failures — never `throw` for recoverable errors:

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppError };

type AppError =
  | { kind: "config-not-found"; path: string }
  | { kind: "workspace-missing"; workspacePath: string }
  | { kind: "repo-clone-failed"; url: string; stderr: string };
```

`throw` is reserved for truly unexpected/unrecoverable situations (programmer errors).

## Config I/O — Always Use Zod

```ts
import { z } from "zod";

const ProjectSchema = z.object({
  name: z.string(),
  workspacePath: z.string(),
  type: z.enum(["monorepo", "multirepo"]),
  repos: z.array(RepoEntrySchema),
});

// Never: JSON.parse(raw) as Project
// Always:
const result = ProjectSchema.safeParse(JSON.parse(raw));
if (!result.success) return { ok: false, error: { kind: "config-invalid", issues: result.error.issues } };
```

## Tests

- Use `bun test` (built-in, zero config)
- Test file naming: `*.test.ts` co-located with source
- Test the public interface, not internals
- For file I/O in tests: use `os.tmpdir()` — never write to project directories
- Prefer `describe` blocks per function/module, `it` blocks per scenario

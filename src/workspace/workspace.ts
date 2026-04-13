import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { type Project, type RepoEntry } from "../config/index.js";
import { type Result, reposDir } from "../config/config.js";

export type WorkspaceError =
  | { kind: "clone-failed"; url: string; stderr: string }
  | { kind: "symlink-failed"; target: string; dest: string; message: string }
  | { kind: "workspace-dir-error"; message: string }
  | { kind: "io-error"; message: string };

export type WorkspaceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: WorkspaceError };

async function cloneIfAbsent(url: string, dest: string): Promise<WorkspaceResult<void>> {
  try {
    await fs.access(dest);
    return { ok: true, value: undefined }; // already cloned
  } catch {
    // Needs clone
  }

  const proc = Bun.spawn(["git", "clone", url, dest], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    return { ok: false, error: { kind: "clone-failed", url, stderr } };
  }
  return { ok: true, value: undefined };
}

async function symlinkEntry(
  target: string,
  dest: string
): Promise<WorkspaceResult<void>> {
  try {
    const existing = await fs.lstat(dest).catch(() => null);
    if (existing) {
      if (existing.isSymbolicLink()) {
        const current = await fs.readlink(dest);
        if (current === target) {
          return { ok: true, value: undefined }; // already correct
        }
        await fs.unlink(dest); // wrong target — replace
      } else {
        // Not a symlink — leave it alone, report error
        return {
          ok: false,
          error: {
            kind: "symlink-failed",
            target,
            dest,
            message: `${dest} exists and is not a symlink`,
          },
        };
      }
    }
    await fs.symlink(target, dest);
    return { ok: true, value: undefined };
  } catch (err: unknown) {
    return {
      ok: false,
      error: { kind: "symlink-failed", target, dest, message: String(err) },
    };
  }
}

async function resolveTarget(entry: RepoEntry): Promise<WorkspaceResult<string>> {
  const { source } = entry;

  switch (source.kind) {
    case "local":
      return { ok: true, value: source.path };

    case "remote": {
      const dest = path.join(reposDir(), entry.name);
      const clone = await cloneIfAbsent(source.url, dest);
      if (!clone.ok) return clone;
      return { ok: true, value: dest };
    }

    case "subpath": {
      const dest = path.join(reposDir(), entry.name);
      const clone = await cloneIfAbsent(source.url, dest);
      if (!clone.ok) return clone;
      return { ok: true, value: path.join(dest, source.subpath) };
    }
  }
}

export async function composeWorkspace(project: Project): Promise<WorkspaceResult<void>> {
  const workspacePath = project.workspacePath.startsWith("~/")
    ? path.join(os.homedir(), project.workspacePath.slice(2))
    : project.workspacePath;

  // Ensure workspace directory exists
  try {
    await fs.mkdir(workspacePath, { recursive: true });
  } catch (err: unknown) {
    return { ok: false, error: { kind: "workspace-dir-error", message: String(err) } };
  }

  for (const entry of project.repos) {
    const targetResult = await resolveTarget(entry);
    if (!targetResult.ok) return targetResult;

    const dest = path.join(workspacePath, entry.name);
    const symlinkResult = await symlinkEntry(targetResult.value, dest);
    if (!symlinkResult.ok) return symlinkResult;
  }

  return { ok: true, value: undefined };
}

// Re-export Result type for compatibility
export type { Result };

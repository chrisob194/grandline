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
  const exists = (await Bun.$`test -d ${dest}`.nothrow()).exitCode === 0;
  if (exists) return { ok: true, value: undefined };

  try {
    await Bun.$`git clone ${url} ${dest}`;
    return { ok: true, value: undefined };
  } catch (err) {
    const stderr =
      err instanceof Error && "stderr" in err
        ? (err as { stderr: { toString(): string } }).stderr.toString()
        : String(err);
    return { ok: false, error: { kind: "clone-failed", url, stderr } };
  }
}

async function symlinkEntry(
  target: string,
  dest: string
): Promise<WorkspaceResult<void>> {
  try {
    const existsAny = (await Bun.$`test -e ${dest}`.nothrow()).exitCode === 0;
    if (existsAny) {
      const isLink = (await Bun.$`test -L ${dest}`.nothrow()).exitCode === 0;
      if (isLink) {
        const current = (await Bun.$`readlink ${dest}`.text()).trim();
        if (current === target) {
          return { ok: true, value: undefined }; // already correct
        }
        await Bun.$`rm ${dest}`; // wrong target — replace
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
    await Bun.$`ln -s ${target} ${dest}`;
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
    await Bun.$`mkdir -p ${workspacePath}`;
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

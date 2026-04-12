import * as fs from "fs/promises";
import * as path from "path";
import { type ZodIssue } from "zod";
import { ConfigSchema, ProjectSchema, type Config, type Project } from "./schemas.js";

// ─── Error types ─────────────────────────────────────────────────────────────

export type AppError =
  | { kind: "config-not-found"; path: string }
  | { kind: "config-invalid"; issues: ZodIssue[] }
  | { kind: "project-not-found"; name: string }
  | { kind: "project-invalid"; issues: ZodIssue[] }
  | { kind: "io-error"; message: string };

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppError };

// ─── Paths ───────────────────────────────────────────────────────────────────

export function grandlineDir(): string {
  return path.join(process.env["HOME"] ?? "/root", ".grandline");
}

export function configPath(): string {
  return path.join(grandlineDir(), "config.json");
}

export function projectDir(name: string): string {
  return path.join(grandlineDir(), "projects", name);
}

export function projectPath(name: string): string {
  return path.join(projectDir(name), "project.json");
}

export function reposDir(): string {
  return path.join(grandlineDir(), "repos");
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readJson(filePath: string): Promise<Result<unknown>> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false, error: { kind: "io-error", message: `Invalid JSON in ${filePath}` } };
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { ok: false, error: { kind: "config-not-found", path: filePath } };
    }
    return { ok: false, error: { kind: "io-error", message: String(err) } };
  }
}

async function writeJson(filePath: string, data: unknown): Promise<Result<void>> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return { ok: true, value: undefined };
  } catch (err: unknown) {
    return { ok: false, error: { kind: "io-error", message: String(err) } };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function ensureGrandlineDir(): Promise<Result<void>> {
  try {
    await fs.mkdir(path.join(grandlineDir(), "projects"), { recursive: true });
    await fs.mkdir(reposDir(), { recursive: true });
    // Create empty config if absent
    try {
      await fs.access(configPath());
    } catch {
      const empty: Config = { agents: [] };
      await fs.writeFile(configPath(), JSON.stringify(empty, null, 2));
    }
    return { ok: true, value: undefined };
  } catch (err: unknown) {
    return { ok: false, error: { kind: "io-error", message: String(err) } };
  }
}

export async function readConfig(): Promise<Result<Config>> {
  const jsonResult = await readJson(configPath());
  if (!jsonResult.ok) {
    if (jsonResult.error.kind === "config-not-found") {
      // Return empty config rather than error when file simply doesn't exist yet
      return { ok: true, value: { agents: [] } };
    }
    return jsonResult;
  }
  const parsed = ConfigSchema.safeParse(jsonResult.value);
  if (!parsed.success) {
    return { ok: false, error: { kind: "config-invalid", issues: parsed.error.issues } };
  }
  return { ok: true, value: parsed.data };
}

export async function writeConfig(config: Config): Promise<Result<void>> {
  return writeJson(configPath(), config);
}

export async function readProject(name: string): Promise<Result<Project>> {
  const jsonResult = await readJson(projectPath(name));
  if (!jsonResult.ok) {
    if (jsonResult.error.kind === "config-not-found") {
      return { ok: false, error: { kind: "project-not-found", name } };
    }
    return jsonResult;
  }
  const parsed = ProjectSchema.safeParse(jsonResult.value);
  if (!parsed.success) {
    return { ok: false, error: { kind: "project-invalid", issues: parsed.error.issues } };
  }
  return { ok: true, value: parsed.data };
}

export async function writeProject(project: Project): Promise<Result<void>> {
  return writeJson(projectPath(project.name), project);
}

export async function listProjects(): Promise<Result<string[]>> {
  const dir = path.join(grandlineDir(), "projects");
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const names = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    return { ok: true, value: names };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { ok: true, value: [] };
    }
    return { ok: false, error: { kind: "io-error", message: String(err) } };
  }
}

export async function deleteProject(name: string): Promise<Result<void>> {
  try {
    await fs.rm(projectDir(name), { recursive: true, force: true });
    return { ok: true, value: undefined };
  } catch (err: unknown) {
    return { ok: false, error: { kind: "io-error", message: String(err) } };
  }
}

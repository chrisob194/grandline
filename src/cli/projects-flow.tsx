import React, { useState, useEffect } from "react";
import * as os from "os";
import { Box, Text } from "ink";
import { Select, TextInput, Spinner } from "@inkjs/ui";
import { PathInput } from "./components/PathInput.js";
import {
  listProjects,
  readProject,
  writeProject,
  deleteProject,
  type Project,
  type RepoEntry,
} from "../config/index.js";

type Phase =
  | { step: "loading" }
  | { step: "list"; projects: string[] }
  | { step: "project-menu"; name: string; project: Project }
  | { step: "create-name" }
  | { step: "create-workspace"; name: string }
  | { step: "create-type"; name: string; workspacePath: string }
  | { step: "create-repo-name"; name: string; workspacePath: string; type: "monorepo" | "multirepo"; repos: RepoEntry[] }
  | { step: "create-repo-kind"; name: string; workspacePath: string; type: "monorepo" | "multirepo"; repos: RepoEntry[]; repoName: string }
  | { step: "create-repo-url"; name: string; workspacePath: string; type: "monorepo" | "multirepo"; repos: RepoEntry[]; repoName: string; kind: "remote" | "subpath" }
  | { step: "create-repo-subpath"; name: string; workspacePath: string; type: "monorepo" | "multirepo"; repos: RepoEntry[]; repoName: string; url: string }
  | { step: "create-repo-local-path"; name: string; workspacePath: string; type: "monorepo" | "multirepo"; repos: RepoEntry[]; repoName: string }
  | { step: "create-repo-another"; name: string; workspacePath: string; type: "monorepo" | "multirepo"; repos: RepoEntry[] }
  | { step: "add-repo-name"; project: Project }
  | { step: "add-repo-kind"; project: Project; repoName: string }
  | { step: "add-repo-url"; project: Project; repoName: string; kind: "remote" | "subpath" }
  | { step: "add-repo-subpath"; project: Project; repoName: string; url: string }
  | { step: "add-repo-local-path"; project: Project; repoName: string }
  | { step: "remove-repo"; project: Project }
  | { step: "confirm-delete"; project: Project }
  | { step: "saving" }
  | { step: "error"; message: string };

function Breadcrumb({ entries }: { entries: [string, string][] }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {entries.map(([k, v]) => (
        <Text key={k} dimColor>{k}: <Text bold>{v}</Text></Text>
      ))}
    </Box>
  );
}

interface ProjectsFlowProps {
  onBack: () => void;
}

export function ProjectsFlow({ onBack }: ProjectsFlowProps): React.ReactElement {
  const [phase, setPhase] = useState<Phase>({ step: "loading" });

  useEffect(() => {
    if (phase.step !== "loading") return;
    listProjects()
      .then((result) => {
        if (!result.ok) {
          setPhase({ step: "error", message: `Failed to list projects: ${result.error.kind}` });
          return;
        }
        setPhase({ step: "list", projects: result.value });
      })
      .catch((err: unknown) => setPhase({ step: "error", message: String(err) }));
  }, [phase.step]);

  async function saveProject(project: Project): Promise<void> {
    setPhase({ step: "saving" });
    const result = await writeProject(project);
    if (!result.ok) {
      setPhase({ step: "error", message: `Failed to save project: ${result.error.kind}` });
      return;
    }
    setPhase({ step: "loading" });
  }

  if (phase.step === "loading" || phase.step === "saving") {
    return <Spinner label={phase.step === "saving" ? "Saving…" : "Loading…"} />;
  }

  // ── List ──────────────────────────────────────────────────────────────────
  if (phase.step === "list") {
    const options = [
      ...phase.projects.map((p) => ({ label: p, value: `project:${p}` })),
      { label: "+ Create new project", value: "__create__" },
      { label: "← Back", value: "__back__" },
    ];
    return (
      <Box flexDirection="column">
        <Text bold>Projects{phase.projects.length === 0 ? " (none)" : ""}:</Text>
        <Select
          options={options}
          onChange={(value) => {
            if (value === "__back__") { onBack(); return; }
            if (value === "__create__") { setPhase({ step: "create-name" }); return; }
            const name = value.slice("project:".length);
            readProject(name)
              .then((result) => {
                if (!result.ok) {
                  setPhase({ step: "error", message: `Project not found: ${name}` });
                  return;
                }
                setPhase({ step: "project-menu", name, project: result.value });
              })
              .catch((err: unknown) => setPhase({ step: "error", message: String(err) }));
          }}
        />
      </Box>
    );
  }

  // ── Project menu ──────────────────────────────────────────────────────────
  if (phase.step === "project-menu") {
    const { project } = phase;
    return (
      <Box flexDirection="column">
        <Text bold>{project.name}</Text>
        <Text dimColor>{project.type} · {project.repos.length} repo{project.repos.length !== 1 ? "s" : ""}</Text>
        <Select
          options={[
            { label: "Add repo", value: "add" },
            { label: "Remove repo", value: "remove" },
            { label: "Delete project", value: "delete" },
            { label: "← Back", value: "back" },
          ]}
          onChange={(value) => {
            if (value === "back") { setPhase({ step: "loading" }); return; }
            if (value === "add") { setPhase({ step: "add-repo-name", project }); return; }
            if (value === "remove") { setPhase({ step: "remove-repo", project }); return; }
            if (value === "delete") { setPhase({ step: "confirm-delete", project }); return; }
          }}
        />
      </Box>
    );
  }

  // ── Create: name ──────────────────────────────────────────────────────────
  if (phase.step === "create-name") {
    return (
      <Box flexDirection="column">
        <Text bold>Project name:</Text>
        <TextInput placeholder="e.g. my-project" onSubmit={(v) => { if (v.trim()) setPhase({ step: "create-workspace", name: v.trim() }); }} />
      </Box>
    );
  }

  // ── Create: workspace path ────────────────────────────────────────────────
  if (phase.step === "create-workspace") {
    const { name } = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", name]]} />
        <Text bold>Workspace path (absolute):</Text>
        <PathInput placeholder={`${os.homedir()}/workspaces/project`} onSubmit={(v) => { if (v.trim()) setPhase({ step: "create-type", name, workspacePath: v.trim() }); }} />
      </Box>
    );
  }

  // ── Create: type ──────────────────────────────────────────────────────────
  if (phase.step === "create-type") {
    const { name, workspacePath } = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", name], ["Workspace", workspacePath]]} />
        <Text bold>Project type:</Text>
        <Select
          options={[
            { label: "multirepo", value: "multirepo" },
            { label: "monorepo", value: "monorepo" },
          ]}
          onChange={(type) => setPhase({
            step: "create-repo-name",
            name,
            workspacePath,
            type: type as "monorepo" | "multirepo",
            repos: [],
          })}
        />
      </Box>
    );
  }

  // ── Create / Add: repo name ───────────────────────────────────────────────
  if (phase.step === "create-repo-name") {
    const rest = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", rest.name], ["Workspace", rest.workspacePath], ["Type", rest.type]]} />
        {rest.repos.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            {rest.repos.map((r) => <Text key={r.name} dimColor>  + {r.name}</Text>)}
          </Box>
        )}
        <Text bold>Repo name (symlink name in workspace):</Text>
        <TextInput placeholder="e.g. frontend" onSubmit={(v) => {
          if (v.trim()) setPhase({ ...rest, step: "create-repo-kind", repoName: v.trim() });
        }} />
      </Box>
    );
  }

  // ── Create: repo source kind ──────────────────────────────────────────────
  if (phase.step === "create-repo-kind") {
    const rest = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", rest.name], ["Workspace", rest.workspacePath], ["Type", rest.type], ["Repo", rest.repoName]]} />
        <Text bold>Source kind for {phase.repoName}:</Text>
        <Select
          options={[
            { label: "local — symlink an existing local path", value: "local" },
            { label: "remote — clone a git URL", value: "remote" },
            { label: "subpath — clone a git URL and symlink a subdir", value: "subpath" },
          ]}
          onChange={(kind) => {
            if (kind === "local") { setPhase({ ...rest, step: "create-repo-local-path" }); return; }
            setPhase({ ...rest, step: "create-repo-url", kind: kind as "remote" | "subpath" });
          }}
        />
      </Box>
    );
  }

  // ── Create: repo URL ──────────────────────────────────────────────────────
  if (phase.step === "create-repo-url") {
    const rest = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", rest.name], ["Workspace", rest.workspacePath], ["Type", rest.type], ["Repo", rest.repoName], ["Source", rest.kind]]} />
        <Text bold>Git URL:</Text>
        <TextInput placeholder="https://github.com/org/repo" onSubmit={(v) => {
          if (!v.trim()) return;
          if (rest.kind === "subpath") {
            setPhase({ ...rest, step: "create-repo-subpath", url: v.trim() });
          } else {
            const entry: RepoEntry = { name: rest.repoName, source: { kind: "remote", url: v.trim() } };
            setPhase({ ...rest, step: "create-repo-another", repos: [...rest.repos, entry] });
          }
        }} />
      </Box>
    );
  }

  // ── Create: repo subpath ──────────────────────────────────────────────────
  if (phase.step === "create-repo-subpath") {
    const rest = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", rest.name], ["Workspace", rest.workspacePath], ["Type", rest.type], ["Repo", rest.repoName], ["URL", rest.url]]} />
        <Text bold>Subpath within repo:</Text>
        <TextInput placeholder="packages/my-pkg" onSubmit={(v) => {
          if (!v.trim()) return;
          const entry: RepoEntry = { name: rest.repoName, source: { kind: "subpath", url: rest.url, subpath: v.trim() } };
          setPhase({ name: rest.name, workspacePath: rest.workspacePath, type: rest.type, step: "create-repo-another", repos: [...rest.repos, entry] });
        }} />
      </Box>
    );
  }

  // ── Create: repo local path ───────────────────────────────────────────────
  if (phase.step === "create-repo-local-path") {
    const rest = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", rest.name], ["Workspace", rest.workspacePath], ["Type", rest.type], ["Repo", rest.repoName], ["Source", "local"]]} />
        <Text bold>Local path to repo:</Text>
        <PathInput placeholder="/home/user/my-repo" onSubmit={(v) => {
          if (!v.trim()) return;
          const entry: RepoEntry = { name: rest.repoName, source: { kind: "local", path: v.trim() } };
          setPhase({ ...rest, step: "create-repo-another", repos: [...rest.repos, entry] });
        }} />
      </Box>
    );
  }

  // ── Create: add another repo? ─────────────────────────────────────────────
  if (phase.step === "create-repo-another") {
    const { name, workspacePath, type, repos } = phase;
    return (
      <Box flexDirection="column">
        <Text>Added {repos.length} repo{repos.length !== 1 ? "s" : ""}. Add another?</Text>
        <Select
          options={[
            { label: "Yes, add another repo", value: "yes" },
            { label: "No, save project", value: "no" },
          ]}
          onChange={(value) => {
            if (value === "yes") {
              setPhase({ step: "create-repo-name", name, workspacePath, type, repos });
              return;
            }
            saveProject({ name, workspacePath, type, repos }).catch((err: unknown) =>
              setPhase({ step: "error", message: String(err) })
            );
          }}
        />
      </Box>
    );
  }

  // ── Add repo to existing project ──────────────────────────────────────────
  if (phase.step === "add-repo-name") {
    const { project } = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", project.name]]} />
        <Text bold>New repo name:</Text>
        <TextInput placeholder="e.g. backend" onSubmit={(v) => {
          if (v.trim()) setPhase({ step: "add-repo-kind", project, repoName: v.trim() });
        }} />
      </Box>
    );
  }

  if (phase.step === "add-repo-kind") {
    const { project, repoName } = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", project.name], ["Repo", repoName]]} />
        <Text bold>Source kind for {repoName}:</Text>
        <Select
          options={[
            { label: "local", value: "local" },
            { label: "remote", value: "remote" },
            { label: "subpath", value: "subpath" },
          ]}
          onChange={(kind) => {
            if (kind === "local") { setPhase({ step: "add-repo-local-path", project, repoName }); return; }
            setPhase({ step: "add-repo-url", project, repoName, kind: kind as "remote" | "subpath" });
          }}
        />
      </Box>
    );
  }

  if (phase.step === "add-repo-url") {
    const { project, repoName, kind } = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", project.name], ["Repo", repoName], ["Source", kind]]} />
        <Text bold>Git URL:</Text>
        <TextInput placeholder="https://github.com/org/repo" onSubmit={(v) => {
          if (!v.trim()) return;
          if (kind === "subpath") {
            setPhase({ step: "add-repo-subpath", project, repoName, url: v.trim() });
          } else {
            const entry: RepoEntry = { name: repoName, source: { kind: "remote", url: v.trim() } };
            saveProject({ ...project, repos: [...project.repos, entry] }).catch((err: unknown) =>
              setPhase({ step: "error", message: String(err) })
            );
          }
        }} />
      </Box>
    );
  }

  if (phase.step === "add-repo-subpath") {
    const { project, repoName, url } = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", project.name], ["Repo", repoName], ["URL", url]]} />
        <Text bold>Subpath:</Text>
        <TextInput placeholder="packages/my-pkg" onSubmit={(v) => {
          if (!v.trim()) return;
          const entry: RepoEntry = { name: repoName, source: { kind: "subpath", url, subpath: v.trim() } };
          saveProject({ ...project, repos: [...project.repos, entry] }).catch((err: unknown) =>
            setPhase({ step: "error", message: String(err) })
          );
        }} />
      </Box>
    );
  }

  if (phase.step === "add-repo-local-path") {
    const { project, repoName } = phase;
    return (
      <Box flexDirection="column">
        <Breadcrumb entries={[["Project", project.name], ["Repo", repoName], ["Source", "local"]]} />
        <Text bold>Local path:</Text>
        <PathInput placeholder="/home/user/my-repo" onSubmit={(v) => {
          if (!v.trim()) return;
          const entry: RepoEntry = { name: repoName, source: { kind: "local", path: v.trim() } };
          saveProject({ ...project, repos: [...project.repos, entry] }).catch((err: unknown) =>
            setPhase({ step: "error", message: String(err) })
          );
        }} />
      </Box>
    );
  }

  // ── Remove repo ───────────────────────────────────────────────────────────
  if (phase.step === "remove-repo") {
    const { project } = phase;
    if (project.repos.length === 0) {
      return (
        <Box flexDirection="column">
          <Text>No repos to remove.</Text>
          <Select options={[{ label: "← Back", value: "back" }]} onChange={() => setPhase({ step: "project-menu", name: project.name, project })} />
        </Box>
      );
    }
    return (
      <Box flexDirection="column">
        <Text bold>Select repo to remove:</Text>
        <Select
          options={[
            ...project.repos.map((r) => ({ label: r.name, value: r.name })),
            { label: "← Back", value: "__back__" },
          ]}
          onChange={(name) => {
            if (name === "__back__") { setPhase({ step: "project-menu", name: project.name, project }); return; }
            const updated: Project = { ...project, repos: project.repos.filter((r) => r.name !== name) };
            saveProject(updated).catch((err: unknown) =>
              setPhase({ step: "error", message: String(err) })
            );
          }}
        />
      </Box>
    );
  }

  // ── Confirm delete ────────────────────────────────────────────────────────
  if (phase.step === "confirm-delete") {
    const { project } = phase;
    return (
      <Box flexDirection="column">
        <Text>Delete project <Text bold>{project.name}</Text>? This removes the project config.</Text>
        <Select
          options={[
            { label: "Yes, delete", value: "yes" },
            { label: "No, cancel", value: "no" },
          ]}
          onChange={(value) => {
            if (value === "no") { setPhase({ step: "project-menu", name: project.name, project }); return; }
            setPhase({ step: "saving" });
            deleteProject(project.name)
              .then((result) => {
                if (!result.ok) {
                  setPhase({ step: "error", message: `Failed to delete: ${result.error.kind}` });
                  return;
                }
                setPhase({ step: "loading" });
              })
              .catch((err: unknown) => setPhase({ step: "error", message: String(err) }));
          }}
        />
      </Box>
    );
  }

  // error
  return (
    <Box flexDirection="column">
      <Text color="red">{phase.message}</Text>
      <Select
        options={[{ label: "← Back", value: "back" }]}
        onChange={() => onBack()}
      />
    </Box>
  );
}

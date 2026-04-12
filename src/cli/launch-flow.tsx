import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { Select, Spinner } from "@inkjs/ui";
import { listProjects, readConfig, readProject } from "../config/index.js";
import { composeWorkspace } from "../workspace/index.js";
import { writeWorkspaceClaude } from "../claude-md/index.js";
import { execAgent } from "../launch/index.js";

type Phase =
  | { step: "loading" }
  | { step: "select-project"; projects: string[] }
  | { step: "select-agent"; project: string; agents: { name: string; bin: string }[] }
  | { step: "composing"; project: string; agentBin: string; workspacePath: string }
  | { step: "generating"; project: string; agentBin: string; workspacePath: string }
  | { step: "error"; message: string };

interface LaunchFlowProps {
  onBack: () => void;
}

export function LaunchFlow({ onBack }: LaunchFlowProps): React.ReactElement {
  const { exit } = useApp();
  const [phase, setPhase] = useState<Phase>({ step: "loading" });

  useEffect(() => {
    if (phase.step !== "loading") return;

    async function load(): Promise<void> {
      const [projectsResult, configResult] = await Promise.all([
        listProjects(),
        readConfig(),
      ]);

      if (!projectsResult.ok) {
        setPhase({ step: "error", message: `Failed to list projects: ${projectsResult.error.kind}` });
        return;
      }
      if (!configResult.ok) {
        setPhase({ step: "error", message: `Failed to read config: ${configResult.error.kind}` });
        return;
      }

      if (projectsResult.value.length === 0) {
        setPhase({ step: "error", message: "No projects found. Add a project first via Manage Projects." });
        return;
      }
      if (configResult.value.agents.length === 0) {
        setPhase({ step: "error", message: "No agents configured. Add an agent first via Manage Agents." });
        return;
      }

      setPhase({ step: "select-project", projects: projectsResult.value });
    }

    load().catch((err: unknown) => {
      setPhase({ step: "error", message: String(err) });
    });
  }, [phase.step]);

  useEffect(() => {
    if (phase.step !== "composing") return;
    const { project, agentBin, workspacePath } = phase;

    async function compose(): Promise<void> {
      const projectResult = await readProject(project);
      if (!projectResult.ok) {
        setPhase({ step: "error", message: `Project not found: ${project}` });
        return;
      }
      const composeResult = await composeWorkspace(projectResult.value);
      if (!composeResult.ok) {
        setPhase({ step: "error", message: `Workspace compose failed: ${composeResult.error.kind}` });
        return;
      }
      setPhase({ step: "generating", project, agentBin, workspacePath });
    }

    compose().catch((err: unknown) => {
      setPhase({ step: "error", message: String(err) });
    });
  }, [phase.step === "composing" ? phase : null]);

  useEffect(() => {
    if (phase.step !== "generating") return;
    const { project, agentBin, workspacePath } = phase;

    async function generate(): Promise<void> {
      const projectResult = await readProject(project);
      if (!projectResult.ok) {
        setPhase({ step: "error", message: `Project not found: ${project}` });
        return;
      }
      const genResult = await writeWorkspaceClaude(workspacePath, projectResult.value);
      if (!genResult.ok) {
        setPhase({ step: "error", message: `CLAUDE.md generation failed: ${genResult.error.kind}` });
        return;
      }
      // Launch: exit Ink then exec agent
      exit();
      execAgent(agentBin, workspacePath);
    }

    generate().catch((err: unknown) => {
      setPhase({ step: "error", message: String(err) });
    });
  }, [phase.step === "generating" ? phase : null]);

  if (phase.step === "loading") {
    return <Spinner label="Loading…" />;
  }

  if (phase.step === "select-project") {
    return (
      <Box flexDirection="column">
        <Text bold>Select project:</Text>
        <Select
          options={[
            ...phase.projects.map((p) => ({ label: p, value: p })),
            { label: "← Back", value: "__back__" },
          ]}
          onChange={(value) => {
            if (value === "__back__") {
              onBack();
              return;
            }
            setPhase({ step: "loading" });
            // Reload to fetch agents for selected project
            readConfig().then((configResult) => {
              if (!configResult.ok) {
                setPhase({ step: "error", message: "Failed to read config" });
                return;
              }
              setPhase({
                step: "select-agent",
                project: value,
                agents: configResult.value.agents,
              });
            }).catch((err: unknown) => {
              setPhase({ step: "error", message: String(err) });
            });
          }}
        />
      </Box>
    );
  }

  if (phase.step === "select-agent") {
    const { project, agents } = phase;
    return (
      <Box flexDirection="column">
        <Text bold>Select agent:</Text>
        <Select
          options={[
            ...agents.map((a) => ({ label: `${a.name}  (${a.bin})`, value: a.bin })),
            { label: "← Back", value: "__back__" },
          ]}
          onChange={(agentBin) => {
            if (agentBin === "__back__") {
              setPhase({ step: "loading" });
              return;
            }
            // Fetch workspacePath from project config
            readProject(project).then((pr) => {
              if (!pr.ok) {
                setPhase({ step: "error", message: `Project not found: ${project}` });
                return;
              }
              setPhase({
                step: "composing",
                project,
                agentBin,
                workspacePath: pr.value.workspacePath,
              });
            }).catch((err: unknown) => {
              setPhase({ step: "error", message: String(err) });
            });
          }}
        />
      </Box>
    );
  }

  if (phase.step === "composing") {
    return <Spinner label="Composing workspace…" />;
  }

  if (phase.step === "generating") {
    return <Spinner label="Generating CLAUDE.md…" />;
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

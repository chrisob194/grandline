import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Select, TextInput, Spinner } from "@inkjs/ui";
import { readConfig, writeConfig, type Agent } from "../config/index.js";

type Phase =
  | { step: "loading" }
  | { step: "list"; agents: Agent[] }
  | { step: "add-name" }
  | { step: "confirm-remove"; agent: Agent; agents: Agent[] }
  | { step: "saving" }
  | { step: "error"; message: string };

interface AgentsFlowProps {
  onBack: () => void;
}

export function AgentsFlow({ onBack }: AgentsFlowProps): React.ReactElement {
  const [phase, setPhase] = useState<Phase>({ step: "loading" });

  useEffect(() => {
    if (phase.step !== "loading") return;
    readConfig()
      .then((result) => {
        if (!result.ok) {
          setPhase({ step: "error", message: `Failed to read config: ${result.error.kind}` });
          return;
        }
        setPhase({ step: "list", agents: result.value.agents });
      })
      .catch((err: unknown) => {
        setPhase({ step: "error", message: String(err) });
      });
  }, [phase.step]);

  if (phase.step === "loading" || phase.step === "saving") {
    return <Spinner label={phase.step === "saving" ? "Saving…" : "Loading…"} />;
  }

  if (phase.step === "list") {
    const { agents } = phase;
    const options = [
      ...agents.map((a) => ({ label: a.name, value: `agent:${a.name}` })),
      { label: "+ Add agent", value: "__add__" },
      { label: "← Back", value: "__back__" },
    ];
    return (
      <Box flexDirection="column">
        <Text bold>Agents{agents.length === 0 ? " (none)" : ""}:</Text>
        <Select
          options={options}
          onChange={(value) => {
            if (value === "__back__") { onBack(); return; }
            if (value === "__add__") { setPhase({ step: "add-name" }); return; }
            const name = value.slice("agent:".length);
            const agent = agents.find((a) => a.name === name);
            if (agent) setPhase({ step: "confirm-remove", agent, agents });
          }}
        />
      </Box>
    );
  }

  if (phase.step === "add-name") {
    return (
      <Box flexDirection="column">
        <Text bold>Agent name:</Text>
        <TextInput
          placeholder="e.g. claude"
          onSubmit={(name) => {
            if (!name.trim()) return;
            setPhase({ step: "saving" });
            readConfig()
              .then(async (result) => {
                const config = result.ok ? result.value : { agents: [] };
                const updated = {
                  ...config,
                  agents: [...config.agents, { name: name.trim(), bin: name.trim() }],
                };
                const writeResult = await writeConfig(updated);
                if (!writeResult.ok) {
                  setPhase({ step: "error", message: `Failed to save: ${writeResult.error.kind}` });
                  return;
                }
                setPhase({ step: "loading" });
              })
              .catch((err: unknown) => {
                setPhase({ step: "error", message: String(err) });
              });
          }}
        />
      </Box>
    );
  }

  if (phase.step === "confirm-remove") {
    const { agent, agents } = phase;
    return (
      <Box flexDirection="column">
        <Text>Remove agent <Text bold>{agent.name}</Text>?</Text>
        <Select
          options={[
            { label: "Yes, remove", value: "yes" },
            { label: "No, cancel", value: "no" },
          ]}
          onChange={(value) => {
            if (value === "no") { setPhase({ step: "list", agents }); return; }
            setPhase({ step: "saving" });
            const updated = { agents: agents.filter((a) => a.name !== agent.name) };
            writeConfig(updated)
              .then((result) => {
                if (!result.ok) {
                  setPhase({ step: "error", message: `Failed to save: ${result.error.kind}` });
                  return;
                }
                setPhase({ step: "loading" });
              })
              .catch((err: unknown) => {
                setPhase({ step: "error", message: String(err) });
              });
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

import React, { useState } from "react";
import { Box, Text, useApp } from "ink";
import { Select } from "@inkjs/ui";
import { LaunchFlow } from "./launch-flow.js";
import { ProjectsFlow } from "./projects-flow.js";
import { AgentsFlow } from "./agents-flow.js";

type Screen = "menu" | "launch" | "projects" | "agents";

export function App(): React.ReactElement {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>("menu");

  if (screen === "launch") {
    return <LaunchFlow onBack={() => setScreen("menu")} />;
  }
  if (screen === "projects") {
    return <ProjectsFlow onBack={() => setScreen("menu")} />;
  }
  if (screen === "agents") {
    return <AgentsFlow onBack={() => setScreen("menu")} />;
  }

  return (
    <Box flexDirection="column">
      <Text bold>grandline</Text>
      <Select
        options={[
          { label: "Launch Agent", value: "launch" },
          { label: "Manage Projects", value: "projects" },
          { label: "Manage Agents", value: "agents" },
          { label: "Exit", value: "exit" },
        ]}
        onChange={(value) => {
          if (value === "exit") { exit(); return; }
          setScreen(value as Screen);
        }}
      />
    </Box>
  );
}

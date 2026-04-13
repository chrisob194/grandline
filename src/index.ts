#!/usr/bin/env bun
import { parseArgs } from "util";
import { listProjects, readConfig, ensureGrandlineDir } from "./config/index.js";

const { values: flags } = parseArgs({
  args: process.argv.slice(2),
  options: {
    json: { type: "boolean", default: false },
    query: { type: "string" },
  },
  strict: false,
});

async function main(): Promise<void> {
  await ensureGrandlineDir();

  if (flags.json) {
    const query = flags.query;

    if (query === "list-projects") {
      const result = await listProjects();
      if (!result.ok) {
        console.error(JSON.stringify({ error: result.error }));
        process.exit(1);
      }
      console.log(JSON.stringify({ projects: result.value }, null, 2));
      process.exit(0);
    }

    if (query === "list-agents") {
      const result = await readConfig();
      if (!result.ok) {
        console.error(JSON.stringify({ error: result.error }));
        process.exit(1);
      }
      console.log(JSON.stringify({ agents: result.value.agents }, null, 2));
      process.exit(0);
    }

    console.error(JSON.stringify({ error: { kind: "unknown-query", query } }));
    process.exit(1);
  }

  // Interactive TUI
  const { render } = await import("ink");
  const { App } = await import("./cli/app.js");
  const { createElement } = await import("react");
  render(createElement(App));
}

main().catch((err: unknown) => {
  console.error(String(err));
  process.exit(1);
});

export function execAgent(agentBin: string, workspacePath: string): never {
  const result = Bun.spawnSync([agentBin], {
    cwd: workspacePath,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(result.exitCode ?? 0);
}

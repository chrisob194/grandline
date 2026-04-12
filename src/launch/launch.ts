export function execAgent(agentBin: string, workspacePath: string): never {
  const proc = Bun.spawn([agentBin], {
    cwd: workspacePath,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  proc.exited.then((code) => {
    process.exit(code ?? 0);
  });

  // Block — process.exit called in the .then above
  // This function is declared never; the process will exit via the proc
  // Bun's event loop keeps running until the child exits
  throw new Error("unreachable");
}

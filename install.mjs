import { spawnSync } from "node:child_process";
// Separate packages avoid requiring Windows symlink privileges for workspaces.
for (const dir of ["client", "server"]) {
  const result = spawnSync(
    process.execPath,
    [
      process.env.npm_execpath,
      "install",
      "--prefix",
      dir,
      "--no-audit",
      "--no-fund",
    ],
    { stdio: "inherit", env: process.env },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

import { mkdir, readFile, writeFile, unlink, rmdir } from "node:fs/promises";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { safePath, digest } from "./files.mjs";
export async function acquireLock(root, resource, owner = {}) {
  if (
    !/^(repo-admin|integration|card:[A-Za-z0-9_-]+|graph:[A-Za-z0-9_-]+|journal:[A-Za-z0-9_-]+)$/.test(
      resource,
    )
  )
    throw Error("Unknown lock resource");
  const path = await safePath(root, "locks/" + digest(resource), true);
  await mkdir(path);
  const token = randomUUID();
  const file = path + "/owner.json";
  await writeFile(
    file,
    JSON.stringify({
      ...owner,
      resource,
      pid: process.pid,
      hostname: hostname(),
      token,
      acquiredAt: new Date().toISOString(),
    }),
    { flag: "wx", mode: 0o600 },
  );
  return {
    async release() {
      const found = JSON.parse(await readFile(file));
      if (found.token !== token)
        throw Error("Lock ownership changed; retained");
      await unlink(file);
      await rmdir(path);
    },
  };
}

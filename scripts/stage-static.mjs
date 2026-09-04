import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const source = resolve("apps/web/out");
const destination = resolve("out");

if (!existsSync(source)) {
  throw new Error("Missing apps/web/out; run the web production build first.");
}

rmSync(destination, { force: true, recursive: true });
cpSync(source, destination, { recursive: true });

console.log("Staged the static Site export in out/.");

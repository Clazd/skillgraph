import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Group { label: string; all: string[] }
interface Structure { id: string; unlock_rules: Group[]; builds_on: Array<{ id: string; strength: number; note: string }> }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetGenerated = path.join(root, "packages", "dataset", "generated");
const validationDirectory = path.join(root, "packages", "dataset", "validation");
const structure = JSON.parse(await readFile(path.join(datasetGenerated, "structure-pre-reduction.json"), "utf8")) as Structure[];

const edges = new Set<string>();
for (const target of structure) for (const group of target.unlock_rules) for (const source of group.all) edges.add(`${source}\t${target.id}`);
const adjacency = new Map<string, Set<string>>();
for (const edge of edges) {
  const [from, to] = edge.split("\t") as [string, string];
  adjacency.set(from, new Set([...(adjacency.get(from) ?? []), to]));
}
function hasAlternatePath(source: string, target: string, skipped: string): boolean {
  const queue = [source]; const seen = new Set([source]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const to of adjacency.get(current) ?? []) {
      const edge = `${current}\t${to}`;
      if (edge === skipped) continue;
      if (to === target) return true;
      if (!seen.has(to)) { seen.add(to); queue.push(to); }
    }
  }
  return false;
}

const removed: Array<{ from: string; to: string; reason: string }> = [];
for (const edge of [...edges].sort()) {
  const [from, to] = edge.split("\t") as [string, string];
  if (hasAlternatePath(from, to, edge)) {
    edges.delete(edge);
    adjacency.get(from)?.delete(to);
    removed.push({ from, to, reason: "An alternate hard path already implies this prerequisite." });
  }
}
const reduced = structure.map((record) => ({
  ...record,
  unlock_rules: record.unlock_rules.map((group) => ({ ...group, all: group.all.filter((source) => edges.has(`${source}\t${record.id}`)) })).filter((group) => group.all.length > 0),
}));
await writeFile(path.join(datasetGenerated, "structure.json"), `${JSON.stringify(reduced, null, 2)}\n`, "utf8");
await writeFile(path.join(validationDirectory, "transitive-reduction.json"), `${JSON.stringify({ removed_count: removed.length, removed }, null, 2)}\n`, "utf8");
console.log(`Transitive reduction removed ${removed.length} of ${edges.size + removed.length} hard edges; ${edges.size} remain.`);

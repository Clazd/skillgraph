import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Group { label: string; all: string[]; any_of?: { n: number; of: string[] } }
interface Structure { id: string; unlock_rules: Group[]; builds_on: unknown[] }
interface Adjudication { from: string; to: string; score: number }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
const structurePath = path.join(datasetRoot, "generated", "structure.json");
const structure = JSON.parse(await readFile(structurePath, "utf8")) as Structure[];
const adjudications = (await readFile(path.join(datasetRoot, "validation", "adjudications.jsonl"), "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Adjudication);
const confidence = new Map(adjudications.map((item) => [`${item.from}\t${item.to}`, item.score]));
const broken: Array<{ cycle: string[]; removed: { from: string; to: string }; confidence: number; reason: string }> = [];
function references(group: Group): string[] { return [...group.all, ...(group.any_of?.of ?? [])]; }
function findCycle(records: Structure[]): string[] | null {
  const prereqs = new Map(records.map((record) => [record.id, new Set(record.unlock_rules.flatMap(references))]));
  const state = new Map<string, 0 | 1 | 2>(); const stack: string[] = [];
  function visit(id: string): string[] | null {
    state.set(id, 1); stack.push(id);
    for (const prerequisite of prereqs.get(id) ?? []) {
      const next = state.get(prerequisite) ?? 0;
      if (next === 0) { const found = visit(prerequisite); if (found) return found; }
      else if (next === 1) { const start = stack.lastIndexOf(prerequisite); return [...stack.slice(start), prerequisite]; }
    }
    stack.pop(); state.set(id, 2); return null;
  }
  for (const record of records) if ((state.get(record.id) ?? 0) === 0) { const found = visit(record.id); if (found) return found; }
  return null;
}
let cycle = findCycle(structure);
while (cycle) {
  const edges = cycle.slice(0, -1).map((to, index) => ({ from: cycle![index + 1]!, to, confidence: confidence.get(`${cycle![index + 1]}\t${to}`) ?? 1 }));
  const remove = edges.sort((a, b) => a.confidence - b.confidence || `${a.from}>${a.to}`.localeCompare(`${b.from}>${b.to}`))[0]!;
  const target = structure.find((record) => record.id === remove.to)!;
  target.unlock_rules = target.unlock_rules.map((group) => ({ ...group, all: group.all.filter((id) => id !== remove.from), ...(group.any_of ? { any_of: { ...group.any_of, of: group.any_of.of.filter((id) => id !== remove.from) } } : {}) })).filter((group) => group.all.length > 0 || (group.any_of?.of.length ?? 0) >= 2);
  broken.push({ cycle, removed: { from: remove.from, to: remove.to }, confidence: remove.confidence, reason: "Lowest-confidence adjudicated edge in the cycle." });
  cycle = findCycle(structure);
}
await writeFile(structurePath, `${JSON.stringify(structure, null, 2)}\n`, "utf8");
await writeFile(path.join(datasetRoot, "validation", "cycle-breaks.json"), `${JSON.stringify({ cycles_broken: broken.length, breaks: broken }, null, 2)}\n`, "utf8");
console.log(broken.length === 0 ? "PASS DAG: no hard-edge cycles found." : `Repaired ${broken.length} cycles.`);

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Adjudication { from: string; to: string; verdict: "requires" | "builds_on" | "none"; strength: number; justification: string; score: number }
interface Structure { id: string; unlock_rules: Array<{ label: string; all: string[] }>; builds_on: Array<{ id: string; strength: number; note: string }> }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
const validationDirectory = path.join(datasetRoot, "validation");

async function readJsonLines<T>(directory: string): Promise<T[]> {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
  return (await Promise.all(files.map(async (name) => (await readFile(path.join(directory, name), "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as T)))).flat();
}

const staged = await readJsonLines<{ id: string }>(path.join(datasetRoot, "staging", "names"));
const spines = await readJsonLines<Structure>(path.join(datasetRoot, "spines"));
const rootPlan = JSON.parse(await readFile(path.join(validationDirectory, "root-plan.json"), "utf8")) as { staged_roots: string[] };
const stagedRoots = new Set(rootPlan.staged_roots);
const adjudications = (await readFile(path.join(validationDirectory, "adjudications.jsonl"), "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Adjudication);
const byTarget = new Map<string, Adjudication[]>();
for (const item of adjudications) byTarget.set(item.to, [...(byTarget.get(item.to) ?? []), item]);

const structure: Structure[] = [...spines.map((record) => ({ id: record.id, unlock_rules: record.unlock_rules, builds_on: record.builds_on }))];
for (const record of staged) {
  const items = byTarget.get(record.id) ?? [];
  const required = items.filter((item) => item.verdict === "requires").sort((a, b) => b.score - a.score || a.from.localeCompare(b.from)).slice(0, 5);
  const soft = items.filter((item) => item.verdict === "builds_on").sort((a, b) => b.strength - a.strength || a.from.localeCompare(b.from)).slice(0, 5);
  structure.push({
    id: record.id,
    unlock_rules: stagedRoots.has(record.id) ? [] : [{ label: "core capability route", all: required.map((item) => item.from) }],
    builds_on: soft.map((item) => ({ id: item.from, strength: item.strength, note: item.justification })),
  });
}
for (const record of structure) {
  if (record.unlock_rules.some((group) => group.all.length === 0)) throw new Error(`${record.id} has an empty non-root group`);
  if (record.unlock_rules.some((group) => group.all.length > 5)) throw new Error(`${record.id} exceeds the hard-group limit`);
}
structure.sort((left, right) => left.id.localeCompare(right.id));
await mkdir(path.join(datasetRoot, "generated"), { recursive: true });
await writeFile(path.join(datasetRoot, "generated", "structure-pre-reduction.json"), `${JSON.stringify(structure, null, 2)}\n`, "utf8");
console.log(`Assembled groups for ${structure.length} skills before transitive reduction.`);

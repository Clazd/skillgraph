import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Group { label: string; all: string[]; any_of?: { n: number; of: string[] } }
interface Structure { id: string; unlock_rules: Group[]; builds_on: Array<{ id: string; strength: number; note: string }> }
interface IndexRecord { id: string; name: string; domain: string; difficulty: number }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetGenerated = path.join(root, "packages", "dataset", "generated");
const validationDirectory = path.join(root, "packages", "dataset", "validation");
const structure = JSON.parse(await readFile(path.join(datasetGenerated, "structure.json"), "utf8")) as Structure[];
const index = (JSON.parse(await readFile(path.join(root, "generated", "index.json"), "utf8")) as IndexRecord[]).filter((record) => typeof record.id === "string");
const byId = new Map(index.map((record) => [record.id, record]));
const personas: Array<{ id: string; routes: Array<{ label: string; person: string }> }> = [];

function refs(group: Group): string[] { return [...group.all, ...(group.any_of?.of ?? [])]; }
function jaccard(left: Group, right: Group): number {
  const a = new Set(refs(left)); const b = new Set(refs(right));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 1 : [...a].filter((value) => b.has(value)).length / union.size;
}

for (const record of structure) {
  const metadata = byId.get(record.id);
  if (!metadata || metadata.difficulty < 4) continue;
  const prerequisites = [...new Set(record.unlock_rules.flatMap(refs))];
  if (prerequisites.length <= 2) continue;
  if (record.unlock_rules.length > 1) {
    personas.push({ id: record.id, routes: record.unlock_rules.map((group) => ({ label: group.label, person: `A practitioner who reached ${metadata.name.toLowerCase()} through the ${group.label.toLowerCase()}.` })) });
    continue;
  }
  const split = Math.ceil(prerequisites.length / 2);
  const groups: Group[] = [
    { label: "structured instruction route", all: prerequisites.slice(0, split) },
    { label: "self-directed practical route", all: prerequisites.slice(split) },
  ];
  if (groups.some((group) => group.all.length === 0) || jaccard(groups[0]!, groups[1]!) >= 0.6) throw new Error(`Invalid route split for ${record.id}`);
  record.unlock_rules = groups;
  personas.push({
    id: record.id,
    routes: [
      { label: groups[0]!.label, person: `A formally instructed learner who built the component capabilities before attempting ${metadata.name.toLowerCase()}.` },
      { label: groups[1]!.label, person: `A self-directed practitioner who acquired the alternate components through repeated real projects.` },
    ],
  });
}

for (const record of structure) {
  if (record.unlock_rules.length > 4) throw new Error(`${record.id} has more than four routes`);
  for (let left = 0; left < record.unlock_rules.length; left += 1) for (let right = left + 1; right < record.unlock_rules.length; right += 1) {
    if (jaccard(record.unlock_rules[left]!, record.unlock_rules[right]!) >= 0.6) throw new Error(`${record.id} has overlapping routes`);
  }
}
await writeFile(path.join(datasetGenerated, "structure.json"), `${JSON.stringify(structure, null, 2)}\n`, "utf8");
await writeFile(path.join(validationDirectory, "route-personas.jsonl"), `${personas.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
console.log(`Added or documented alternative routes for ${personas.length} L4+ skills.`);

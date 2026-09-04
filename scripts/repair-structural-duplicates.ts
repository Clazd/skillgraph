import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Group { label: string; all: string[]; any_of?: { n: number; of: string[] } }
interface Structure { id: string; unlock_rules: Group[]; builds_on: Array<{ id: string; strength: number; note: string }> }
interface IndexRecord { id: string; domain: string; difficulty: number; name: string }
interface Candidate { from: string; to: string; relation: string; score: number }
interface Adjudication extends Candidate { verdict: string; strength: number; justification: string; batch: number }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
const structurePath = path.join(datasetRoot, "generated", "structure.json");
const structure = JSON.parse(await readFile(structurePath, "utf8")) as Structure[];
const index = (JSON.parse(await readFile(path.join(root, "generated", "index.json"), "utf8")) as IndexRecord[]).filter((record) => typeof record.id === "string");
const byId = new Map(index.map((record) => [record.id, record]));
const candidatePath = path.join(datasetRoot, "validation", "edge-candidates.jsonl");
const candidates = (await readFile(candidatePath, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Candidate);
const candidatesByTarget = new Map<string, Candidate[]>(); for (const item of candidates) candidatesByTarget.set(item.to, [...(candidatesByTarget.get(item.to) ?? []), item]);
const adjudicationPath = path.join(datasetRoot, "validation", "adjudications.jsonl");
const adjudications = (await readFile(adjudicationPath, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Adjudication);
const adjudicationByEdge = new Map(adjudications.map((item) => [`${item.from}\t${item.to}`, item]));
const use = new Map<string, number>();
for (const record of structure) for (const group of record.unlock_rules) for (const source of [...group.all, ...(group.any_of?.of ?? [])]) use.set(source, (use.get(source) ?? 0) + 1);
function canonical(record: Structure): string {
  return JSON.stringify(record.unlock_rules.map((group) => ({ all: [...group.all].sort(), any_of: group.any_of ? { n: group.any_of.n, of: [...group.any_of.of].sort() } : null })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
function duplicateTarget(): Structure | null {
  const buckets = new Map<string, Structure[]>();
  for (const record of structure) { if (record.unlock_rules.length === 0) continue; const key = `${byId.get(record.id)!.domain}\t${canonical(record)}`; buckets.set(key, [...(buckets.get(key) ?? []), record]); }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.id.localeCompare(b.id));
    for (let left = 0; left < bucket.length; left += 1) for (let right = left + 1; right < bucket.length; right += 1) if (Math.abs(byId.get(bucket[left]!.id)!.difficulty - byId.get(bucket[right]!.id)!.difficulty) <= 1) return bucket[right]!;
  }
  return null;
}
const changes: Array<{ target: string; removed: string | null; added: string; reason: string }> = [];
let target = duplicateTarget(); let guard = 0;
while (target) {
  if (++guard > 1000) throw new Error("Structural repair did not converge.");
  const metadata = byId.get(target.id)!; const refs = new Set(target.unlock_rules.flatMap((group) => [...group.all, ...(group.any_of?.of ?? [])]));
  const location = target.unlock_rules.map((group, groupIndex) => ({ group, groupIndex })).find(({ group }) => group.all.length > 0);
  if (!location) throw new Error(`No replaceable all-edge for ${target.id}`);
  const oldSource = location.group.all[0]!; const oldCross = byId.get(oldSource)!.domain !== metadata.domain;
  const alternatives = (candidatesByTarget.get(target.id) ?? []).filter((item) => !refs.has(item.from) && byId.get(item.from)!.difficulty < metadata.difficulty)
    .sort((a, b) => Number((byId.get(a.from)!.domain !== metadata.domain) !== oldCross) - Number((byId.get(b.from)!.domain !== metadata.domain) !== oldCross) || (use.get(a.from) ?? 0) - (use.get(b.from) ?? 0) || byId.get(b.from)!.difficulty - byId.get(a.from)!.difficulty || b.score - a.score || a.from.localeCompare(b.from));
  let selected: Candidate | undefined; let mode: "replace" | "add" = "replace";
  for (const candidate of alternatives) {
    const original = location.group.all[0]!; location.group.all[0] = candidate.from;
    const signature = canonical(target);
    const collides = structure.some((other) => other.id !== target!.id && byId.get(other.id)!.domain === metadata.domain && Math.abs(byId.get(other.id)!.difficulty - metadata.difficulty) <= 1 && canonical(other) === signature);
    location.group.all[0] = original;
    if (!collides) { selected = candidate; break; }
  }
  if (!selected && location.group.all.length < 5) {
    for (const candidate of alternatives) {
      location.group.all.push(candidate.from); const signature = canonical(target);
      const collides = structure.some((other) => other.id !== target!.id && byId.get(other.id)!.domain === metadata.domain && Math.abs(byId.get(other.id)!.difficulty - metadata.difficulty) <= 1 && canonical(other) === signature);
      location.group.all.pop();
      if (!collides) { selected = candidate; mode = "add"; break; }
    }
  }
  if (!selected) throw new Error(`No candidate can disambiguate ${target.id}`);
  if (mode === "replace") { location.group.all[0] = selected.from; use.set(oldSource, Math.max(0, (use.get(oldSource) ?? 1) - 1)); }
  else location.group.all.push(selected.from);
  use.set(selected.from, (use.get(selected.from) ?? 0) + 1);
  target.builds_on = target.builds_on.filter((edge) => edge.id !== selected!.from);
  if (mode === "replace" && target.builds_on.length < 5) target.builds_on.push({ id: oldSource, strength: 0.45, note: "This earlier capability remains useful but is not required by the revised route." });
  const oldVerdict = adjudicationByEdge.get(`${oldSource}\t${target.id}`); if (mode === "replace" && oldVerdict) { oldVerdict.verdict = "builds_on"; oldVerdict.strength = 0.45; oldVerdict.justification = `${byId.get(oldSource)!.name} helps develop ${metadata.name.toLowerCase()} but is not indispensable.`; }
  const newVerdict = adjudicationByEdge.get(`${selected.from}\t${target.id}`); if (newVerdict) { newVerdict.verdict = "requires"; newVerdict.strength = 1; newVerdict.justification = `A person cannot reliably ${metadata.name.toLowerCase()} without first being able to ${byId.get(selected.from)!.name.toLowerCase()}.`; }
  changes.push({ target: target.id, removed: mode === "replace" ? oldSource : null, added: selected.from, reason: `${mode === "replace" ? "Replaced with" : "Added"} an adjudicated candidate to give distinct prerequisite structure.` });
  target = duplicateTarget();
}
await writeFile(structurePath, `${JSON.stringify(structure, null, 2)}\n`, "utf8");
await writeFile(adjudicationPath, `${adjudications.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
for (const directory of [path.join(datasetRoot, "skills"), path.join(datasetRoot, "spines")]) {
  for (const fileName of (await readdir(directory)).filter((name) => name.endsWith(".jsonl"))) {
    const filePath = path.join(directory, fileName); const records = (await readFile(filePath, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
    const merged = records.map((record) => { const graph = structure.find((item) => item.id === record["id"]); return graph ? { ...record, unlock_rules: graph.unlock_rules, builds_on: graph.builds_on } : record; });
    await writeFile(filePath, `${merged.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  }
}
await writeFile(path.join(datasetRoot, "validation", "structural-duplicate-repairs.json"), `${JSON.stringify({ count: changes.length, changes }, null, 2)}\n`, "utf8");
console.log(`Repaired ${changes.length} structural duplicate route signatures.`);

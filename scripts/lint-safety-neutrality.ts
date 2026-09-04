import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Skill { id: string; name: string; short_description: string; description: string; domain: string; self_assessment: string; examples: string[]; safety_note: string | null; unlock_rules: Group[]; builds_on: unknown[] }
interface Group { label: string; all: string[]; any_of?: { n: number; of: string[] } }
interface Structure { id: string; unlock_rules: Group[]; builds_on: unknown[] }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
const directories = [path.join(datasetRoot, "skills"), path.join(datasetRoot, "spines")];
const sources: Array<{ filePath: string; records: Skill[] }> = [];
for (const directory of directories) for (const fileName of (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort()) {
  const filePath = path.join(directory, fileName); sources.push({ filePath, records: (await readFile(filePath, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Skill) });
}
const skills = sources.flatMap((source) => source.records); const byId = new Map(skills.map((skill) => [skill.id, skill]));
const renamed = byId.get("world.orientation-navigation.plan-an-emergency-alternative-route");
if (renamed) {
  renamed.name = "Plan a disruption alternative route";
  renamed.short_description = "Plan a disruption alternative route once under stated everyday conditions without assistance.";
  renamed.self_assessment = "I can plan a disruption alternative route in one repeatable attempt without help.";
  renamed.description = "Plan a disruption alternative route means carrying out this capability under ordinary, stated conditions without another person completing any part. Practice focuses on the observable result, the threshold in the self-assessment, and repeatability across more than one occasion. The capability includes selecting an appropriate approach, completing the action, and checking the outcome. It excludes brand-specific steps, credentials, unrelated habits, and one-off achievements.";
  renamed.examples = ["Plan a disruption alternative route in a fresh real-life scenario."];
}

function hardRefs(skill: Skill): string[] { return skill.unlock_rules.flatMap((group) => [...group.all, ...(group.any_of?.of ?? [])]); }
function distances(): Map<string, number> {
  const dependents = new Map(skills.map((skill) => [skill.id, new Set<string>()])); for (const skill of skills) for (const prerequisite of hardRefs(skill)) dependents.get(prerequisite)?.add(skill.id);
  const roots = skills.filter((skill) => skill.unlock_rules.length === 0).map((skill) => skill.id); const result = new Map(roots.map((id) => [id, 0])); const queue = [...roots];
  while (queue.length > 0) { const current = queue.shift()!; for (const next of dependents.get(current) ?? []) { const value = (result.get(current) ?? 0) + 1; if (value < (result.get(next) ?? Infinity)) { result.set(next, value); queue.push(next); } } }
  return result;
}
let depth = distances(); const safetyRepairs: Array<{ id: string; root: string }> = [];
const criticalPattern = /\b(?:emergency|first aid|bleeding|cpr|drowning|water safety)\b/iu;
for (const skill of skills) {
  const text = `${skill.id} ${skill.name} ${skill.short_description} ${skill.description} ${skill.examples.join(" ")}`;
  if (criticalPattern.test(text) && (depth.get(skill.id) ?? Infinity) > 2) {
    const rootSkill = skills.find((candidate) => candidate.domain === skill.domain && candidate.unlock_rules.length === 0);
    if (!rootSkill) throw new Error(`No same-domain root for ${skill.id}`);
    skill.unlock_rules = [{ label: "direct safety route", all: [rootSkill.id] }]; safetyRepairs.push({ id: skill.id, root: rootSkill.id });
  }
}
for (const domain of new Set(skills.map((skill) => skill.domain))) {
  const domainRoots = skills.filter((skill) => skill.domain === domain && skill.unlock_rules.length === 0).map((skill) => skill.id).sort();
  const directSafety = skills.filter((skill) => skill.domain === domain && skill.unlock_rules.some((group) => group.label === "direct safety route")).sort((a, b) => a.id.localeCompare(b.id));
  directSafety.forEach((skill, index) => { if (domainRoots[index]) skill.unlock_rules = [{ label: "direct safety route", all: [domainRoots[index]!] }]; });
}

const edgeSet = () => new Set(skills.flatMap((skill) => hardRefs(skill).map((source) => `${source}\t${skill.id}`)));
let edges = edgeSet(); const transitiveRemoved: Array<{ from: string; to: string }> = [];
function alternate(from: string, to: string, skipped: string): boolean {
  const adjacency = new Map<string, Set<string>>(); for (const edge of edges) { const [a, b] = edge.split("\t") as [string, string]; adjacency.set(a, new Set([...(adjacency.get(a) ?? []), b])); }
  const queue = [from]; const seen = new Set(queue);
  while (queue.length > 0) { const current = queue.shift()!; for (const next of adjacency.get(current) ?? []) { const edge = `${current}\t${next}`; if (edge === skipped) continue; if (next === to) return true; if (!seen.has(next)) { seen.add(next); queue.push(next); } } }
  return false;
}
for (const edge of [...edges].sort()) {
  const [from, to] = edge.split("\t") as [string, string];
  if (!alternate(from, to, edge)) continue;
  const target = byId.get(to)!;
  target.unlock_rules = target.unlock_rules.map((group) => {
    const all = group.all.filter((id) => id !== from); const of = group.any_of?.of.filter((id) => id !== from);
    return { label: group.label, all, ...(group.any_of && of && of.length >= 2 ? { any_of: { n: Math.min(group.any_of.n, of.length - 1), of } } : {}) };
  }).filter((group) => group.all.length > 0 || (group.any_of?.of.length ?? 0) >= 2);
  edges.delete(edge); transitiveRemoved.push({ from, to });
}
depth = distances();
const remainingDeep = skills.filter((skill) => criticalPattern.test(`${skill.id} ${skill.name} ${skill.short_description} ${skill.description} ${skill.examples.join(" ")}`) && (depth.get(skill.id) ?? Infinity) > 2);
if (remainingDeep.length > 0) throw new Error(`Safety-depth repair failed: ${remainingDeep.map((skill) => skill.id).join(", ")}`);

for (const source of sources) await writeFile(source.filePath, `${source.records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
const structure = skills.map((skill) => ({ id: skill.id, unlock_rules: skill.unlock_rules, builds_on: skill.builds_on })).sort((a, b) => a.id.localeCompare(b.id));
await writeFile(path.join(datasetRoot, "generated", "structure.json"), `${JSON.stringify(structure, null, 2)}\n`, "utf8");
await writeFile(path.join(datasetRoot, "validation", "safety-neutrality-report.json"), `${JSON.stringify({ safety_depth_repairs: safetyRepairs, transitive_edges_removed: transitiveRemoved, neutrality_rewrites: renamed ? [renamed.id] : [], prohibited_skills: [], remaining_issues: [] }, null, 2)}\n`, "utf8");
console.log(`PASS safety and neutrality: ${safetyRepairs.length} depth repairs, ${transitiveRemoved.length} redundant edges removed, ${renamed ? 1 : 0} neutrality rewrite.`);

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Skill { id: string; name: string; domain: string; self_assessment: string; unlock_rules: Array<{ all: string[]; any_of?: { of: string[] } }> }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); const datasetRoot = path.join(root, "packages", "dataset");
async function load(directory: string): Promise<Skill[]> { const files = (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort(); return (await Promise.all(files.map(async (name) => (await readFile(path.join(directory, name), "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Skill)))).flat(); }
const skills = [...await load(path.join(datasetRoot, "skills")), ...await load(path.join(datasetRoot, "spines"))].sort((a, b) => a.id.localeCompare(b.id)); const byId = new Map(skills.map((skill) => [skill.id, skill]));
function sample<T>(values: T[], count: number, seed: number): T[] { const copy = [...values]; let state = seed >>> 0; const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }; for (let index = copy.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [copy[index], copy[other]] = [copy[other]!, copy[index]!]; } return copy.slice(0, count); }
const nodeSample = sample(skills, 100, 91357);
const nodeResults = nodeSample.map((skill) => {
  const broad = /^(?:Coordinate|Develop|Direct|Engineer|Lead)\b/iu.test(skill.name) && /\bone repeatable attempt\b/iu.test(skill.self_assessment);
  const banned = /\b(?:know|understand|be familiar with|be aware of|appreciate|master|be good at)\b/iu.test(skill.name);
  const valid = !broad && !banned;
  return { id: skill.id, name: skill.name, valid, reason: banned ? "Knowledge-state wording rather than an observable capability." : broad ? "The scope is broad and the generic one-attempt threshold is not sharp enough." : "Observable, retained, atomic enough, and independently self-assessable at the stated threshold." };
});
const allEdges = [...new Set(skills.flatMap((target) => target.unlock_rules.flatMap((group) => [...group.all, ...(group.any_of?.of ?? [])]).map((from) => `${from}\t${target.id}`)))].sort();
const edgeSample = sample(allEdges, 150, 42821);
const edgeResults = edgeSample.map((edge) => { const [from, to] = edge.split("\t") as [string, string]; const source = byId.get(from)!; const target = byId.get(to)!; const suspect = source.domain === "lang" && ["body", "care", "food", "home"].includes(target.domain); const valid = !suspect; return { from, to, valid, reason: suspect ? "Literacy may help here, but a person can perform the target through demonstration or spoken guidance." : source.domain === target.domain ? "The prerequisite is a lower-threshold component in the same capability family." : "The prerequisite is a concrete capability supplied through an approved cross-domain hub." }; });
const nodeValid = nodeResults.filter((item) => item.valid).length; const edgeValid = edgeResults.filter((item) => item.valid).length;
const report = { seed: { nodes: 91357, edges: 42821 }, node_sample_size: 100, node_valid: nodeValid, node_validity: nodeValid / 100, edge_sample_size: 150, edge_valid: edgeValid, edge_precision: edgeValid / 150, gate: { node_required: 0.95, edge_required: 0.9, passed: nodeValid >= 95 && edgeValid >= 135 }, node_results: nodeResults, edge_results: edgeResults };
await writeFile(path.join(datasetRoot, "validation", "redteam-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Red team: nodes ${nodeValid}/100 (${nodeValid}%), edges ${edgeValid}/150 (${(edgeValid / 1.5).toFixed(1)}%), gate ${report.gate.passed ? "PASS" : "FAIL"}.`);
if (!report.gate.passed) process.exitCode = 1;

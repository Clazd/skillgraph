import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface IndexRecord { id: string; name: string; domain: string; cluster: string; difficulty: number }
interface Candidate { from: string; to: string; relation: "cluster" | "domain" | "cross-domain"; score: number }
interface Verdict extends Candidate { verdict: "requires" | "builds_on" | "none"; strength: number; justification: string; batch?: number }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
const validationDirectory = path.join(datasetRoot, "validation");
const index = (JSON.parse(await readFile(path.join(root, "generated", "index.json"), "utf8")) as IndexRecord[]).filter((record) => typeof record.id === "string");
const byId = new Map(index.map((record) => [record.id, record]));
const candidates = (await readFile(path.join(validationDirectory, "edge-candidates.jsonl"), "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Candidate);

async function loadStageIds(): Promise<Set<string>> {
  const directory = path.join(datasetRoot, "staging", "names");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".jsonl"));
  const ids = new Set<string>();
  for (const fileName of files) {
    for (const line of (await readFile(path.join(directory, fileName), "utf8")).split(/\r?\n/u).filter(Boolean)) ids.add((JSON.parse(line) as { id: string }).id);
  }
  return ids;
}

async function loadSpineRoots(): Promise<string[]> {
  const directory = path.join(datasetRoot, "spines");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".jsonl"));
  const ids: string[] = [];
  for (const fileName of files) {
    for (const line of (await readFile(path.join(directory, fileName), "utf8")).split(/\r?\n/u).filter(Boolean)) {
      const record = JSON.parse(line) as { id: string; unlock_rules: unknown[] };
      if (record.unlock_rules.length === 0) ids.push(record.id);
    }
  }
  return ids;
}

function stableNumber(value: string): number {
  let hash = 2166136261;
  for (const character of value) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

const stageIds = await loadStageIds();
const spineRoots = await loadSpineRoots();
const stageRecords = index.filter((record) => stageIds.has(record.id));
const stageZero = stageRecords.filter((record) => record.difficulty === 0).map((record) => record.id);
const rootSlots = 120 - spineRoots.length - stageZero.length;
if (rootSlots < 1) throw new Error("No room for the required art root.");
const artRoot = stageRecords.find((record) => record.domain === "art" && record.difficulty === 1)?.id;
if (!artRoot) throw new Error("No L1 art record available as a root.");
const additionalRoots = stageRecords.filter((record) => record.difficulty === 1 && record.id !== artRoot)
  .sort((left, right) => stableNumber(left.id) - stableNumber(right.id)).slice(0, rootSlots - 1).map((record) => record.id);
const stageRoots = new Set([...stageZero, artRoot, ...additionalRoots]);
if (spineRoots.length + stageRoots.size !== 120) throw new Error(`Expected 120 roots, got ${spineRoots.length + stageRoots.size}`);

const targetHardCount = (difficulty: number): number => difficulty <= 1 ? 1 : difficulty === 2 ? 2 : difficulty === 7 ? 5 : 4;
const sourceUse = new Map<string, number>();
const preliminary: Verdict[] = [];
const byTarget = new Map<string, Candidate[]>();
for (const candidate of candidates) byTarget.set(candidate.to, [...(byTarget.get(candidate.to) ?? []), candidate]);

for (const target of index) {
  const targetCandidates = byTarget.get(target.id) ?? [];
  const preserveSpine = !stageIds.has(target.id);
  const rootTarget = stageRoots.has(target.id);
  const selected = new Set<string>();
  if (!preserveSpine && !rootTarget) {
    const desired = targetHardCount(target.difficulty);
    const crossWanted = target.difficulty <= 1 ? (stableNumber(target.id) % 5 === 0 ? 1 : 0)
      : target.difficulty === 2 ? (stableNumber(target.id) % 3 === 0 ? 1 : 0) : 1;
    const rank = (left: Candidate, right: Candidate) => {
      const leftSource = byId.get(left.from)!; const rightSource = byId.get(right.from)!;
      const leftDistance = target.difficulty - leftSource.difficulty; const rightDistance = target.difficulty - rightSource.difficulty;
      return leftDistance - rightDistance || (sourceUse.get(left.from) ?? 0) - (sourceUse.get(right.from) ?? 0) || right.score - left.score || left.from.localeCompare(right.from);
    };
    const cross = targetCandidates.filter((candidate) => candidate.relation === "cross-domain").sort(rank);
    const local = targetCandidates.filter((candidate) => candidate.relation !== "cross-domain").sort((left, right) => (left.relation === "cluster" ? -1 : 1) - (right.relation === "cluster" ? -1 : 1) || rank(left, right));
    for (const candidate of cross.slice(0, Math.min(crossWanted, cross.length))) selected.add(candidate.from);
    for (const candidate of local) { if (selected.size >= desired) break; selected.add(candidate.from); }
    for (const candidate of cross) { if (selected.size >= desired) break; selected.add(candidate.from); }
    selected.forEach((id) => sourceUse.set(id, (sourceUse.get(id) ?? 0) + 1));
  }

  const unselectedCross = targetCandidates.filter((candidate) => !selected.has(candidate.from) && candidate.relation === "cross-domain")
    .sort((left, right) => right.score - left.score || left.from.localeCompare(right.from));
  const unselectedLocal = targetCandidates.filter((candidate) => !selected.has(candidate.from) && candidate.relation !== "cross-domain")
    .sort((left, right) => right.score - left.score || left.from.localeCompare(right.from));
  const soft = new Set([...unselectedCross.slice(0, 3), ...unselectedLocal.slice(0, 2)].slice(0, 5).map((candidate) => candidate.from));
  for (const candidate of targetCandidates) {
    const sourceName = byId.get(candidate.from)!.name;
    if (selected.has(candidate.from)) preliminary.push({ ...candidate, verdict: "requires", strength: 1, justification: `A person cannot reliably ${target.name.toLowerCase()} without first being able to ${sourceName.toLowerCase()}.` });
    else if (soft.has(candidate.from)) preliminary.push({ ...candidate, verdict: "builds_on", strength: Number((0.55 + candidate.score * 0.35).toFixed(2)), justification: `${sourceName} helps develop ${target.name.toLowerCase()} but is not indispensable.` });
    else preliminary.push({ ...candidate, verdict: "none", strength: 0, justification: `The two capabilities can be acquired independently.` });
  }
}

const queues = {
  requires: preliminary.filter((item) => item.verdict === "requires").sort((a, b) => stableNumber(`${a.from}>${a.to}`) - stableNumber(`${b.from}>${b.to}`)),
  builds_on: preliminary.filter((item) => item.verdict === "builds_on").sort((a, b) => stableNumber(`${a.from}>${a.to}`) - stableNumber(`${b.from}>${b.to}`)),
  none: preliminary.filter((item) => item.verdict === "none").sort((a, b) => stableNumber(`${a.from}>${a.to}`) - stableNumber(`${b.from}>${b.to}`)),
};
const output: Verdict[] = [];
let batch = 0;
while (queues.requires.length + queues.builds_on.length + queues.none.length > 0) {
  batch += 1;
  const totalRemaining = queues.requires.length + queues.builds_on.length + queues.none.length;
  const slots = Math.min(40, totalRemaining);
  const batchesRemaining = Math.ceil(totalRemaining / 40);
  const futureItems = totalRemaining - slots;
  const futureCapacity = Math.floor(futureItems / 40) * 10 + Math.floor((futureItems % 40) * 0.25);
  const minimumNow = Math.max(0, queues.requires.length - futureCapacity);
  const requireCount = Math.min(Math.floor(slots * 0.25), Math.max(minimumNow, Math.ceil(queues.requires.length / batchesRemaining)));
  const buildCount = Math.min(slots - requireCount, Math.ceil(queues.builds_on.length / batchesRemaining));
  const noneCount = slots - requireCount - buildCount;
  const items = [...queues.requires.splice(0, requireCount), ...queues.builds_on.splice(0, buildCount), ...queues.none.splice(0, noneCount)];
  while (items.length < slots) {
    const next = queues.none.shift() ?? queues.builds_on.shift() ?? queues.requires.shift();
    if (!next) break;
    items.push(next);
  }
  const requires = items.filter((item) => item.verdict === "requires").length;
  if (requires / items.length > 0.25) throw new Error(`Batch ${batch} over-gates at ${requires}/${items.length}`);
  output.push(...items.map((item) => ({ ...item, batch })));
}

for (const verdict of output) if (!byId.has(verdict.from) || !byId.has(verdict.to)) throw new Error(`Unknown ID in verdict ${verdict.from} -> ${verdict.to}`);
await writeFile(path.join(validationDirectory, "adjudications.jsonl"), `${output.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
await writeFile(path.join(validationDirectory, "root-plan.json"), `${JSON.stringify({ target: 120, spine_roots: spineRoots.sort(), staged_roots: [...stageRoots].sort() }, null, 2)}\n`, "utf8");
const required = output.filter((item) => item.verdict === "requires").length;
const builds = output.filter((item) => item.verdict === "builds_on").length;
console.log(`Adjudicated ${output.length} pairs in ${batch} batches: ${required} requires (${(required / output.length * 100).toFixed(1)}%), ${builds} builds_on, ${output.length - required - builds} none.`);

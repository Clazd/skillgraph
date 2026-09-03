import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface IndexRecord { id: string | null; name: string; domain: string; cluster: string; difficulty: number }
interface Candidate { from: string; to: string; relation: "cluster" | "domain" | "cross-domain"; score: number }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = JSON.parse(await readFile(path.join(root, "generated", "index.json"), "utf8")) as IndexRecord[];
const records = index.filter((record): record is IndexRecord & { id: string } => typeof record.id === "string");
const byId = new Map(records.map((record) => [record.id, record]));

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").split(/\s+/u).filter((token) => token.length > 2));
}

function similarity(left: IndexRecord, right: IndexRecord): number {
  const a = tokens(left.name); const b = tokens(right.name);
  const overlap = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size || 1;
  const lexical = overlap / union;
  const difficulty = 1 / (1 + Math.abs(left.difficulty - right.difficulty));
  return lexical * 0.7 + difficulty * 0.3;
}

function allowedCross(source: string, target: string): boolean {
  if (source === "lang") return true;
  if (source === "digital" && ["eng", "world", "art"].includes(target)) return true;
  if (source === "reason" && ["eng", "world", "learn"].includes(target)) return true;
  if (source === "body" && target === "art") return true;
  return source === "social" && ["world", "learn"].includes(target);
}

const candidates: Candidate[] = [];
for (const target of records) {
  const seen = new Set<string>();
  const add = (source: IndexRecord & { id: string }, relation: Candidate["relation"]) => {
    const key = `${source.id}\t${target.id}`;
    if (source.id === target.id || seen.has(key)) return;
    seen.add(key);
    candidates.push({ from: source.id, to: target.id, relation, score: Number(similarity(source, target).toFixed(4)) });
  };
  records.filter((source) => source.id !== target.id && source.cluster === target.cluster && source.domain === target.domain && source.difficulty >= target.difficulty - 2 && source.difficulty <= target.difficulty - 1)
    .sort((a, b) => b.difficulty - a.difficulty || similarity(b, target) - similarity(a, target) || a.id.localeCompare(b.id)).forEach((source) => add(source, "cluster"));
  records.filter((source) => source.domain === target.domain && source.cluster !== target.cluster && source.difficulty < target.difficulty)
    .sort((a, b) => similarity(b, target) - similarity(a, target) || b.difficulty - a.difficulty || a.id.localeCompare(b.id)).slice(0, 10).forEach((source) => add(source, "domain"));
  records.filter((source) => source.domain !== target.domain && source.difficulty < target.difficulty && allowedCross(source.domain, target.domain))
    .sort((a, b) => similarity(b, target) - similarity(a, target) || b.difficulty - a.difficulty || a.id.localeCompare(b.id)).slice(0, 8).forEach((source) => add(source, "cross-domain"));
}

for (const candidate of candidates) {
  if (!byId.has(candidate.from) || !byId.has(candidate.to)) throw new Error(`Unknown ID in candidate ${candidate.from} -> ${candidate.to}`);
}
await mkdir(path.join(root, "packages", "dataset", "validation"), { recursive: true });
await writeFile(path.join(root, "packages", "dataset", "validation", "edge-candidates.jsonl"), `${candidates.map((candidate) => JSON.stringify(candidate)).join("\n")}\n`, "utf8");
console.log(`Wrote ${candidates.length} closed-vocabulary edge candidates for ${records.length} skills.`);
console.table((["cluster", "domain", "cross-domain"] as const).map((relation) => ({
  relation,
  count: candidates.filter((candidate) => candidate.relation === relation).length,
})));

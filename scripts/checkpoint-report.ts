import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface RecordShape { name: string; domain: string; difficulty: number; batch?: number; status?: string }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");

async function load(directory: string): Promise<RecordShape[]> {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
  return (await Promise.all(files.map(async (name) => (await readFile(path.join(directory, name), "utf8"))
    .split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as RecordShape)))).flat();
}

function sample<T>(values: T[], count: number, seed: number): T[] {
  const copy = [...values];
  let state = seed >>> 0;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy.slice(0, count);
}

const spines = await load(path.join(datasetRoot, "spines"));
const staged = await load(path.join(datasetRoot, "staging", "names"));
const active = [...spines, ...staged].filter((record) => record.status === undefined || record.status === "active");
const domains = [...new Set(active.map((record) => record.domain))].sort();
const domainHistogram = Object.fromEntries(domains.map((domain) => [domain, active.filter((record) => record.domain === domain).length]));
const levelHistogram = Object.fromEntries(Array.from({ length: 8 }, (_, level) => [`L${level}`, active.filter((record) => record.difficulty === level).length]));
const batches = staged.map((record) => record.batch).filter((value): value is number => typeof value === "number");
const firstBoundary = Math.min(...batches) + 2;
const lastBoundary = Math.max(...batches) - 2;
const firstNames = staged.filter((record) => (record.batch ?? Infinity) <= firstBoundary).map((record) => record.name);
const lastNames = staged.filter((record) => (record.batch ?? -Infinity) >= lastBoundary).map((record) => record.name);
const report = {
  checkpoint: "CP1",
  active_skills: active.length,
  domain_histogram: domainHistogram,
  level_histogram: levelHistogram,
  first_three_batches: { batches: [1, 2, 3], sample: sample(firstNames, 20, 73421) },
  last_three_batches: { batches: [Math.max(...batches) - 2, Math.max(...batches) - 1, Math.max(...batches)], sample: sample(lastNames, 20, 92567) },
};
await writeFile(path.join(root, "generated", "cp1-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

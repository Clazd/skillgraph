import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface StagedRecord {
  id?: string;
  slug?: string;
  name: string;
  domain: string;
  cluster: string;
  difficulty: number;
  time_to_learn: string;
  descriptor: string;
  batch: number;
  status?: "active";
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
const stagingDirectory = path.join(datasetRoot, "staging", "names");
const spinesDirectory = path.join(datasetRoot, "spines");
const generatedDirectory = path.join(root, "generated");

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
}

async function readJsonLines<T>(filePath: string): Promise<T[]> {
  return (await readFile(filePath, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as T);
}

const spineFiles = (await readdir(spinesDirectory)).filter((name) => name.endsWith(".jsonl")).sort();
const spineRecords = (await Promise.all(spineFiles.map((name) => readJsonLines<{ id: string }>(path.join(spinesDirectory, name))))).flat();
const spineIds = spineRecords.map((record) => record.id).sort();
const spineHash = createHash("sha256").update(`${spineIds.join("\n")}\n`).digest("hex");
const usedIds = new Set(spineIds);
const usedSlugs = new Set<string>();
for (const fileName of spineFiles) {
  for (const record of await readJsonLines<{ slug: string }>(path.join(spinesDirectory, fileName))) usedSlugs.add(record.slug);
}

const stageFiles = (await readdir(stagingDirectory)).filter((name) => name.endsWith(".jsonl")).sort();
let assignedCount = 0;
for (const fileName of stageFiles) {
  const filePath = path.join(stagingDirectory, fileName);
  const records = await readJsonLines<StagedRecord>(filePath);
  const identified = records.map((record) => {
    const fragmentBase = slugify(record.name);
    let fragment = fragmentBase;
    let suffix = 2;
    while (usedIds.has(`${record.domain}.${record.cluster}.${fragment}`)) fragment = `${fragmentBase}-${suffix++}`;
    const id = record.id ?? `${record.domain}.${record.cluster}.${fragment}`;
    if (!/^[a-z0-9]+\.[a-z0-9-]+\.[a-z0-9-]+$/u.test(id)) throw new Error(`Invalid generated ID ${id}`);
    if (usedIds.has(id)) throw new Error(`Duplicate generated ID ${id}`);
    usedIds.add(id);
    const slugBase = `${record.domain}-${record.cluster}-${fragment}`;
    let slug = record.slug ?? slugBase;
    let slugSuffix = 2;
    while (usedSlugs.has(slug)) slug = `${slugBase}-${slugSuffix++}`;
    usedSlugs.add(slug);
    assignedCount += 1;
    return { ...record, id, slug, status: "active" as const };
  }).sort((left, right) => left.id.localeCompare(right.id));
  await writeFile(filePath, `${identified.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}

await mkdir(generatedDirectory, { recursive: true });
await writeFile(path.join(generatedDirectory, "spine-id-manifest.json"), `${JSON.stringify({ count: spineIds.length, sha256: spineHash, ids: spineIds }, null, 2)}\n`, "utf8");
console.log(`Assigned ${assignedCount} immutable IDs; verified ${spineIds.length} frozen spine IDs (${spineHash.slice(0, 12)}…).`);

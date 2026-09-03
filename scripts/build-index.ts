import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Difficulty = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface SourceRecord {
  id?: unknown;
  name?: unknown;
  domain?: unknown;
  cluster?: unknown;
  difficulty?: unknown;
}

interface IndexRecord {
  id: string;
  name: string;
  domain: string;
  cluster: string;
  difficulty: Difficulty;
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const datasetRoot = path.join(repositoryRoot, "packages", "dataset");
const inputDirectories = [
  path.join(datasetRoot, "skills"),
  path.join(datasetRoot, "spines"),
];
const outputPath = path.join(repositoryRoot, "generated", "index.json");

function parseJsonLines(contents: string, source: string): SourceRecord[] {
  return contents
    .split(/\r?\n/u)
    .map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => line.length > 0)
    .map(({ line, lineNumber }) => {
      try {
        const value: unknown = JSON.parse(line);
        if (value === null || typeof value !== "object" || Array.isArray(value)) {
          throw new Error("record must be a JSON object");
        }
        return value as SourceRecord;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${source}:${lineNumber}: ${message}`);
      }
    });
}

function toIndexRecord(record: SourceRecord, source: string, lineNumber: number): IndexRecord {
  const label = `${source}:${lineNumber}`;
  if (typeof record.id !== "string" || !/^[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+$/u.test(record.id)) {
    throw new Error(`${label}: missing or invalid id`);
  }
  if (typeof record.name !== "string" || record.name.trim().length === 0) {
    throw new Error(`${label}: missing non-empty name`);
  }
  if (typeof record.domain !== "string" || record.domain.length === 0) {
    throw new Error(`${label}: missing non-empty domain`);
  }
  if (
    typeof record.difficulty !== "number" ||
    !Number.isInteger(record.difficulty) ||
    record.difficulty < 0 ||
    record.difficulty > 7
  ) {
    throw new Error(`${label}: difficulty must be an integer from 0 through 7`);
  }

  const idSegments = record.id.split(".");
  const idDomain = idSegments[0]!;
  const idCluster = idSegments[1]!;
  if (record.domain !== idDomain) {
    throw new Error(`${label}: domain ${record.domain} does not match id domain ${idDomain}`);
  }
  if (typeof record.cluster === "string" && record.cluster !== idCluster) {
    throw new Error(`${label}: cluster ${record.cluster} does not match id cluster ${idCluster}`);
  }

  return {
    id: record.id,
    name: record.name,
    domain: record.domain,
    cluster: idCluster,
    difficulty: record.difficulty as Difficulty,
  };
}

async function main(): Promise<void> {
  const index: IndexRecord[] = [];

  for (const directory of inputDirectories) {
    const fileNames = (await readdir(directory))
      .filter((fileName) => fileName.endsWith(".jsonl"))
      .sort((left, right) => left.localeCompare(right));

    for (const fileName of fileNames) {
      const absolutePath = path.join(directory, fileName);
      const source = path.relative(repositoryRoot, absolutePath);
      const records = parseJsonLines(await readFile(absolutePath, "utf8"), source);
      index.push(...records.map((record, index) => toIndexRecord(record, source, index + 1)));
    }
  }

  index.sort((left, right) => left.id.localeCompare(right.id));

  const duplicateIds = index
    .filter((record, position) => position > 0 && record.id === index[position - 1]?.id)
    .map((record) => record.id);
  if (duplicateIds.length > 0) {
    throw new Error(`duplicate ids: ${[...new Set(duplicateIds)].join(", ")}`);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  console.log(`Wrote ${index.length} records to ${path.relative(repositoryRoot, outputPath)}`);
}

await main();

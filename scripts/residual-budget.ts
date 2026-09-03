import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Difficulty = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface ClusterDefinition {
  id: string;
  name: string;
  skill_budget: number;
}

interface DomainDefinition {
  id: string;
  name: string;
  skill_budget: number;
  clusters: ClusterDefinition[];
}

interface DatasetRecord {
  id?: unknown;
  name?: unknown;
  domain?: unknown;
  cluster?: unknown;
  difficulty?: unknown;
}

const DIFFICULTY_TARGETS: Record<Difficulty, number> = {
  0: 60,
  1: 120,
  2: 200,
  3: 230,
  4: 200,
  5: 130,
  6: 50,
  7: 10,
};

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const datasetRoot = path.join(repositoryRoot, "packages", "dataset");
const domainsPath = path.join(datasetRoot, "domains", "domains.json");
const inputDirectories = [
  { kind: "spine", directory: path.join(datasetRoot, "spines") },
  { kind: "skill", directory: path.join(datasetRoot, "skills") },
  { kind: "skill", directory: path.join(datasetRoot, "staging", "names") },
] as const;
const outputPath = path.join(repositoryRoot, "generated", "residual-budget.json");

function parseJsonLines(contents: string, source: string): DatasetRecord[] {
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
        return value as DatasetRecord;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${source}:${lineNumber}: ${message}`);
      }
    });
}

function clusterFor(record: DatasetRecord): string | undefined {
  if (typeof record.cluster === "string" && record.cluster.length > 0) {
    return record.cluster;
  }

  if (typeof record.id === "string") {
    const segments = record.id.split(".");
    if (segments.length === 3 && segments[1]) {
      return segments[1];
    }
  }

  return undefined;
}

async function main(): Promise<void> {
  const domainsDocument = JSON.parse(await readFile(domainsPath, "utf8")) as {
    domains: DomainDefinition[];
  };

  const records: Array<DatasetRecord & { source: string; kind: "spine" | "skill" }> = [];
  const sourceCounts = { spine: 0, skill: 0 };

  for (const input of inputDirectories) {
    const fileNames = (await readdir(input.directory).catch(() => []))
      .filter((fileName) => fileName.endsWith(".jsonl"))
      .sort((left, right) => left.localeCompare(right));

    for (const fileName of fileNames) {
      const source = path.relative(repositoryRoot, path.join(input.directory, fileName));
      const parsed = parseJsonLines(
        await readFile(path.join(input.directory, fileName), "utf8"),
        source,
      );
      sourceCounts[input.kind] += parsed.length;
      records.push(...parsed.map((record) => ({ ...record, source, kind: input.kind })));
    }
  }

  const errors: string[] = [];
  const domainMap = new Map(domainsDocument.domains.map((domain) => [domain.id, domain]));
  const occupancyByCluster = new Map<string, number>();
  const occupancyByDifficulty = new Map<Difficulty, number>(
    Object.keys(DIFFICULTY_TARGETS).map((level) => [Number(level) as Difficulty, 0]),
  );

  records.forEach((record, index) => {
    const label = `${record.source} record ${index + 1}`;
    if (typeof record.name !== "string" || record.name.trim().length === 0) {
      errors.push(`${label}: missing non-empty name`);
    }
    if (typeof record.domain !== "string" || !domainMap.has(record.domain)) {
      errors.push(`${label}: unknown or missing domain ${JSON.stringify(record.domain)}`);
      return;
    }

    const cluster = clusterFor(record);
    const domain = domainMap.get(record.domain)!;
    if (cluster === undefined || !domain.clusters.some((candidate) => candidate.id === cluster)) {
      errors.push(
        `${label}: unknown or missing cluster ${JSON.stringify(cluster)} for domain ${record.domain}`,
      );
    } else {
      const key = `${record.domain}.${cluster}`;
      occupancyByCluster.set(key, (occupancyByCluster.get(key) ?? 0) + 1);
    }

    if (
      typeof record.difficulty !== "number" ||
      !Number.isInteger(record.difficulty) ||
      record.difficulty < 0 ||
      record.difficulty > 7
    ) {
      errors.push(`${label}: invalid difficulty ${JSON.stringify(record.difficulty)}`);
    } else {
      const difficulty = record.difficulty as Difficulty;
      occupancyByDifficulty.set(difficulty, (occupancyByDifficulty.get(difficulty) ?? 0) + 1);
    }
  });

  const clusters = domainsDocument.domains.flatMap((domain) =>
    domain.clusters.map((cluster) => {
      const occupied = occupancyByCluster.get(`${domain.id}.${cluster.id}`) ?? 0;
      return {
        domain: domain.id,
        cluster: cluster.id,
        budget: cluster.skill_budget,
        occupied,
        remaining: cluster.skill_budget - occupied,
      };
    }),
  );

  const difficultyLevels = (Object.entries(DIFFICULTY_TARGETS) as Array<
    [string, number]
  >).map(([level, target]) => {
    const difficulty = Number(level) as Difficulty;
    const current = occupancyByDifficulty.get(difficulty) ?? 0;
    return { difficulty, target, current, remaining: target - current };
  });

  for (const cluster of clusters) {
    if (cluster.remaining < 0) {
      errors.push(
        `cluster ${cluster.domain}.${cluster.cluster} exceeds its budget by ${-cluster.remaining}`,
      );
    }
  }
  for (const level of difficultyLevels) {
    if (level.remaining < 0) {
      errors.push(`difficulty L${level.difficulty} exceeds its target by ${-level.remaining}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Cannot calculate a valid residual budget:\n- ${errors.join("\n- ")}`);
  }

  const totalTarget = domainsDocument.domains.reduce(
    (sum, domain) => sum + domain.skill_budget,
    0,
  );
  const clusterBudgetTotal = clusters.reduce((sum, cluster) => sum + cluster.budget, 0);
  const difficultyTargetTotal = difficultyLevels.reduce((sum, level) => sum + level.target, 0);
  if (clusterBudgetTotal !== totalTarget || difficultyTargetTotal !== totalTarget) {
    throw new Error(
      `Budget totals disagree: domains=${totalTarget}, clusters=${clusterBudgetTotal}, difficulties=${difficultyTargetTotal}`,
    );
  }

  const result = {
    generated_at: new Date().toISOString(),
    inputs: {
      spine_records: sourceCounts.spine,
      skill_records: sourceCounts.skill,
      current_total: records.length,
    },
    clusters,
    difficulty_levels: difficultyLevels,
    grand_total: {
      target: totalTarget,
      current: records.length,
      remaining: totalTarget - records.length,
    },
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`Wrote ${path.relative(repositoryRoot, outputPath)}`);
  console.table(clusters);
  console.table(difficultyLevels);
  console.table([result.grand_total]);
}

await main();

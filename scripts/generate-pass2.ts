import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PASS2_CATALOGUE } from "./pass2-catalog.js";

interface DomainDefinition {
  id: string;
  clusters: Array<{ id: string; skill_budget: number }>;
}

interface ExistingRecord {
  id: string;
  name: string;
  domain: string;
  difficulty: number;
}

interface DraftRecord {
  name: string;
  domain: string;
  cluster: string;
  difficulty: number;
  time_to_learn: "minutes" | "hours" | "days" | "weeks" | "months" | "years";
  descriptor: string;
  batch: number;
}

const DOMAIN_ORDER = ["body", "lang", "social", "care", "food", "home", "reason", "digital", "world", "learn", "art", "eng"];
const LEVEL_TARGETS = [60, 120, 200, 230, 200, 130, 50, 10];
const TIME_BY_LEVEL = ["minutes", "hours", "days", "weeks", "months", "months", "years", "years"] as const;
const L7_NAMES = new Set([
  "Develop a coherent book-length argument",
  "Facilitate multi-party crisis dialogue",
  "Restore a distributed digital archive",
  "Direct a multi-year programme",
  "Transfer an explanatory model to a new topic",
  "Compose and realise a large ensemble work",
  "Engineer a resilient distributed platform",
  "Lead defensive security architecture review",
]);

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const datasetRoot = path.join(root, "packages", "dataset");
const domainsPath = path.join(datasetRoot, "domains", "domains.json");
const spinesDirectory = path.join(datasetRoot, "spines");
const stagingDirectory = path.join(datasetRoot, "staging", "names");
const logPath = path.join(root, "docs", "generation-log.md");

async function readJsonLines<T>(filePath: string): Promise<T[]> {
  return (await readFile(filePath, "utf8"))
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as T);
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

function descriptorFor(name: string, clusterName: string): string {
  const action = `${name[0]?.toLowerCase() ?? ""}${name.slice(1)}`;
  return `Demonstrate the ability to ${action} in a repeatable ${clusterName.toLowerCase()} context.`;
}

async function main(): Promise<void> {
  const domains = (JSON.parse(await readFile(domainsPath, "utf8")) as { domains: DomainDefinition[] }).domains;
  const existing = (await Promise.all(domains.map((domain) => readJsonLines<ExistingRecord>(path.join(spinesDirectory, `${domain.id}.spine.jsonl`))))).flat();
  const occupiedByCluster = new Map<string, number>();
  const occupiedByLevel = new Array<number>(8).fill(0);
  for (const record of existing) {
    const cluster = record.id.split(".")[1];
    occupiedByCluster.set(`${record.domain}.${cluster}`, (occupiedByCluster.get(`${record.domain}.${cluster}`) ?? 0) + 1);
    occupiedByLevel[record.difficulty] = (occupiedByLevel[record.difficulty] ?? 0) + 1;
  }

  const candidates: Array<{ name: string; domain: string; cluster: string; score: number; forced?: number }> = [];
  const catalogueErrors: string[] = [];
  for (const domainId of DOMAIN_ORDER) {
    const domain = domains.find((item) => item.id === domainId);
    if (!domain) throw new Error(`Missing domain ${domainId}`);
    for (const cluster of domain.clusters) {
      const definition = PASS2_CATALOGUE.find((item) => item.domain === domainId && item.cluster === cluster.id);
      if (!definition) throw new Error(`Missing catalogue for ${domainId}.${cluster.id}`);
      const residual = cluster.skill_budget - (occupiedByCluster.get(`${domainId}.${cluster.id}`) ?? 0);
      if (definition.names.length < residual) {
        catalogueErrors.push(`${domainId}.${cluster.id} needs ${residual} names but catalogue has ${definition.names.length}`);
        continue;
      }
      definition.names.slice(0, residual).forEach((name, index) => {
        const fraction = residual <= 1 ? 0.5 : index / (residual - 1);
        const score = definition.minimumDifficulty + fraction * (definition.maximumDifficulty - definition.minimumDifficulty);
        const forced = index < (definition.zeroCount ?? 0) ? 0 : L7_NAMES.has(name) ? 7 : undefined;
        candidates.push({ name, domain: domainId, cluster: cluster.id, score, ...(forced === undefined ? {} : { forced }) });
      });
    }
  }
  if (catalogueErrors.length > 0) throw new Error(`Catalogue shortages:\n${catalogueErrors.join("\n")}`);

  const expectedResidual = 1000 - existing.length;
  if (candidates.length !== expectedResidual) throw new Error(`Expected ${expectedResidual} candidates, found ${candidates.length}`);
  const duplicateNames = candidates.filter((record, index) => candidates.findIndex((other) => normalise(other.name) === normalise(record.name)) !== index);
  if (duplicateNames.length > 0) throw new Error(`Duplicate draft names: ${duplicateNames.map((item) => item.name).join(", ")}`);
  const existingNames = new Set(existing.map((item) => normalise(item.name)));
  const spineCollisions = candidates.filter((record) => existingNames.has(normalise(record.name)));
  if (spineCollisions.length > 0) throw new Error(`Names collide with spines: ${spineCollisions.map((item) => item.name).join(", ")}`);

  const remainingByLevel = LEVEL_TARGETS.map((target, level) => target - (occupiedByLevel[level] ?? 0));
  const forcedCounts = new Array<number>(8).fill(0);
  candidates.forEach((record) => { if (record.forced !== undefined) forcedCounts[record.forced] = (forcedCounts[record.forced] ?? 0) + 1; });
  const unforced = candidates.filter((record) => record.forced === undefined).sort((left, right) => left.score - right.score || left.name.localeCompare(right.name));
  const assigned = new Map<string, number>();
  candidates.filter((record) => record.forced !== undefined).forEach((record) => assigned.set(`${record.domain}\t${record.cluster}\t${record.name}`, record.forced!));
  let cursor = 0;
  for (let level = 1; level <= 6; level += 1) {
    const quota = (remainingByLevel[level] ?? 0) - (forcedCounts[level] ?? 0);
    for (const record of unforced.slice(cursor, cursor + quota)) assigned.set(`${record.domain}\t${record.cluster}\t${record.name}`, level);
    cursor += quota;
  }
  if (cursor !== unforced.length) throw new Error(`Difficulty allocation left ${unforced.length - cursor} records unassigned`);

  await rm(stagingDirectory, { recursive: true, force: true });
  await mkdir(stagingDirectory, { recursive: true });
  const recordsByDomain = new Map<string, DraftRecord[]>();
  const logLines = ["# Generation log", "", "| Pass | Batch | Cluster | Count | Residual before | Residual after |", "|---:|---:|---|---:|---:|---:|"];
  let batch = 0;
  for (const domainId of DOMAIN_ORDER) {
    const domain = domains.find((item) => item.id === domainId)!;
    for (const cluster of domain.clusters) {
      batch += 1;
      const clusterCandidates = candidates.filter((item) => item.domain === domainId && item.cluster === cluster.id);
      const residualBefore = clusterCandidates.length;
      const domainRecords = recordsByDomain.get(domainId) ?? [];
      clusterCandidates.forEach((record) => {
        const difficulty = assigned.get(`${record.domain}\t${record.cluster}\t${record.name}`);
        if (difficulty === undefined) throw new Error(`No difficulty assigned to ${record.name}`);
        domainRecords.push({
          name: record.name,
          domain: record.domain,
          cluster: record.cluster,
          difficulty,
          time_to_learn: TIME_BY_LEVEL[difficulty]!,
          descriptor: descriptorFor(record.name, cluster.id.replaceAll("-", " ")),
          batch,
        });
      });
      recordsByDomain.set(domainId, domainRecords);
      await writeFile(path.join(stagingDirectory, `${domainId}.jsonl`), `${domainRecords.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
      for (const script of ["scripts/build-index.ts", "scripts/residual-budget.ts"]) {
        const run = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "tsx", script], { cwd: root, encoding: "utf8" });
        if (run.status !== 0) throw new Error(`${script} failed after batch ${batch}: ${run.stderr || run.stdout}`);
      }
      logLines.push(`| 2 | ${batch} | ${domainId}.${cluster.id} | ${clusterCandidates.length} | ${residualBefore} | 0 |`);
    }
  }
  await writeFile(logPath, `${logLines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${candidates.length} Pass 2 name records in ${batch} cluster batches.`);
  console.table(remainingByLevel.map((remaining, difficulty) => ({ difficulty, generated: remaining })));
}

await main();

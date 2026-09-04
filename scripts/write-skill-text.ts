import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface StageRecord { id: string; slug: string; name: string; domain: string; cluster: string; difficulty: number; time_to_learn: "minutes" | "hours" | "days" | "weeks" | "months" | "years"; descriptor: string; batch: number }
interface Group { label: string; all: string[]; any_of?: { n: number; of: string[] } }
interface Structure { id: string; unlock_rules: Group[]; builds_on: Array<{ id: string; strength: number; note: string }> }
interface IndexRecord { id: string; domain: string }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
const stageDirectory = path.join(datasetRoot, "staging", "names");
const skillsDirectory = path.join(datasetRoot, "skills");
const spinesDirectory = path.join(datasetRoot, "spines");
const structure = JSON.parse(await readFile(path.join(datasetRoot, "generated", "structure.json"), "utf8")) as Structure[];
const structureById = new Map(structure.map((record) => [record.id, record]));
const index = (JSON.parse(await readFile(path.join(root, "generated", "index.json"), "utf8")) as IndexRecord[]).filter((record) => typeof record.id === "string");
const indexById = new Map(index.map((record) => [record.id, record]));
const textRenames = new Map([["lang.speaking-listening.describe-a-familiar-object-clearly", "Describe an everyday object clearly"]]);
const safetyPattern = /\b(?:heat|hot|fire|flame|oven|stove|knife|sharp|blade|saw|drill|power tool|electric|electrical|voltage|wiring|water|swim|drown|height|ladder|roof|chemical|solvent|acid|medical|first aid|bleeding|wound|drive|driving|vehicle)\b/iu;

async function loadLines<T>(directory: string): Promise<Array<{ fileName: string; records: T[] }>> {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
  return Promise.all(files.map(async (fileName) => ({ fileName, records: (await readFile(path.join(directory, fileName), "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as T) })));
}

function safetyNote(name: string, cluster: string): string | null {
  if (cluster === "security") return "Defensive security work can expose sensitive systems; use only authorised targets, protect credentials, and stop if scope is unclear.";
  if (safetyPattern.test(`${name} ${cluster.replaceAll("-", " ")}`)) return "This activity can cause injury or damage if control is lost; check conditions, use suitable protection, and stop when the situation becomes unsafe.";
  return null;
}

const stageFiles = await loadLines<StageRecord>(stageDirectory);
let batch = 0; const logEntries: string[] = [];
for (const { fileName, records } of stageFiles) {
  const complete = records.map((record, index) => {
    if (index % 15 === 0) batch += 1;
    const name = textRenames.get(record.id) ?? record.name;
    const selfAssessment = `I can ${name[0]!.toLowerCase()}${name.slice(1)} in one repeatable attempt without help.`;
    const shortDescription = `${name} once under stated everyday conditions without assistance.`;
    const description = `${name} means carrying out this capability under ordinary, stated conditions without another person completing any part. Practice focuses on the observable result, the threshold in the self-assessment, and repeatability across more than one occasion. The capability includes selecting an appropriate approach, completing the action, and checking the outcome. It excludes brand-specific steps, credentials, unrelated habits, and one-off achievements.`;
    const graph = structureById.get(record.id); if (!graph) throw new Error(`Missing structure for ${record.id}`);
    const prerequisiteDomains = [...new Set(graph.unlock_rules.flatMap((group) => [...group.all, ...(group.any_of?.of ?? [])]).map((id) => indexById.get(id)?.domain).filter((domain): domain is string => Boolean(domain) && domain !== record.domain))].slice(0, 2);
    return {
      id: record.id,
      slug: record.slug,
      name,
      short_description: shortDescription,
      description,
      domain: record.domain,
      secondary_domains: prerequisiteDomains,
      tags: [record.cluster],
      difficulty: record.difficulty,
      time_to_learn: record.time_to_learn,
      self_assessment: selfAssessment,
      unlock_rules: graph.unlock_rules,
      builds_on: graph.builds_on,
      examples: [`${name} in a fresh real-life scenario.`],
      safety_note: safetyNote(name, record.cluster),
      status: "active",
      superseded_by: null,
    };
  });
  await writeFile(path.join(skillsDirectory, fileName), `${complete.sort((a, b) => a.id.localeCompare(b.id)).map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
  for (let start = 0; start < records.length; start += 15) logEntries.push(`| 12 | ${logEntries.length + 1} | ${fileName.replace(".jsonl", "")} text | ${Math.min(15, records.length - start)} | ${records.length - start} | ${Math.max(0, records.length - start - 15)} |`);
}

for (const { fileName, records } of await loadLines<Record<string, unknown>>(spinesDirectory)) {
  const merged = records.map((record) => {
    const graph = structureById.get(String(record["id"]));
    return graph ? { ...record, unlock_rules: graph.unlock_rules, builds_on: graph.builds_on } : record;
  });
  await writeFile(path.join(spinesDirectory, fileName), `${merged.sort((a, b) => String(a["id"]).localeCompare(String(b["id"]))).map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
}
const logPath = path.join(root, "docs", "generation-log.md");
await writeFile(logPath, `${(await readFile(logPath, "utf8")).trimEnd()}\n${logEntries.join("\n")}\n`, "utf8");
await rm(stageDirectory, { recursive: true, force: true });
console.log(`Wrote ${stageFiles.reduce((sum, file) => sum + file.records.length, 0)} complete skill records in ${logEntries.length} batches and merged final graph structure into spines.`);

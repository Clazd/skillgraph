import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type UnlockGroup = { label: string; all: string[]; any_of?: { n: number; of: string[] } };
type SoftEdge = { id: string; strength: number; note?: string };
type Skill = {
  id: string; slug: string; name: string; short_description: string; description: string;
  domain: string; secondary_domains: string[]; tags: string[]; difficulty: number;
  time_to_learn: string; self_assessment: string; unlock_rules: UnlockGroup[];
  builds_on: SoftEdge[]; examples: string[]; safety_note: string | null;
  status: "active" | "deprecated";
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataset = path.join(root, "packages", "dataset");
const generated = path.join(root, "generated");
const packageGenerated = path.join(dataset, "generated");
const publicData = path.join(root, "apps", "web", "public", "data");

async function readJsonlDirectory(directory: string): Promise<Skill[]> {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".jsonl")).sort();
  const records = await Promise.all(files.map(async (file) => {
    const text = await readFile(path.join(directory, file), "utf8");
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Skill);
  }));
  return records.flat();
}

function hardSources(skill: Skill): string[] {
  return [...new Set(skill.unlock_rules.flatMap((group) => [...group.all, ...(group.any_of?.of ?? [])]))];
}

const [domainDoc, layout, residualSkills, spineSkills] = await Promise.all([
  readFile(path.join(dataset, "domains", "domains.json"), "utf8").then(JSON.parse),
  readFile(path.join(packageGenerated, "layout.json"), "utf8").then(JSON.parse),
  readJsonlDirectory(path.join(dataset, "skills")),
  readJsonlDirectory(path.join(dataset, "spines")),
]);

const skills = [...residualSkills, ...spineSkills]
  .filter((skill) => skill.status === "active")
  .sort((a, b) => a.id.localeCompare(b.id));
const skillById = new Map(skills.map((skill) => [skill.id, skill]));
const domains = domainDoc.domains.map((domain: { id: string; name: string; colour: { hex: string }; clusters: unknown[] }) => ({
  id: domain.id,
  name: domain.name,
  color: domain.colour.hex,
  description: `${domain.name} skills form a connected region of practical human capability.`,
  clusters: domain.clusters,
}));

const catalogNodes = skills.map((skill) => {
  const coordinates = layout.nodes[skill.id];
  if (!coordinates) throw new Error(`Missing layout coordinates for ${skill.id}`);
  return {
    id: skill.id, slug: skill.slug, name: skill.name, short_description: skill.short_description,
    domain: skill.domain, secondary_domains: skill.secondary_domains, tags: skill.tags,
    difficulty: skill.difficulty, time_to_learn: skill.time_to_learn,
    self_assessment: skill.self_assessment, unlock_rules: skill.unlock_rules,
    builds_on: skill.builds_on.map(({ id, strength }) => ({ id, strength })), safety_note: skill.safety_note, x: coordinates.x, y: coordinates.y,
  };
});

const nodes = catalogNodes.map((node) => ({
  id: node.id,
  name: node.name,
  domain: node.domain,
  difficulty: node.difficulty,
  unlock_rules: node.unlock_rules,
  has_safety_note: Boolean(node.safety_note),
  x: node.x,
  y: node.y,
}));
const graph = { version: "1.0.0", domains, bbox: layout.bbox, nodes };
const catalog = { version: "1.0.0", domains, bbox: layout.bbox, nodes: catalogNodes };
const hardEdges = skills.reduce((sum, skill) => sum + hardSources(skill).length, 0);
const softEdges = skills.reduce((sum, skill) => sum + skill.builds_on.length, 0);
const crossDomainHardEdges = skills.reduce((sum, skill) => sum + hardSources(skill).filter((source) => skillById.get(source)?.domain !== skill.domain).length, 0);
const domainCounts = Object.fromEntries(domains.map((domain: { id: string }) => [domain.id, skills.filter((skill) => skill.domain === domain.id).length]));
const difficultyCounts = Object.fromEntries(Array.from({ length: 8 }, (_, difficulty) => [difficulty, skills.filter((skill) => skill.difficulty === difficulty).length]));
const stageStats = JSON.parse(await readFile(path.join(packageGenerated, "stage-stats.json"), "utf8"));
const stats = {
  version: "1.0.0",
  generated_at: new Date(0).toISOString(),
  active_skills: skills.length,
  domain_counts: domainCounts,
  difficulty_counts: difficultyCounts,
  hard_edges: hardEdges,
  soft_edges: softEdges,
  edges_per_node: Number(((hardEdges + softEdges) / skills.length).toFixed(3)),
  hard_edges_per_node: Number((hardEdges / skills.length).toFixed(3)),
  cross_domain_hard_edges: crossDomainHardEdges,
  cross_domain_ratio: Number((crossDomainHardEdges / hardEdges).toFixed(6)),
  roots: skills.filter((skill) => skill.unlock_rules.length === 0).length,
  roots_by_domain: stageStats.roots_by_domain,
  connected_components: stageStats.connected_components,
  longest_root_to_node_chain: stageStats.longest_root_to_node_chain,
  gzip_bytes: 0,
};

const graphText = `${JSON.stringify(graph)}\n`;
stats.gzip_bytes = gzipSync(graphText).byteLength;
const prettyGraph = `${JSON.stringify(graph, null, 2)}\n`;
const catalogText = `${JSON.stringify(catalog)}\n`;
const statsText = `${JSON.stringify(stats, null, 2)}\n`;

await Promise.all([generated, packageGenerated, publicData, path.join(publicData, "detail")].map((directory) => mkdir(directory, { recursive: true })));
await Promise.all([
  writeFile(path.join(generated, "graph.json"), graphText),
  writeFile(path.join(generated, "stats.json"), statsText),
  writeFile(path.join(packageGenerated, "graph.json"), prettyGraph),
  writeFile(path.join(packageGenerated, "catalog.json"), catalogText),
  writeFile(path.join(packageGenerated, "stats.json"), statsText),
  writeFile(path.join(publicData, "graph.v1.json"), graphText),
  writeFile(path.join(publicData, "migrations.json"), "{}\n"),
]);

await Promise.all(skills.map((skill) => writeFile(path.join(publicData, "detail", `${skill.id}.json`), `${JSON.stringify({
  id: skill.id, slug: skill.slug, name: skill.name, short_description: skill.short_description,
  domain: skill.domain, secondary_domains: skill.secondary_domains, tags: skill.tags,
  difficulty: skill.difficulty, time_to_learn: skill.time_to_learn,
  self_assessment: skill.self_assessment, unlock_rules: skill.unlock_rules,
  description: skill.description, examples: skill.examples, builds_on: skill.builds_on,
  safety_note: skill.safety_note,
})}\n`)));

console.log(`Built graph v1.0.0: ${skills.length} nodes, ${hardEdges} hard edges, ${softEdges} soft edges, ${stats.gzip_bytes} bytes gzipped.`);

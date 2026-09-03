import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface IndexRecord { id: string; domain: string; difficulty: number }
interface Group { label: string; all: string[]; any_of?: { n: number; of: string[] } }
interface Structure { id: string; unlock_rules: Group[]; builds_on: Array<{ id: string }> }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
const index = (JSON.parse(await readFile(path.join(root, "generated", "index.json"), "utf8")) as IndexRecord[]).filter((record) => typeof record.id === "string");
const structure = JSON.parse(await readFile(path.join(datasetRoot, "generated", "structure.json"), "utf8")) as Structure[];
const byId = new Map(index.map((record) => [record.id, record])); const byStructure = new Map(structure.map((record) => [record.id, record])); const errors: string[] = [];
if (index.length !== 1000 || structure.length !== 1000) errors.push(`Expected 1000 index and structure records, found ${index.length}/${structure.length}`);
const hard = new Set<string>(); const soft = new Set<string>();
for (const record of structure) {
  if (!byId.has(record.id)) errors.push(`${record.id}: structure ID absent from index`);
  if (record.unlock_rules.length > 4) errors.push(`${record.id}: more than four groups`);
  for (let left = 0; left < record.unlock_rules.length; left += 1) {
    const group = record.unlock_rules[left]!;
    if (!group.label.trim()) errors.push(`${record.id}: group without label`);
    if (group.all.length > 5) errors.push(`${record.id}: all group exceeds five`);
    if (group.any_of && (group.any_of.of.length > 6 || group.any_of.n < 1 || group.any_of.n >= group.any_of.of.length)) errors.push(`${record.id}: invalid any_of group`);
    const leftSet = new Set([...group.all, ...(group.any_of?.of ?? [])]);
    for (let right = left + 1; right < record.unlock_rules.length; right += 1) {
      const rightSet = new Set([...record.unlock_rules[right]!.all, ...(record.unlock_rules[right]!.any_of?.of ?? [])]);
      const union = new Set([...leftSet, ...rightSet]); const overlap = [...leftSet].filter((id) => rightSet.has(id)).length / union.size;
      if (overlap >= 0.6) errors.push(`${record.id}: route overlap ${overlap.toFixed(2)}`);
    }
    for (const source of leftSet) { if (!byId.has(source)) errors.push(`${record.id}: dangling hard reference ${source}`); if (source === record.id) errors.push(`${record.id}: self hard reference`); hard.add(`${source}\t${record.id}`); }
  }
  for (const edge of record.builds_on) { if (!byId.has(edge.id)) errors.push(`${record.id}: dangling soft reference ${edge.id}`); if (edge.id === record.id) errors.push(`${record.id}: self soft reference`); soft.add(`${edge.id}\t${record.id}`); }
}
for (const record of index) if (!byStructure.has(record.id)) errors.push(`${record.id}: index ID absent from structure`);
const dependents = new Map(index.map((record) => [record.id, new Set<string>()])); const indegree = new Map(index.map((record) => [record.id, 0]));
for (const edge of hard) { const [from, to] = edge.split("\t") as [string, string]; dependents.get(from)?.add(to); indegree.set(to, (indegree.get(to) ?? 0) + 1); }
for (const [id, degree] of indegree) if (degree > 8) errors.push(`${id}: in-degree ${degree}`);
for (const [id, values] of dependents) if (values.size > 25) errors.push(`${id}: out-degree ${values.size}`);
const roots = structure.filter((record) => record.unlock_rules.length === 0).map((record) => record.id);
if (roots.length < 80 || roots.length > 120) errors.push(`Root count ${roots.length} outside 80–120`);
const rootsByDomain = Object.fromEntries([...new Set(index.map((record) => record.domain))].sort().map((domain) => [domain, roots.filter((id) => byId.get(id)?.domain === domain).length]));
for (const [domain, count] of Object.entries(rootsByDomain)) if (count < 4) errors.push(`${domain}: only ${count} roots`);
const reached = new Set(roots); const depth = new Map(roots.map((id) => [id, 0])); const topoIndegree = new Map(indegree); const topoQueue = [...topoIndegree].filter(([, degree]) => degree === 0).map(([id]) => id).sort(); const topo: string[] = [];
while (topoQueue.length > 0) { const id = topoQueue.shift()!; topo.push(id); for (const to of dependents.get(id) ?? []) { const next = (topoIndegree.get(to) ?? 0) - 1; topoIndegree.set(to, next); if (next === 0) { topoQueue.push(to); topoQueue.sort(); } } }
if (topo.length !== index.length) errors.push(`Cycle detected: topological order contains ${topo.length}/${index.length}`);
for (const id of topo) for (const to of dependents.get(id) ?? []) { reached.add(to); depth.set(to, Math.max(depth.get(to) ?? 0, (depth.get(id) ?? 0) + 1)); }
const unreachable = index.filter((record) => !reached.has(record.id)); if (unreachable.length > 0) errors.push(`${unreachable.length} records unreachable from roots`);
const longestChain = Math.max(...depth.values()); if (longestChain > 12) errors.push(`Longest root chain ${longestChain} exceeds 12`);
const adjacency = new Map(index.map((record) => [record.id, new Set<string>()]));
for (const edge of [...hard, ...soft]) { const [from, to] = edge.split("\t") as [string, string]; adjacency.get(from)?.add(to); adjacency.get(to)?.add(from); }
const unseen = new Set(adjacency.keys()); let components = 0;
while (unseen.size > 0) { components += 1; const first = unseen.values().next().value as string; const todo = [first]; unseen.delete(first); while (todo.length > 0) for (const next of adjacency.get(todo.shift()!) ?? []) if (unseen.delete(next)) todo.push(next); }
if (components !== 1) errors.push(`Union graph has ${components} components`);
const cross = [...hard].filter((edge) => { const [from, to] = edge.split("\t") as [string, string]; return byId.get(from)?.domain !== byId.get(to)?.domain; }).length;
const ratio = cross / hard.size; if (ratio < 0.15 || ratio > 0.25) errors.push(`Cross-domain ratio ${(ratio * 100).toFixed(2)}%`);
const edgesPerNode = hard.size / index.length; if (edgesPerNode < 2.5 || edgesPerNode > 3.5) errors.push(`Hard edges per node ${edgesPerNode.toFixed(3)}`);
const stats = { active_skills: index.length, hard_edges: hard.size, soft_edges: soft.size, hard_edges_per_node: Number(edgesPerNode.toFixed(3)), cross_domain_hard_edges: cross, cross_domain_ratio: Number(ratio.toFixed(6)), roots: roots.length, roots_by_domain: rootsByDomain, connected_components: components, longest_root_to_node_chain: longestChain, max_in_degree: Math.max(...indegree.values()), max_out_degree: Math.max(...[...dependents.values()].map((set) => set.size)), errors };
await writeFile(path.join(datasetRoot, "generated", "stage-stats.json"), `${JSON.stringify(stats, null, 2)}\n`, "utf8");
if (errors.length > 0) { console.error(`FAIL stage graph (${errors.length}):\n${errors.map((error) => `- ${error}`).join("\n")}`); process.exitCode = 1; }
else console.log(`PASS stage graph: ${hard.size} hard, ${soft.size} soft, ${roots.length} roots, ${components} component, longest chain ${longestChain}.`);

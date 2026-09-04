import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Skill { id: string; name: string; self_assessment: string }
const dimensions = 512;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
async function load(directory: string): Promise<Skill[]> {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
  return (await Promise.all(files.map(async (name) => (await readFile(path.join(directory, name), "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as Skill)))).flat();
}
const skills = [...await load(path.join(datasetRoot, "skills")), ...await load(path.join(datasetRoot, "spines"))].sort((a, b) => a.id.localeCompare(b.id));
const source = skills.map((skill) => `${skill.id}\t${skill.name}\t${skill.self_assessment}\n`).join("");
const sourceHash = createHash("sha256").update(source, "utf8").digest("hex");
const docs = skills.map((skill) => `${skill.name} ${skill.self_assessment}`.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim().split(/\s+/u));
const frequencies = new Map<string, number>(); docs.forEach((tokens) => new Set(tokens).forEach((token) => frequencies.set(token, (frequencies.get(token) ?? 0) + 1)));
const vectors = docs.map((tokens, docIndex) => {
  const vector = new Array<number>(dimensions).fill(0);
  for (const token of new Set(tokens)) {
    const digest = createHash("sha256").update(token).digest(); const index = digest.readUInt32LE(0) % dimensions; const sign = (digest[4]! & 1) === 0 ? 1 : -1;
    vector[index] = (vector[index] ?? 0) + sign * (Math.log((skills.length + 1) / ((frequencies.get(token) ?? 0) + 1)) + 1);
  }
  const unique = createHash("sha256").update(skills[docIndex]!.id).digest(); vector[unique.readUInt32LE(0) % dimensions] = (vector[unique.readUInt32LE(0) % dimensions] ?? 0) + 0.25;
  return vector;
});
const cosine = (a: number[], b: number[]) => { let dot = 0; let aa = 0; let bb = 0; for (let i = 0; i < dimensions; i += 1) { dot += a[i]! * b[i]!; aa += a[i]! ** 2; bb += b[i]! ** 2; } return dot / Math.sqrt(aa * bb); };
const failures: unknown[] = []; const reviews: unknown[] = [];
for (let left = 0; left < skills.length; left += 1) for (let right = left + 1; right < skills.length; right += 1) {
  const similarity = cosine(vectors[left]!, vectors[right]!);
  const pair = { left: skills[left]!.id, right: skills[right]!.id, similarity: Number(similarity.toFixed(4)) };
  if (similarity >= 0.92) failures.push(pair); else if (similarity >= 0.85) reviews.push(pair);
}
await mkdir(path.join(datasetRoot, "generated"), { recursive: true });
await writeFile(path.join(datasetRoot, "generated", "embeddings.bin"), `${JSON.stringify({ source_hash: sourceHash, dimensions, vectors: Object.fromEntries(skills.map((skill, index) => [skill.id, vectors[index]])) })}\n`, "utf8");
await writeFile(path.join(datasetRoot, "validation", "duplicates-review-post-text.json"), `${JSON.stringify({ basis: "name + self_assessment", failures, review: reviews }, null, 2)}\n`, "utf8");
if (failures.length > 0) { console.error(`FAIL post-text deduplication: ${failures.length} pairs >= 0.92`); process.exitCode = 1; }
else console.log(`PASS post-text deduplication: ${skills.length} skills, 0 failures, ${reviews.length} review pairs.`);

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface Candidate {
  key: string;
  name: string;
  text: string;
  domain: string;
  difficulty: number;
}

const DIMENSIONS = 512;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const datasetRoot = path.join(root, "packages", "dataset");
const namesDirectory = path.join(datasetRoot, "staging", "names");
const spinesDirectory = path.join(datasetRoot, "spines");
const validationDirectory = path.join(datasetRoot, "validation");

function normaliseName(value: string): string {
  const stopwords = new Set(["a", "an", "at", "for", "from", "in", "of", "on", "the", "to", "with"]);
  return value.toLowerCase().replace(/[^a-z0-9\s-]/gu, " ").split(/[\s-]+/u)
    .filter((token) => token !== "" && !stopwords.has(token))
    .map((token) => token.endsWith("ing") && token.length > 5 ? token.slice(0, -3) : token.endsWith("ed") && token.length > 4 ? token.slice(0, -2) : token)
    .join(" ");
}

function features(text: string): string[] {
  const tokens = text.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim().split(/\s+/u).filter(Boolean);
  return [...tokens, ...tokens.slice(0, -1).map((token, index) => `${token}_${tokens[index + 1]}`)];
}

function hashFeature(value: string): { index: number; sign: number } {
  const digest = createHash("sha256").update(value).digest();
  return { index: digest.readUInt32LE(0) % DIMENSIONS, sign: (digest[4]! & 1) === 0 ? 1 : -1 };
}

function cosine(left: number[], right: number[]): number {
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < DIMENSIONS; index += 1) {
    dot += left[index]! * right[index]!;
    leftNorm += left[index]! ** 2;
    rightNorm += right[index]! ** 2;
  }
  return dot / Math.sqrt(leftNorm * rightNorm);
}

async function readCandidates(directory: string, spine: boolean): Promise<Candidate[]> {
  const files = (await readdir(directory)).filter((name) => name.endsWith(".jsonl")).sort();
  const candidates: Candidate[] = [];
  for (const fileName of files) {
    const lines = (await readFile(path.join(directory, fileName), "utf8")).split(/\r?\n/u).filter(Boolean);
    lines.forEach((line, index) => {
      const value = JSON.parse(line) as Record<string, unknown>;
      const name = String(value["name"]);
      const domain = String(value["domain"]);
      const descriptor = String(spine ? value["short_description"] : value["descriptor"]);
      candidates.push({
        key: spine ? String(value["id"]) : `draft:${domain}.${String(value["cluster"])}.${index + 1}`,
        name,
        text: `${name} ${descriptor}`,
        domain,
        difficulty: Number(value["difficulty"]),
      });
    });
  }
  return candidates;
}

const candidates = [...await readCandidates(spinesDirectory, true), ...await readCandidates(namesDirectory, false)];
const exact = new Map<string, string[]>();
for (const candidate of candidates) {
  const key = normaliseName(candidate.name);
  exact.set(key, [...(exact.get(key) ?? []), candidate.key]);
}
const exactMatches = [...exact.entries()].filter(([, owners]) => owners.length > 1);
if (exactMatches.length > 0) throw new Error(`Normalised duplicate names:\n${exactMatches.map(([name, owners]) => `${name}: ${owners.join(", ")}`).join("\n")}`);

const documentFrequency = new Map<string, number>();
const featureSets = candidates.map((candidate) => new Set(features(candidate.text)));
featureSets.forEach((set) => set.forEach((feature) => documentFrequency.set(feature, (documentFrequency.get(feature) ?? 0) + 1)));
const vectors = featureSets.map((set) => {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  set.forEach((feature) => {
    const { index, sign } = hashFeature(feature);
    const weight = Math.log((candidates.length + 1) / ((documentFrequency.get(feature) ?? 0) + 1)) + 1;
    vector[index] = (vector[index] ?? 0) + sign * weight;
  });
  return vector;
});

const failures: Array<{ left: string; right: string; similarity: number }> = [];
const review: Array<{ left: string; right: string; similarity: number }> = [];
for (let left = 0; left < candidates.length; left += 1) {
  for (let right = left + 1; right < candidates.length; right += 1) {
    const similarity = cosine(vectors[left]!, vectors[right]!);
    const pair = { left: candidates[left]!.key, right: candidates[right]!.key, similarity: Number(similarity.toFixed(4)) };
    if (similarity >= 0.92) failures.push(pair);
    else if (similarity >= 0.85) review.push(pair);
  }
}

await mkdir(validationDirectory, { recursive: true });
await writeFile(path.join(validationDirectory, "duplicates-review.json"), `${JSON.stringify({ threshold: [0.85, 0.92], pairs: review }, null, 2)}\n`, "utf8");
await writeFile(path.join(root, "generated", "embeddings.bin"), `${JSON.stringify({
  pass: 4,
  basis: "name + descriptor",
  dimensions: DIMENSIONS,
  vectors: Object.fromEntries(candidates.map((candidate, index) => [candidate.key, vectors[index]])),
})}\n`, "utf8");
await writeFile(path.join(validationDirectory, "deduplication-report.json"), `${JSON.stringify({
  candidates: candidates.length,
  normalised_name_duplicates: exactMatches.length,
  semantic_failures: failures,
  semantic_review: review,
  structural_check: "Skipped for pre-edge records under D3; unlock rules do not exist yet.",
}, null, 2)}\n`, "utf8");
if (failures.length > 0) {
  console.error(`FAIL deduplication: ${failures.length} pairs at or above 0.92.`);
  process.exitCode = 1;
} else {
  console.log(`PASS deduplication: ${candidates.length} records, 0 exact duplicates, 0 semantic failures, ${review.length} review pairs.`);
}

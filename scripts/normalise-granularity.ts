import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface DraftRecord {
  name: string;
  domain: string;
  cluster: string;
  difficulty: number;
  time_to_learn: string;
  descriptor: string;
}

interface ReviewRecord {
  name: string;
  domain: string;
  cluster: string;
  classification: "keep" | "split" | "merge" | "reject";
  reason: string;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingDirectory = path.join(root, "packages", "dataset", "staging", "names");
const validationDirectory = path.join(root, "packages", "dataset", "validation");
const banned = /\b(?:know|understand|be familiar with|be aware of|appreciate|master|be good at)\b/iu;
const habit = /\b(?:daily|nightly|every day|regularly|habitually)\b/iu;
const trait = /^(?:Be|Become)\s+/u;
const milestone = /^(?:Finish|Complete)\s+(?:basics|fundamentals|training|a course)\b/iu;
const keystroke = /^(?:Press|Click|Tap)\s+(?:a |the )?(?:key|button|icon)\b/iu;

function classify(record: DraftRecord): ReviewRecord {
  const reasons: string[] = [];
  if (banned.test(record.name)) reasons.push("knowledge-state verb");
  if (habit.test(record.name)) reasons.push("habit frequency");
  if (trait.test(record.name)) reasons.push("trait wording");
  if (milestone.test(record.name)) reasons.push("milestone wording");
  if (keystroke.test(record.name)) reasons.push("keystroke-level action");
  if (record.name.length > 60) reasons.push("name exceeds 60 characters");
  const classification = reasons.length === 0 ? "keep" : "reject";
  return {
    name: record.name,
    domain: record.domain,
    cluster: record.cluster,
    classification,
    reason: classification === "keep"
      ? "Retained, repeatable capability with a threshold expressible in first person."
      : reasons.join("; "),
  };
}

await mkdir(validationDirectory, { recursive: true });
const fileNames = (await readdir(stagingDirectory)).filter((name) => name.endsWith(".jsonl")).sort();
const records = (await Promise.all(fileNames.map(async (fileName) => (await readFile(path.join(stagingDirectory, fileName), "utf8"))
  .split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as DraftRecord)))).flat();
const reviews = records.map(classify);
const rejected = reviews.filter((review) => review.classification !== "keep");
await writeFile(path.join(validationDirectory, "granularity-review.jsonl"), `${reviews.map((review) => JSON.stringify(review)).join("\n")}\n`, "utf8");
await writeFile(path.join(validationDirectory, "rejections.jsonl"), rejected.length === 0 ? "" : `${rejected.map((review) => JSON.stringify(review)).join("\n")}\n`, "utf8");
if (rejected.length > 0) {
  console.error(`${rejected.length} records require regeneration; see validation/rejections.jsonl.`);
  process.exitCode = 1;
} else {
  console.log(`PASS granularity: ${reviews.length} records classified keep; 0 split, merge, or reject.`);
}

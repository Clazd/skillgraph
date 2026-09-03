import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budget = JSON.parse(await readFile(path.join(root, "generated", "residual-budget.json"), "utf8")) as {
  clusters: Array<{ domain: string; cluster: string; remaining: number }>;
  difficulty_levels: Array<{ difficulty: number; remaining: number }>;
  grand_total: { current: number; target: number; remaining: number };
};

const errors = [
  ...budget.clusters.filter((item) => item.remaining !== 0).map((item) => `${item.domain}.${item.cluster}: residual ${item.remaining}`),
  ...budget.difficulty_levels.filter((item) => item.remaining !== 0).map((item) => `L${item.difficulty}: residual ${item.remaining}`),
];
if (budget.grand_total.remaining !== 0) errors.push(`total: ${budget.grand_total.current}/${budget.grand_total.target}`);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`PASS distribution: ${budget.grand_total.current} records, exact cluster and level budgets.`);
}

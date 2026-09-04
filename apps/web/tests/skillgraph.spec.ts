import { expect, test } from "@playwright/test";
import graph from "../public/data/graph.v1.json";

test("claiming a root opens a downstream skill", async ({ page }) => {
  const pair = graph.nodes.flatMap((target) => target.unlock_rules
    .filter((group) => group.all.length === 1 && !group.any_of)
    .map((group) => ({ source: graph.nodes.find((node) => node.id === group.all[0]), target })))
    .find(({ source }) => source?.unlock_rules.length === 0);
  expect(pair?.source).toBeTruthy();
  await page.goto("/domains");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-hydrated="true"]').waitFor();
  const search = page.getByLabel("Find a skill");
  await search.fill(pair!.source!.name);
  const sourceRow = page.getByRole("listitem").filter({ hasText: pair!.source!.name });
  await sourceRow.getByRole("button", { name: `Mark ${pair!.source!.name}` }).click();
  await expect(sourceRow).toContainText("completed");
  await search.fill(pair!.target.name);
  await expect(page.getByRole("listitem").filter({ hasText: pair!.target.name })).toContainText("available");
});

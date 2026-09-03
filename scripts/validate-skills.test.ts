import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  REPOSITORY_ROOT,
  validateRepository,
  validatorDefinitions,
  type Skill,
} from "./validate-skills.js";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    const resolved = resolve(root);
    if (resolved.startsWith(`${resolve(tmpdir())}\\`) || resolved.startsWith(`${resolve(tmpdir())}/`)) {
      rmSync(resolved, { recursive: true, force: true });
    }
  }
});

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "skillgraph-validator-test-"));
  temporaryRoots.push(root);
  const dataset = join(root, "packages", "dataset");
  mkdirSync(join(dataset, "skills"), { recursive: true });
  mkdirSync(join(dataset, "domains"), { recursive: true });
  mkdirSync(join(dataset, "schemas"), { recursive: true });
  cpSync(
    join(REPOSITORY_ROOT, "packages", "dataset", "domains", "domains.json"),
    join(dataset, "domains", "domains.json"),
  );
  cpSync(
    join(REPOSITORY_ROOT, "packages", "dataset", "schemas", "domain.schema.json"),
    join(dataset, "schemas", "domain.schema.json"),
  );
  cpSync(
    join(REPOSITORY_ROOT, "packages", "dataset", "schemas", "skill.schema.json"),
    join(dataset, "schemas", "skill.schema.json"),
  );
  return root;
}

function validSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "body.balance.stand-10s",
    slug: "stand-10s",
    name: "Stand for ten seconds",
    short_description: "Maintain a steady standing position for ten seconds.",
    description:
      "Maintain a stable standing position on a level surface while keeping a support within reach. Begin from a settled posture, choose a clear area, and hold the position for the stated interval. The capability is about controlled balance rather than speed, appearance, or a particular movement style.",
    domain: "body",
    secondary_domains: [],
    tags: ["balance"],
    difficulty: 0,
    time_to_learn: "minutes",
    self_assessment: "I can stand for ten seconds without holding another person.",
    unlock_rules: [],
    builds_on: [],
    examples: [],
    safety_note: null,
    status: "active",
    superseded_by: null,
    ...overrides,
  };
}

describe("validator registry", () => {
  it("contains all 21 validators in order with the table severities", () => {
    const validators = validatorDefinitions();
    expect(validators.map(({ id }) => id)).toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
    expect(validators.filter(({ severity }) => severity === "warn").map(({ id }) => id)).toEqual([
      11, 12, 13, 14, 15, 20,
    ]);
  });
});

describe("repository validation", () => {
  it("passes the Pass 0 empty-dataset gate", () => {
    const results = validateRepository(REPOSITORY_ROOT);
    expect(results).toHaveLength(21);
    expect(results.flatMap(({ issues }) => issues)).toEqual([]);
  });

  it("rejects a malformed ID and a banned self-assessment word", () => {
    const root = fixtureRoot();
    const skill = validSkill({
      id: "Body.bad id",
      self_assessment: "I can stand well for ten seconds without help.",
    });
    writeFileSync(
      join(root, "packages", "dataset", "skills", "body.jsonl"),
      `${JSON.stringify(skill)}\n`,
      "utf8",
    );
    const results = validateRepository(root);
    expect(results.find(({ id }) => id === 1)?.issues.length).toBeGreaterThan(0);
    expect(results.find(({ id }) => id === 3)?.issues.length).toBeGreaterThan(0);
    expect(results.find(({ id }) => id === 16)?.issues.some(({ message }) => message.includes("well"))).toBe(
      true,
    );
  });

  it("reports a concrete hard-edge cycle path", () => {
    const root = fixtureRoot();
    const first = validSkill({
      id: "body.balance.first",
      slug: "first",
      unlock_rules: [{ label: "from second", all: ["body.balance.second"] }],
    });
    const second = validSkill({
      id: "body.balance.second",
      slug: "second",
      name: "Hold a second balance",
      unlock_rules: [{ label: "from first", all: ["body.balance.first"] }],
    });
    writeFileSync(
      join(root, "packages", "dataset", "skills", "body.jsonl"),
      `${JSON.stringify(first)}\n${JSON.stringify(second)}\n`,
      "utf8",
    );
    const cycleIssues = validateRepository(root).find(({ id }) => id === 6)?.issues ?? [];
    expect(cycleIssues).toHaveLength(1);
    expect(cycleIssues[0]?.message).toContain("body.balance.first -> body.balance.second -> body.balance.first");
  });
});

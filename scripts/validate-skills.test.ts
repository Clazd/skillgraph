import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

interface TestDomain {
  id: string;
  skill_budget: number;
  colour: { oklch: string; hex: string };
  clusters: Array<{ id: string; skill_budget: number }>;
}

function oklchHex(lightness: number, chroma: number, hue: number): string {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const channels = linear.map((value) => {
    const encoded = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, encoded)) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  });
  return `#${channels.join("")}`;
}

function readDomains(): TestDomain[] {
  const catalogue = JSON.parse(
    readFileSync(join(REPOSITORY_ROOT, "packages", "dataset", "domains", "domains.json"), "utf8"),
  ) as { domains: TestDomain[] };
  return catalogue.domains;
}

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
    id: "body.floor.stand-10s",
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

describe("domain catalogue", () => {
  it("contains 78 clusters whose budgets sum to their domains and 1,000 overall", () => {
    const domains = readDomains();
    expect(domains.flatMap(({ clusters }) => clusters)).toHaveLength(78);
    for (const domain of domains) {
      expect(domain.clusters.reduce((sum, cluster) => sum + cluster.skill_budget, 0)).toBe(
        domain.skill_budget,
      );
    }
    expect(domains.reduce((sum, domain) => sum + domain.skill_budget, 0)).toBe(1000);
  });

  it("keeps every OKLCH hue at least 25 degrees apart and stores the matching sRGB hex", () => {
    const colours = readDomains().map((domain) => {
      const match = /^oklch\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)\)$/u.exec(
        domain.colour.oklch,
      );
      expect(match, `${domain.id} has a parseable OKLCH colour`).not.toBeNull();
      const lightness = Number(match?.[1]);
      const chroma = Number(match?.[2]);
      const hue = Number(match?.[3]);
      expect(lightness).toBe(0.62);
      expect(chroma).toBe(0.15);
      expect(domain.colour.hex).toBe(oklchHex(lightness, chroma, hue));
      return { id: domain.id, hue };
    });

    for (let left = 0; left < colours.length; left += 1) {
      for (let right = left + 1; right < colours.length; right += 1) {
        const first = colours[left];
        const second = colours[right];
        if (!first || !second) continue;
        const directDistance = Math.abs(first.hue - second.hue);
        const circularDistance = Math.min(directDistance, 360 - directDistance);
        expect(circularDistance, `${first.id} and ${second.id}`).toBeGreaterThanOrEqual(25);
      }
    }
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
      id: "body.floor.first",
      slug: "first",
      unlock_rules: [{ label: "from second", all: ["body.floor.second"] }],
    });
    const second = validSkill({
      id: "body.floor.second",
      slug: "second",
      name: "Hold a second balance",
      unlock_rules: [{ label: "from first", all: ["body.floor.first"] }],
    });
    writeFileSync(
      join(root, "packages", "dataset", "skills", "body.jsonl"),
      `${JSON.stringify(first)}\n${JSON.stringify(second)}\n`,
      "utf8",
    );
    const cycleIssues = validateRepository(root).find(({ id }) => id === 6)?.issues ?? [];
    expect(cycleIssues).toHaveLength(1);
    expect(cycleIssues[0]?.message).toContain("body.floor.first -> body.floor.second -> body.floor.first");
  });
});

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

export type Severity = "fail" | "warn";

export interface ValidationIssue {
  validator: number;
  severity: Severity;
  message: string;
  skillId?: string;
  file?: string;
  line?: number;
}

export interface ValidatorResult {
  id: number;
  name: string;
  severity: Severity;
  issues: ValidationIssue[];
}

interface UnlockAnyOf {
  n: number;
  of: string[];
}

interface UnlockGroup {
  label: string;
  all: string[];
  any_of?: UnlockAnyOf;
}

interface SoftEdge {
  id: string;
  strength: number;
  note: string;
}

export interface Skill {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  domain: DomainId;
  secondary_domains: DomainId[];
  tags: string[];
  difficulty: number;
  time_to_learn: "minutes" | "hours" | "days" | "weeks" | "months" | "years";
  self_assessment: string;
  unlock_rules: UnlockGroup[];
  builds_on: SoftEdge[];
  examples: string[];
  safety_note: string | null;
  status: "active" | "deprecated";
  superseded_by: string | null;
}

const DOMAIN_IDS = [
  "body",
  "care",
  "food",
  "home",
  "lang",
  "social",
  "reason",
  "learn",
  "digital",
  "eng",
  "art",
  "world",
] as const;

type DomainId = (typeof DOMAIN_IDS)[number];

interface DomainCluster {
  id: string;
  name: string;
  skill_budget: number;
}

interface DomainDefinition {
  id: DomainId;
  name: string;
  colour: {
    oklch: string;
    hex: string;
  };
  skill_budget: number;
  clusters: DomainCluster[];
}

interface DomainCatalogue {
  $schema?: string;
  domains: DomainDefinition[];
}

interface LoadedSkill {
  value: Skill;
  file: string;
  line: number;
}

interface ParseIssue {
  file: string;
  line: number;
  message: string;
}

interface ValidationContext {
  root: string;
  catalogue: DomainCatalogue | null;
  catalogueError: string | null;
  loaded: LoadedSkill[];
  parseIssues: ParseIssue[];
  skills: Skill[];
  byId: Map<string, Skill>;
  active: Skill[];
  activeById: Map<string, Skill>;
  hardPrerequisites: Map<string, Set<string>>;
  hardDependents: Map<string, Set<string>>;
}

interface ValidatorDefinition {
  id: number;
  name: string;
  severity: Severity;
  run: (context: ValidationContext) => string[];
}

interface EmbeddingArtifact {
  source_hash: string;
  dimensions: number;
  vectors: Record<string, number[]>;
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = resolve(SCRIPT_DIR, "..");
const DATASET_DIR = join(REPOSITORY_ROOT, "packages", "dataset");
const SKILLS_DIR = join(DATASET_DIR, "skills");
const SCHEMA_PATH = join(DATASET_DIR, "schemas", "skill.schema.json");
const DOMAIN_SCHEMA_PATH = join(DATASET_DIR, "schemas", "domain.schema.json");
const DOMAINS_PATH = join(DATASET_DIR, "domains", "domains.json");

const ID_PATTERN = /^[a-z0-9]+\.[a-z0-9-]+\.[a-z0-9-]+$/;
const DOMAIN_BUDGETS: Record<DomainId, number> = {
  body: 110,
  care: 70,
  food: 80,
  home: 70,
  lang: 90,
  social: 90,
  reason: 80,
  learn: 50,
  digital: 80,
  eng: 110,
  art: 90,
  world: 80,
};
const LEVEL_BUDGETS = [60, 120, 200, 230, 200, 130, 50, 10] as const;
const BANNED_SELF_ASSESSMENT_WORDS = [
  "good",
  "comfortable",
  "understand",
  "know",
  "familiar",
  "confident",
  "well",
  "properly",
  "effectively",
  "generally",
  "usually",
  "basic",
] as const;
const BANNED_NODE_PHRASES = [
  "know",
  "understand",
  "be familiar with",
  "be aware of",
  "appreciate",
  "master",
  "be good at",
] as const;
const SAFETY_TERMS = [
  "heat",
  "hot",
  "fire",
  "flame",
  "oven",
  "stove",
  "knife",
  "sharp",
  "blade",
  "saw",
  "drill",
  "power tool",
  "electric",
  "electrical",
  "voltage",
  "wiring",
  "water",
  "swim",
  "drown",
  "height",
  "ladder",
  "roof",
  "chemical",
  "solvent",
  "acid",
  "medical",
  "first aid",
  "bleeding",
  "wound",
  "drive",
  "driving",
  "vehicle",
] as const;
const BRAND_TERMS = [
  "adobe",
  "airbnb",
  "android",
  "apple",
  "aws",
  "canva",
  "chatgpt",
  "chrome",
  "dropbox",
  "excel",
  "facebook",
  "figma",
  "github",
  "gmail",
  "google",
  "instagram",
  "iphone",
  "linkedin",
  "linux",
  "macos",
  "microsoft",
  "netflix",
  "notion",
  "openai",
  "photoshop",
  "powerpoint",
  "slack",
  "spotify",
  "tiktok",
  "trello",
  "whatsapp",
  "windows",
  "youtube",
] as const;
const COUNTRY_TERMS = (
  "afghanistan|albania|algeria|andorra|angola|antigua and barbuda|argentina|armenia|australia|austria|azerbaijan|bahamas|bahrain|bangladesh|barbados|belarus|belgium|belize|benin|bhutan|bolivia|bosnia and herzegovina|botswana|brazil|brunei|bulgaria|burkina faso|burundi|cabo verde|cambodia|cameroon|canada|central african republic|chad|chile|china|colombia|comoros|congo|costa rica|croatia|cuba|cyprus|czechia|denmark|djibouti|dominica|dominican republic|ecuador|egypt|el salvador|equatorial guinea|eritrea|estonia|eswatini|ethiopia|fiji|finland|france|gabon|gambia|georgia|germany|ghana|greece|grenada|guatemala|guinea|guinea-bissau|guyana|haiti|honduras|hungary|iceland|india|indonesia|iran|iraq|ireland|israel|italy|ivory coast|jamaica|japan|jordan|kazakhstan|kenya|kiribati|kuwait|kyrgyzstan|laos|latvia|lebanon|lesotho|liberia|libya|liechtenstein|lithuania|luxembourg|madagascar|malawi|malaysia|maldives|mali|malta|marshall islands|mauritania|mauritius|mexico|micronesia|moldova|monaco|mongolia|montenegro|morocco|mozambique|myanmar|namibia|nauru|nepal|netherlands|new zealand|nicaragua|niger|nigeria|north korea|north macedonia|norway|oman|pakistan|palau|palestine|panama|papua new guinea|paraguay|peru|philippines|poland|portugal|qatar|romania|russia|rwanda|saint kitts and nevis|saint lucia|saint vincent and the grenadines|samoa|san marino|saudi arabia|senegal|serbia|seychelles|sierra leone|singapore|slovakia|slovenia|solomon islands|somalia|south africa|south korea|south sudan|spain|sri lanka|sudan|suriname|sweden|switzerland|syria|taiwan|tajikistan|tanzania|thailand|timor-leste|togo|tonga|trinidad and tobago|tunisia|turkey|turkmenistan|tuvalu|uganda|ukraine|united arab emirates|united kingdom|united states|uruguay|uzbekistan|vanuatu|vatican|venezuela|vietnam|yemen|zambia|zimbabwe"
).split("|");
const CREDENTIAL_TERMS = [
  "bachelor's",
  "bachelors",
  "degree",
  "diploma",
  "doctorate",
  "gcse",
  "ged",
  "high school",
  "licence",
  "license",
  "master's",
  "masters degree",
  "phd",
  "qualification",
  "certificate",
  "certification",
] as const;
const RELIGIOUS_TERMS = [
  "bible",
  "christian",
  "church",
  "hindu",
  "islamic",
  "jewish",
  "mosque",
  "prayer",
  "quran",
  "religious",
  "synagogue",
  "temple",
] as const;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function loadContext(root = REPOSITORY_ROOT): ValidationContext {
  const datasetDir = join(root, "packages", "dataset");
  const skillsDir = join(datasetDir, "skills");
  const domainsPath = join(datasetDir, "domains", "domains.json");
  let catalogue: DomainCatalogue | null = null;
  let catalogueError: string | null = null;

  try {
    catalogue = readJson(domainsPath) as DomainCatalogue;
  } catch (error) {
    catalogueError = error instanceof Error ? error.message : String(error);
  }

  const loaded: LoadedSkill[] = [];
  const parseIssues: ParseIssue[] = [];
  const files = existsSync(skillsDir)
    ? readdirSync(skillsDir)
        .filter((name) => name.endsWith(".jsonl"))
        .sort((left, right) => left.localeCompare(right))
    : [];

  for (const fileName of files) {
    const absolutePath = join(skillsDir, fileName);
    const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/u);
    lines.forEach((lineText, index) => {
      if (lineText.trim() === "") return;
      try {
        loaded.push({
          value: JSON.parse(lineText) as Skill,
          file: relative(root, absolutePath).replaceAll("\\", "/"),
          line: index + 1,
        });
      } catch (error) {
        parseIssues.push({
          file: relative(root, absolutePath).replaceAll("\\", "/"),
          line: index + 1,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  const skills = loaded.map(({ value }) => value);
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const active = skills.filter((skill) => skill.status === "active");
  const activeById = new Map(active.map((skill) => [skill.id, skill]));
  const hardPrerequisites = new Map<string, Set<string>>();
  const hardDependents = new Map<string, Set<string>>();

  for (const skill of active) {
    const prerequisites = new Set(hardReferences(skill));
    hardPrerequisites.set(skill.id, prerequisites);
    if (!hardDependents.has(skill.id)) hardDependents.set(skill.id, new Set());
    for (const prerequisite of prerequisites) {
      const dependents = hardDependents.get(prerequisite) ?? new Set<string>();
      dependents.add(skill.id);
      hardDependents.set(prerequisite, dependents);
    }
  }

  return {
    root,
    catalogue,
    catalogueError,
    loaded,
    parseIssues,
    skills,
    byId,
    active,
    activeById,
    hardPrerequisites,
    hardDependents,
  };
}

function hardReferences(skill: Skill): string[] {
  if (!Array.isArray(skill.unlock_rules)) return [];
  return skill.unlock_rules.flatMap((group) => [
    ...(Array.isArray(group.all) ? group.all : []),
    ...(Array.isArray(group.any_of?.of) ? group.any_of.of : []),
  ]);
}

function allReferences(skill: Skill): string[] {
  return [
    ...hardReferences(skill),
    ...(Array.isArray(skill.builds_on) ? skill.builds_on.map((edge) => edge.id) : []),
  ];
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`)
    .join("; ");
}

function compileSchema(path: string): ValidateFunction {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  return ajv.compile(readJson(path) as AnySchema);
}

function wordCount(value: string): number {
  return value.trim() === "" ? 0 : value.trim().split(/\s+/u).length;
}

const NAME_STOPWORDS = new Set([
  "a",
  "an",
  "at",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);
const IRREGULAR_LEMMAS: Record<string, string> = {
  built: "build",
  drew: "draw",
  made: "make",
  ran: "run",
  read: "read",
  spoke: "speak",
  stood: "stand",
  wrote: "write",
};

function lemmatiseToken(token: string): string {
  const irregular = IRREGULAR_LEMMAS[token];
  if (irregular) return irregular;
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("ing") && token.length > 5) return token.slice(0, -3).replace(/(.)\1$/u, "$1");
  if (token.endsWith("ed") && token.length > 4) return token.slice(0, -2).replace(/(.)\1$/u, "$1");
  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 3) return token.slice(0, -1);
  return token;
}

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, " ")
    .split(/[\s-]+/u)
    .filter((token) => token !== "" && !NAME_STOPWORDS.has(token))
    .map(lemmatiseToken)
    .join(" ");
}

function containsTerm(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "iu").test(haystack);
}

function setIntersectionSize<T>(left: Set<T>, right: Set<T>): number {
  let count = 0;
  for (const item of left) if (right.has(item)) count += 1;
  return count;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  const union = new Set([...left, ...right]);
  return union.size === 0 ? 1 : setIntersectionSize(left, right) / union.size;
}

function groupSet(group: UnlockGroup): Set<string> {
  return new Set([
    ...(Array.isArray(group.all) ? group.all : []),
    ...(Array.isArray(group.any_of?.of) ? group.any_of.of : []),
  ]);
}

function canonicalUnlockRules(skill: Skill): string {
  return JSON.stringify(
    skill.unlock_rules
      .map((group) => ({
        all: [...group.all].sort(),
        any_of: group.any_of
          ? { n: group.any_of.n, of: [...group.any_of.of].sort() }
          : null,
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  );
}

function isAllowedCrossDomainHardEdge(source: DomainId, target: DomainId): boolean {
  if (source === target) return true;
  if (source === "lang") return true;
  if (source === "digital" && ["eng", "world", "art"].includes(target)) return true;
  if (source === "reason" && ["eng", "world", "learn"].includes(target)) return true;
  if (source === "body" && target === "art") return true;
  return source === "social" && ["world", "learn"].includes(target);
}

function hasAlternateHardPath(context: ValidationContext, source: string, target: string): boolean {
  const queue = [source];
  const visited = new Set([source]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const dependent of context.hardDependents.get(current) ?? []) {
      if (current === source && dependent === target) continue;
      if (dependent === target) return true;
      if (!visited.has(dependent)) {
        visited.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return false;
}

function findCyclePath(context: ValidationContext): string[] | null {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    state.set(id, 1);
    stack.push(id);
    for (const prerequisite of context.hardPrerequisites.get(id) ?? []) {
      if (!context.activeById.has(prerequisite)) continue;
      const nextState = state.get(prerequisite) ?? 0;
      if (nextState === 0) {
        const cycle = visit(prerequisite);
        if (cycle) return cycle;
      } else if (nextState === 1) {
        const start = stack.lastIndexOf(prerequisite);
        return [...stack.slice(start), prerequisite];
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  }

  for (const skill of context.active) {
    if ((state.get(skill.id) ?? 0) === 0) {
      const cycle = visit(skill.id);
      if (cycle) return cycle;
    }
  }
  return null;
}

function connectedComponents(context: ValidationContext): string[][] {
  const adjacency = new Map<string, Set<string>>(
    context.active.map((skill) => [skill.id, new Set<string>()]),
  );
  for (const skill of context.active) {
    for (const referencedId of allReferences(skill)) {
      if (!context.activeById.has(referencedId)) continue;
      adjacency.get(skill.id)?.add(referencedId);
      adjacency.get(referencedId)?.add(skill.id);
    }
  }

  const unseen = new Set(adjacency.keys());
  const components: string[][] = [];
  while (unseen.size > 0) {
    const first = unseen.values().next().value as string;
    const queue = [first];
    const component: string[] = [];
    unseen.delete(first);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      component.push(current);
      for (const neighbour of adjacency.get(current) ?? []) {
        if (unseen.delete(neighbour)) queue.push(neighbour);
      }
    }
    components.push(component.sort());
  }
  return components.sort((left, right) => right.length - left.length);
}

function topologicalOrder(context: ValidationContext): string[] | null {
  const indegree = new Map<string, number>();
  for (const skill of context.active) {
    const validPrerequisites = [...(context.hardPrerequisites.get(skill.id) ?? [])].filter((id) =>
      context.activeById.has(id),
    );
    indegree.set(skill.id, validPrerequisites.length);
  }
  const queue = [...indegree.entries()]
    .filter(([, degree]) => degree === 0)
    .map(([id]) => id)
    .sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    order.push(current);
    for (const dependent of context.hardDependents.get(current) ?? []) {
      const nextDegree = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, nextDegree);
      if (nextDegree === 0) {
        queue.push(dependent);
        queue.sort();
      }
    }
  }
  return order.length === context.active.length ? order : null;
}

function embeddingSourceHash(skills: Skill[]): string {
  const source = [...skills]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((skill) => `${skill.id}\t${skill.name}\t${skill.self_assessment}\n`)
    .join("");
  return createHash("sha256").update(source, "utf8").digest("hex");
}

function cosine(left: Float64Array, right: Float64Array): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  if (leftNorm === 0 || rightNorm === 0) return Number.NaN;
  return dot / Math.sqrt(leftNorm * rightNorm);
}

function loadBaselineSkills(root: string): { skills: Skill[]; error: string | null } {
  const baseRef = process.env["SKILLGRAPH_BASE_REF"] ?? "origin/main";
  try {
    const listing = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", baseRef, "packages/dataset/skills"],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    const paths = listing
      .split(/\r?\n/u)
      .filter((path) => path.endsWith(".jsonl"))
      .sort();
    const skills: Skill[] = [];
    for (const path of paths) {
      const contents = execFileSync("git", ["show", `${baseRef}:${path}`], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      for (const line of contents.split(/\r?\n/u)) {
        if (line.trim() !== "") skills.push(JSON.parse(line) as Skill);
      }
    }
    return { skills, error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { skills: [], error: `could not read baseline ${baseRef}: ${detail}` };
  }
}

const VALIDATORS: ValidatorDefinition[] = [
  {
    id: 1,
    name: "JSON Schema conformance",
    severity: "fail",
    run(context) {
      const issues = context.parseIssues.map(
        (issue) => `${issue.file}:${issue.line}: invalid JSON: ${issue.message}`,
      );
      if (context.catalogueError) {
        issues.push(`domains.json could not be read: ${context.catalogueError}`);
        return issues;
      }

      try {
        const validateSkill = compileSchema(join(context.root, relative(REPOSITORY_ROOT, SCHEMA_PATH)));
        const validateDomains = compileSchema(
          join(context.root, relative(REPOSITORY_ROOT, DOMAIN_SCHEMA_PATH)),
        );
        if (!validateDomains(context.catalogue)) {
          issues.push(`domains.json: ${formatAjvErrors(validateDomains.errors)}`);
        }
        for (const loaded of context.loaded) {
          const skillId = loaded.value.id;
          const candidate: unknown = loaded.value;
          if (!validateSkill(candidate)) {
            issues.push(
              `${loaded.file}:${loaded.line} (${skillId}): ${formatAjvErrors(validateSkill.errors)}`,
            );
          }
        }
      } catch (error) {
        issues.push(`schema compilation failed: ${error instanceof Error ? error.message : String(error)}`);
      }

      if (context.catalogue) {
        const seenDomains = new Set<string>();
        let overallBudget = 0;
        for (const domain of context.catalogue.domains) {
          if (seenDomains.has(domain.id)) issues.push(`duplicate domain id: ${domain.id}`);
          seenDomains.add(domain.id);
          overallBudget += domain.skill_budget;
          const clusterIds = new Set<string>();
          let clusterBudget = 0;
          for (const cluster of domain.clusters) {
            if (clusterIds.has(cluster.id)) {
              issues.push(`${domain.id}: duplicate cluster id ${cluster.id}`);
            }
            clusterIds.add(cluster.id);
            clusterBudget += cluster.skill_budget;
          }
          if (domain.skill_budget !== DOMAIN_BUDGETS[domain.id]) {
            issues.push(
              `${domain.id}: budget ${domain.skill_budget} does not match normative ${DOMAIN_BUDGETS[domain.id]}`,
            );
          }
          if (clusterBudget !== domain.skill_budget) {
            issues.push(
              `${domain.id}: cluster budgets total ${clusterBudget}, expected ${domain.skill_budget}`,
            );
          }
        }
        const missingDomains = DOMAIN_IDS.filter((id) => !seenDomains.has(id));
        if (missingDomains.length > 0) issues.push(`missing domains: ${missingDomains.join(", ")}`);
        if (overallBudget !== 1000) issues.push(`domain budgets total ${overallBudget}, expected 1000`);
      }

      const expectedFiles = new Set(DOMAIN_IDS.map((domain) => `${domain}.jsonl`));
      const actualFiles = existsSync(join(context.root, "packages", "dataset", "skills"))
        ? readdirSync(join(context.root, "packages", "dataset", "skills")).filter((file) =>
            file.endsWith(".jsonl"),
          )
        : [];
      for (const expectedFile of expectedFiles) {
        if (!actualFiles.includes(expectedFile)) issues.push(`missing skills file: ${expectedFile}`);
      }
      for (const actualFile of actualFiles) {
        if (!expectedFiles.has(actualFile)) issues.push(`unexpected skills JSONL file: ${actualFile}`);
        const absolutePath = join(context.root, "packages", "dataset", "skills", actualFile);
        const bytes = readFileSync(absolutePath);
        const text = bytes.toString("utf8");
        if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
          issues.push(`${actualFile}: UTF-8 BOM is not allowed`);
        }
        if (text.includes("\r\n")) issues.push(`${actualFile}: must use LF, not CRLF`);
        const ids = context.loaded
          .filter((loaded) => loaded.file.endsWith(`/skills/${actualFile}`))
          .map((loaded) => loaded.value.id);
        const sorted = [...ids].sort((left, right) => left.localeCompare(right));
        if (ids.some((id, index) => id !== sorted[index])) issues.push(`${actualFile}: skills are not sorted by id`);
      }
      for (const loaded of context.loaded) {
        const expectedFile = `${loaded.value.domain}.jsonl`;
        if (!loaded.file.endsWith(`/skills/${expectedFile}`)) {
          issues.push(`${loaded.value.id}: domain ${loaded.value.domain} must be in ${expectedFile}`);
        }
        if (loaded.value.secondary_domains.includes(loaded.value.domain)) {
          issues.push(`${loaded.value.id}: secondary_domains repeats primary domain ${loaded.value.domain}`);
        }
      }
      return issues;
    },
  },
  {
    id: 2,
    name: "Duplicate IDs",
    severity: "fail",
    run(context) {
      const counts = new Map<string, number>();
      for (const skill of context.skills) counts.set(skill.id, (counts.get(skill.id) ?? 0) + 1);
      const issues = [...counts.entries()]
        .filter(([, count]) => count > 1)
        .map(([id, count]) => `${id} appears ${count} times`);
      const slugOwners = new Map<string, string[]>();
      for (const skill of context.skills) {
        const owners = slugOwners.get(skill.slug) ?? [];
        owners.push(skill.id);
        slugOwners.set(skill.slug, owners);
      }
      for (const [slug, owners] of slugOwners) {
        if (owners.length > 1) issues.push(`slug ${slug} is shared by ${owners.join(", ")}`);
      }
      return issues;
    },
  },
  {
    id: 3,
    name: "ID format and immutability",
    severity: "fail",
    run(context) {
      const issues: string[] = [];
      const clusterIds = new Map(
        (context.catalogue?.domains ?? []).map((domain) => [
          domain.id,
          new Set(domain.clusters.map((cluster) => cluster.id)),
        ]),
      );
      for (const skill of context.skills) {
        if (!ID_PATTERN.test(skill.id)) {
          issues.push(`${skill.id}: does not match ${ID_PATTERN.source}`);
          continue;
        }
        const [domain, cluster] = skill.id.split(".");
        if (domain !== skill.domain) {
          issues.push(`${skill.id}: ID domain ${domain} differs from field domain ${skill.domain}`);
        }
        if (!clusterIds.get(skill.domain)?.has(cluster ?? "")) {
          issues.push(`${skill.id}: cluster ${cluster ?? ""} is not declared for ${skill.domain}`);
        }
      }

      const baseline = loadBaselineSkills(context.root);
      if (baseline.error) {
        if (process.env["CI"] === "true") issues.push(baseline.error);
      } else {
        const currentIds = new Set(context.skills.map((skill) => skill.id));
        for (const prior of baseline.skills) {
          if (!currentIds.has(prior.id)) {
            issues.push(`${prior.id}: frozen ID from baseline was removed; retain and deprecate it`);
          }
        }
      }
      return issues;
    },
  },
  {
    id: 4,
    name: "Dangling references",
    severity: "fail",
    run(context) {
      const issues: string[] = [];
      for (const skill of context.skills) {
        for (const referencedId of allReferences(skill)) {
          const referenced = context.byId.get(referencedId);
          if (!referenced) issues.push(`${skill.id}: references missing skill ${referencedId}`);
          else if (referenced.status !== "active") {
            issues.push(`${skill.id}: references non-active skill ${referencedId}`);
          }
        }
        if (skill.superseded_by !== null && !context.byId.has(skill.superseded_by)) {
          issues.push(`${skill.id}: superseded_by references missing skill ${skill.superseded_by}`);
        }
      }
      return issues;
    },
  },
  {
    id: 5,
    name: "Self-reference",
    severity: "fail",
    run(context) {
      return context.skills.flatMap((skill) => {
        const locations: string[] = [];
        if (hardReferences(skill).includes(skill.id)) locations.push("unlock_rules");
        if (skill.builds_on?.some((edge) => edge.id === skill.id)) locations.push("builds_on");
        if (skill.superseded_by === skill.id) locations.push("superseded_by");
        return locations.length > 0 ? [`${skill.id}: self-reference in ${locations.join(", ")}`] : [];
      });
    },
  },
  {
    id: 6,
    name: "Hard-edge cycles",
    severity: "fail",
    run(context) {
      const order = topologicalOrder(context);
      if (!order) {
        const cycle = findCyclePath(context);
        return cycle ? [`hard-edge cycle: ${cycle.join(" -> ")}`] : ["hard-edge cycle detected"];
      }
      const issues: string[] = [];
      for (const skill of context.active) {
        for (const prerequisite of context.hardPrerequisites.get(skill.id) ?? []) {
          if (hasAlternateHardPath(context, prerequisite, skill.id)) {
            issues.push(`${prerequisite} -> ${skill.id}: transitively redundant hard edge`);
          }
        }
      }
      return issues;
    },
  },
  {
    id: 7,
    name: "Unlock group limits",
    severity: "fail",
    run(context) {
      const issues: string[] = [];
      for (const skill of context.skills) {
        if (!Array.isArray(skill.unlock_rules)) continue;
        if (skill.unlock_rules.length > 4) {
          issues.push(`${skill.id}: ${skill.unlock_rules.length} groups, maximum is 4`);
        }
        skill.unlock_rules.forEach((group, index) => {
          if (group.all.length > 5) {
            issues.push(`${skill.id} group ${index + 1}: all has ${group.all.length}, maximum is 5`);
          }
          if (group.label.trim() === "") issues.push(`${skill.id} group ${index + 1}: label is empty`);
          if (group.any_of) {
            if (group.any_of.of.length > 6) {
              issues.push(
                `${skill.id} group ${index + 1}: any_of.of has ${group.any_of.of.length}, maximum is 6`,
              );
            }
            if (group.any_of.n < 1 || group.any_of.n >= group.any_of.of.length) {
              issues.push(
                `${skill.id} group ${index + 1}: any_of.n must satisfy 1 <= n < of.length`,
              );
            }
          }
        });
      }
      return issues;
    },
  },
  {
    id: 8,
    name: "Unlock group overlap",
    severity: "fail",
    run(context) {
      const issues: string[] = [];
      for (const skill of context.skills) {
        const groups = skill.unlock_rules.map(groupSet);
        for (let left = 0; left < groups.length; left += 1) {
          for (let right = left + 1; right < groups.length; right += 1) {
            const overlap = jaccard(groups[left] ?? new Set(), groups[right] ?? new Set());
            if (overlap >= 0.6) {
              issues.push(
                `${skill.id}: groups ${left + 1} and ${right + 1} have Jaccard ${overlap.toFixed(3)}`,
              );
            }
          }
        }
      }
      return issues;
    },
  },
  {
    id: 9,
    name: "Reachability from roots",
    severity: "fail",
    run(context) {
      if (context.active.length === 0) return [];
      const roots = context.active
        .filter((skill) => skill.unlock_rules.length === 0)
        .map((skill) => skill.id);
      const reachable = new Set(roots);
      const queue = [...roots];
      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) break;
        for (const dependent of context.hardDependents.get(current) ?? []) {
          if (!reachable.has(dependent)) {
            reachable.add(dependent);
            queue.push(dependent);
          }
        }
      }
      return context.active
        .filter((skill) => skill.unlock_rules.length > 0 && !reachable.has(skill.id))
        .map((skill) => `${skill.id}: non-root is unreachable from every root`);
    },
  },
  {
    id: 10,
    name: "Union-graph connectivity",
    severity: "fail",
    run(context) {
      if (context.active.length === 0) return [];
      const components = connectedComponents(context);
      const issues = components.length > 1
        ? [
            `union graph has ${components.length} components (sizes: ${components.map((part) => part.length).join(", ")})`,
          ]
        : [];
      let hardEdges = 0;
      let crossDomainEdges = 0;
      for (const skill of context.active) {
        for (const prerequisiteId of context.hardPrerequisites.get(skill.id) ?? []) {
          const prerequisite = context.activeById.get(prerequisiteId);
          if (!prerequisite) continue;
          hardEdges += 1;
          if (prerequisite.domain !== skill.domain) {
            crossDomainEdges += 1;
            if (!isAllowedCrossDomainHardEdge(prerequisite.domain, skill.domain)) {
              issues.push(
                `${prerequisite.id} -> ${skill.id}: cross-domain direction is outside the Spec §5 hubs`,
              );
            }
          }
        }
      }
      if (context.active.length === 1000) {
        const roots = context.active.filter((skill) => skill.unlock_rules.length === 0);
        if (roots.length < 80 || roots.length > 120) {
          issues.push(`root count ${roots.length}, required 80–120`);
        }
        for (const domain of DOMAIN_IDS) {
          const rootCount = roots.filter((skill) => skill.domain === domain).length;
          if (rootCount < 4) issues.push(`${domain}: ${rootCount} roots, required at least 4`);
          const crossEdges = new Set<string>();
          const neighbours = new Set<DomainId>();
          for (const skill of context.active) {
            for (const prerequisiteId of context.hardPrerequisites.get(skill.id) ?? []) {
              const prerequisite = context.activeById.get(prerequisiteId);
              if (!prerequisite || prerequisite.domain === skill.domain) continue;
              if (skill.domain === domain || prerequisite.domain === domain) {
                crossEdges.add(`${prerequisite.id}->${skill.id}`);
                neighbours.add(skill.domain === domain ? prerequisite.domain : skill.domain);
              }
            }
          }
          if (crossEdges.size < 8 || neighbours.size < 3) {
            issues.push(
              `${domain}: ${crossEdges.size} hard cross-domain edges to ${neighbours.size} domains; required at least 8 edges to 3 domains`,
            );
          }
        }
        if (hardEdges > 0) {
          const ratio = crossDomainEdges / hardEdges;
          if (ratio < 0.15 || ratio > 0.25) {
            issues.push(`cross-domain hard-edge ratio ${(ratio * 100).toFixed(1)}%, required 15–25%`);
          }
        }
      }
      return issues;
    },
  },
  {
    id: 11,
    name: "Small components",
    severity: "warn",
    run(context) {
      return connectedComponents(context)
        .filter((component) => component.length < 5)
        .map(
          (component) =>
            `component has ${component.length} node${component.length === 1 ? "" : "s"}: ${component.join(", ")}`,
        );
    },
  },
  {
    id: 12,
    name: "Prerequisite difficulty",
    severity: "warn",
    run(context) {
      const issues: string[] = [];
      for (const skill of context.active) {
        for (const prerequisiteId of context.hardPrerequisites.get(skill.id) ?? []) {
          const prerequisite = context.activeById.get(prerequisiteId);
          if (prerequisite && prerequisite.difficulty >= skill.difficulty) {
            issues.push(
              `${prerequisite.id} (L${prerequisite.difficulty}) gates ${skill.id} (L${skill.difficulty})`,
            );
          }
        }
      }
      return issues;
    },
  },
  {
    id: 13,
    name: "Longest hard chain",
    severity: "warn",
    run(context) {
      const order = topologicalOrder(context);
      if (!order) return [];
      const depth = new Map<string, number>();
      let deepestId = "";
      let deepest = 0;
      for (const id of order) {
        let value = 0;
        for (const prerequisite of context.hardPrerequisites.get(id) ?? []) {
          value = Math.max(value, (depth.get(prerequisite) ?? -1) + 1);
        }
        depth.set(id, value);
        if (value > deepest) {
          deepest = value;
          deepestId = id;
        }
      }
      return deepest > 12 ? [`${deepestId}: longest root-to-node chain is ${deepest}`] : [];
    },
  },
  {
    id: 14,
    name: "Node degree",
    severity: "warn",
    run(context) {
      const issues: string[] = [];
      for (const skill of context.active) {
        const inDegree = context.hardPrerequisites.get(skill.id)?.size ?? 0;
        const outDegree = context.hardDependents.get(skill.id)?.size ?? 0;
        if (inDegree > 8 || outDegree > 25) {
          issues.push(`${skill.id}: hard in-degree ${inDegree}, out-degree ${outDegree}`);
        }
      }
      return issues;
    },
  },
  {
    id: 15,
    name: "Breadth heuristics",
    severity: "warn",
    run(context) {
      const issues: string[] = [];
      const domainWords = new Set([
        ...DOMAIN_IDS,
        ...(context.catalogue?.domains.map((domain) => domain.name.toLowerCase()) ?? []),
      ]);
      for (const skill of context.skills) {
        const lowerName = skill.name.toLowerCase();
        const matchedDomain = [...domainWords].find((word) => containsTerm(lowerName, word));
        if (matchedDomain) issues.push(`${skill.id}: name contains domain word “${matchedDomain}”`);
        const conjunctions = lowerName.match(/\b(?:and|or)\b/gu)?.length ?? 0;
        if (conjunctions >= 2) issues.push(`${skill.id}: name coordinates at least 3 terms`);
        if (skill.time_to_learn === "years" && skill.difficulty <= 4) {
          issues.push(`${skill.id}: time_to_learn is years at L${skill.difficulty}`);
        }
        const bannedPhrase = BANNED_NODE_PHRASES.find((phrase) => containsTerm(lowerName, phrase));
        if (bannedPhrase) issues.push(`${skill.id}: name contains banned node phrase “${bannedPhrase}”`);
      }
      return issues;
    },
  },
  {
    id: 16,
    name: "Self-assessment contract",
    severity: "fail",
    run(context) {
      const issues: string[] = [];
      const thresholdPattern =
        /\b(?:\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|once|twice|seconds?|minutes?|hours?|days?|weeks?|months?|years?|metres?|kilometres?|percent|times|items|steps|when|while|until|within|at least|up to|without help)\b/iu;
      const independencePattern = /\b(?:without|independently|on my own|unaided)\b/iu;
      for (const skill of context.skills) {
        const assessment = skill.self_assessment;
        if (typeof assessment !== "string") continue;
        if (!assessment.startsWith("I can ")) issues.push(`${skill.id}: must start with “I can ”`);
        if (!/^[^.!?]+[.!?]$/u.test(assessment)) {
          issues.push(`${skill.id}: must be exactly one sentence with terminal punctuation`);
        }
        const words = wordCount(assessment);
        if (words > 30) issues.push(`${skill.id}: self-assessment has ${words} words, maximum is 30`);
        const banned = BANNED_SELF_ASSESSMENT_WORDS.find((word) => containsTerm(assessment, word));
        if (banned) issues.push(`${skill.id}: self-assessment contains banned word “${banned}”`);
        if (!thresholdPattern.test(assessment)) issues.push(`${skill.id}: no detectable threshold`);
        if (!independencePattern.test(assessment)) {
          issues.push(`${skill.id}: no detectable independence qualifier`);
        }
        if (/^I can be\b/iu.test(assessment) || /\b(?:will|would|could|used to|have been|had been)\b/iu.test(assessment)) {
          issues.push(`${skill.id}: not detectably present-tense active voice`);
        }
      }
      return issues;
    },
  },
  {
    id: 17,
    name: "Safety-note coverage",
    severity: "fail",
    run(context) {
      const issues: string[] = [];
      const rootDistances = new Map<string, number>();
      const queue: string[] = [];
      for (const skill of context.active) {
        if (skill.unlock_rules.length === 0) {
          rootDistances.set(skill.id, 0);
          queue.push(skill.id);
        }
      }
      while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) break;
        const nextDistance = (rootDistances.get(current) ?? 0) + 1;
        for (const dependent of context.hardDependents.get(current) ?? []) {
          if (nextDistance < (rootDistances.get(dependent) ?? Number.POSITIVE_INFINITY)) {
            rootDistances.set(dependent, nextDistance);
            queue.push(dependent);
          }
        }
      }
      const prohibitedPatterns: Array<[RegExp, string]> = [
        [/\b(?:fast(?:ing)?|breath[- ]?hold|pain tolerance)\b/iu, "harm/restriction threshold"],
        [/\b(?:body[- ]?fat|body composition|weight target|target weight)\b/iu, "body-composition threshold"],
        [/\b(?:stunt|free[- ]?climb|extreme speed)\b/iu, "stunt or extreme-risk activity"],
        [/\b(?:manufacture|make|build|use|fire)\s+(?:a\s+)?(?:weapon|gun|explosive)\b/iu, "weapon manufacture/use"],
        [/\b(?:suture|intubate|inject|perform surgery)\b/iu, "invasive medical act"],
      ];
      for (const skill of context.skills) {
        const text = [skill.name, skill.short_description, skill.description, ...skill.tags, ...skill.examples]
          .join(" ")
          .toLowerCase();
        for (const [pattern, label] of prohibitedPatterns) {
          if (pattern.test(text)) issues.push(`${skill.id}: prohibited ${label}`);
        }
        if (
          /\b(?:exploit|penetration|break into|bypass authentication|steal credentials)\b/iu.test(text) &&
          !/\b(?:authorised|authorized|defensive|permission|owned system|own system)\b/iu.test(text)
        ) {
          issues.push(`${skill.id}: security capability lacks authorised/defensive framing`);
        }
        const trigger = skill.tags.includes("security")
          ? "security tag"
          : SAFETY_TERMS.find((term) => containsTerm(text, term));
        if (trigger && (!skill.safety_note || skill.safety_note.trim() === "")) {
          issues.push(`${skill.id}: safety trigger “${trigger}” requires safety_note`);
        } else if (trigger && skill.safety_note) {
          if (/\b(?:not responsible|at your own risk|seek professional advice)\b/iu.test(skill.safety_note)) {
            issues.push(`${skill.id}: safety_note is a disclaimer, not risk plus mitigation`);
          }
          if (
            !/\b(?:avoid|check|disconnect|ensure|follow|keep|maintain|protect|stop|supervise|use|ventilate|wear)\b/iu.test(
              skill.safety_note,
            )
          ) {
            issues.push(`${skill.id}: safety_note lacks a detectable mitigation action`);
          }
        }
        if (
          skill.status === "active" &&
          /\b(?:emergency|first aid|bleeding|cpr|drowning|water safety)\b/iu.test(text) &&
          (rootDistances.get(skill.id) ?? Number.POSITIVE_INFINITY) > 2
        ) {
          issues.push(`${skill.id}: safety-critical skill is more than 2 hard edges from a root`);
        }
      }
      return issues;
    },
  },
  {
    id: 18,
    name: "Cultural-neutrality lint",
    severity: "fail",
    run(context) {
      const issues: string[] = [];
      for (const skill of context.skills) {
        const text = `${skill.name} ${skill.self_assessment}`.toLowerCase();
        const brand = BRAND_TERMS.find((term) => containsTerm(text, term));
        const country = COUNTRY_TERMS.find((term) => containsTerm(text, term));
        const credential = CREDENTIAL_TERMS.find((term) => containsTerm(text, term));
        const religion = RELIGIOUS_TERMS.find((term) => containsTerm(text, term));
        if (brand) issues.push(`${skill.id}: brand/product name “${brand}”`);
        if (country) issues.push(`${skill.id}: country name “${country}”`);
        if (credential) issues.push(`${skill.id}: credential term “${credential}”`);
        if (religion) issues.push(`${skill.id}: religious-practice term “${religion}”`);
        if (/[$€£¥₹₽₩₺₫฿₴₦₱₲₵₡₸]/u.test(text)) issues.push(`${skill.id}: currency symbol`);
        if (/\b(?:usd|eur|gbp|jpy|cny|sar|aed|inr|cad|aud|chf)\b/iu.test(text)) {
          issues.push(`${skill.id}: currency code`);
        }
        if (/\b(?:grade|year)\s*(?:[1-9]|1[0-2])\b/iu.test(text)) {
          issues.push(`${skill.id}: school grade/year`);
        }
        if (containsTerm(text, "english")) issues.push(`${skill.id}: English-specific assumption`);
        const imperialOnly = /\b(?:miles?|feet|foot|inches?|pounds?|fahrenheit)\b/iu.test(text);
        const metric = /\b(?:millimetres?|centimetres?|metres?|kilometres?|grams?|kilograms?|celsius)\b/iu.test(text);
        if (imperialOnly && !metric) issues.push(`${skill.id}: imperial measure without metric equivalent`);
      }
      return issues;
    },
  },
  {
    id: 19,
    name: "Semantic duplicates",
    severity: "fail",
    run(context) {
      if (context.active.length < 2) return [];
      const issues: string[] = [];
      const normalisedOwners = new Map<string, string[]>();
      for (const skill of context.active) {
        const key = normaliseName(skill.name);
        const owners = normalisedOwners.get(key) ?? [];
        owners.push(skill.id);
        normalisedOwners.set(key, owners);
      }
      for (const [normalised, owners] of normalisedOwners) {
        if (normalised !== "" && owners.length > 1) {
          issues.push(`normalised name “${normalised}” is shared by ${owners.join(", ")}`);
        }
      }

      const structuralBuckets = new Map<string, Skill[]>();
      for (const skill of context.active) {
        if (skill.unlock_rules.length === 0) continue;
        const key = `${skill.domain}\t${canonicalUnlockRules(skill)}`;
        const bucket = structuralBuckets.get(key) ?? [];
        bucket.push(skill);
        structuralBuckets.set(key, bucket);
      }
      for (const bucket of structuralBuckets.values()) {
        for (let left = 0; left < bucket.length; left += 1) {
          for (let right = left + 1; right < bucket.length; right += 1) {
            const first = bucket[left];
            const second = bucket[right];
            if (first && second && Math.abs(first.difficulty - second.difficulty) <= 1) {
              issues.push(
                `${first.id} and ${second.id}: same domain and unlock_rules, difficulty within 1`,
              );
            }
          }
        }
      }

      const whitelistPath = join(
        context.root,
        "packages",
        "dataset",
        "validation",
        "micro-skill-whitelist.json",
      );
      let microSkillWhitelist = new Set<string>();
      if (existsSync(whitelistPath)) {
        try {
          const rawWhitelist: unknown = readJson(whitelistPath);
          if (!Array.isArray(rawWhitelist) || rawWhitelist.some((entry) => typeof entry !== "string")) {
            issues.push("micro-skill-whitelist.json must be an array of skill IDs");
          } else {
            microSkillWhitelist = new Set(rawWhitelist);
          }
        } catch (error) {
          issues.push(
            `micro-skill-whitelist.json is unreadable: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      for (const skill of context.active) {
        if (
          skill.time_to_learn === "minutes" &&
          (context.hardPrerequisites.get(skill.id)?.size ?? 0) === 1 &&
          (context.hardDependents.get(skill.id)?.size ?? 0) === 1 &&
          !microSkillWhitelist.has(skill.id)
        ) {
          issues.push(`${skill.id}: one-prerequisite/one-dependent minutes-scale micro-skill`);
        }
      }

      const path = join(context.root, "packages", "dataset", "generated", "embeddings.bin");
      if (!existsSync(path)) {
        return [...issues, "embeddings.bin is required when at least two active skills exist"];
      }
      let artifact: EmbeddingArtifact;
      try {
        artifact = readJson(path) as EmbeddingArtifact;
      } catch (error) {
        return [...issues, `embeddings.bin is unreadable: ${error instanceof Error ? error.message : String(error)}`];
      }
      const expectedHash = embeddingSourceHash(context.active);
      if (artifact.source_hash !== expectedHash) {
        issues.push(`embeddings.bin is stale: source_hash must be ${expectedHash}`);
      }
      if (!Number.isInteger(artifact.dimensions) || artifact.dimensions <= 0) {
        return [...issues, "embeddings.bin dimensions must be a positive integer"];
      }
      const vectors = new Map<string, Float64Array>();
      for (const skill of context.active) {
        const raw = artifact.vectors?.[skill.id];
        if (!Array.isArray(raw) || raw.length !== artifact.dimensions || raw.some((value) => !Number.isFinite(value))) {
          issues.push(`${skill.id}: missing or malformed ${artifact.dimensions}-dimension embedding`);
          continue;
        }
        vectors.set(skill.id, Float64Array.from(raw));
      }
      const entries = [...vectors.entries()].sort(([left], [right]) => left.localeCompare(right));
      for (let left = 0; left < entries.length; left += 1) {
        const leftEntry = entries[left];
        if (!leftEntry) continue;
        for (let right = left + 1; right < entries.length; right += 1) {
          const rightEntry = entries[right];
          if (!rightEntry) continue;
          const similarity = cosine(leftEntry[1], rightEntry[1]);
          if (!Number.isFinite(similarity)) {
            issues.push(`${leftEntry[0]} or ${rightEntry[0]} has a zero-norm embedding`);
          } else if (similarity >= 0.92) {
            issues.push(
              `${leftEntry[0]} and ${rightEntry[0]} have cosine similarity ${similarity.toFixed(4)}`,
            );
          }
        }
      }
      return issues;
    },
  },
  {
    id: 20,
    name: "Distribution drift",
    severity: "warn",
    run(context) {
      if (context.active.length === 0) return [];
      const issues: string[] = [];
      const domainCounts = new Map<DomainId, number>(DOMAIN_IDS.map((id) => [id, 0]));
      const levelCounts = new Array<number>(8).fill(0);
      for (const skill of context.active) {
        domainCounts.set(skill.domain, (domainCounts.get(skill.domain) ?? 0) + 1);
        levelCounts[skill.difficulty] = (levelCounts[skill.difficulty] ?? 0) + 1;
      }
      for (const domain of DOMAIN_IDS) {
        const actual = domainCounts.get(domain) ?? 0;
        const target = DOMAIN_BUDGETS[domain];
        if (Math.abs(actual - target) > target * 0.05) {
          issues.push(`${domain}: ${actual} active skills, target ${target} (±5%)`);
        }
      }
      LEVEL_BUDGETS.forEach((target, level) => {
        const actual = levelCounts[level] ?? 0;
        if (Math.abs(actual - target) > target * 0.1) {
          issues.push(`L${level}: ${actual} active skills, target ${target} (±10%)`);
        }
      });
      let hardEdges = 0;
      let crossDomainHardEdges = 0;
      for (const skill of context.active) {
        for (const prerequisiteId of context.hardPrerequisites.get(skill.id) ?? []) {
          const prerequisite = context.activeById.get(prerequisiteId);
          if (!prerequisite) continue;
          hardEdges += 1;
          if (prerequisite.domain !== skill.domain) crossDomainHardEdges += 1;
        }
      }
      if (hardEdges > 0) {
        const ratio = crossDomainHardEdges / hardEdges;
        if (ratio < 0.15 || ratio > 0.25) {
          issues.push(`cross-domain hard-edge ratio ${(ratio * 100).toFixed(1)}%, target 15–25%`);
        }
      }
      const edgesPerNode = hardEdges / context.active.length;
      if (edgesPerNode < 2.5 || edgesPerNode > 3.5) {
        issues.push(`hard edges per active node ${edgesPerNode.toFixed(2)}, target 2.5–3.5`);
      }
      return issues;
    },
  },
  {
    id: 21,
    name: "Deterministic layout",
    severity: "fail",
    run(context) {
      const generator = join(context.root, "scripts", "compute-layout.py");
      const checkedInLayout = join(context.root, "packages", "dataset", "generated", "layout.json");
      if (!existsSync(generator) && !existsSync(checkedInLayout)) return [];
      if (!existsSync(generator)) return ["layout.json exists but scripts/compute-layout.py is missing"];
      if (!existsSync(checkedInLayout)) return ["compute-layout.py exists but generated/layout.json is missing"];

      const temporaryDirectory = mkdtempSync(join(tmpdir(), "skillgraph-layout-"));
      const first = join(temporaryDirectory, "first.json");
      const second = join(temporaryDirectory, "second.json");
      try {
        for (const output of [first, second]) {
          const run = spawnSync(
            process.env["PYTHON"] ?? "python",
            [generator, "--output", output, "--seed", "73421"],
            { cwd: context.root, encoding: "utf8" },
          );
          if (run.status !== 0) {
            return [
              `compute-layout.py exited ${run.status ?? "without status"}: ${(run.stderr || run.stdout).trim()}`,
            ];
          }
        }
        const firstBytes = readFileSync(first);
        const secondBytes = readFileSync(second);
        return firstBytes.equals(secondBytes) ? [] : ["same-seed layout outputs differ byte-for-byte"];
      } finally {
        const resolvedTemporary = resolve(temporaryDirectory);
        if (resolvedTemporary.startsWith(`${resolve(tmpdir())}\\`) || resolvedTemporary.startsWith(`${resolve(tmpdir())}/`)) {
          rmSync(resolvedTemporary, { recursive: true, force: true });
        }
      }
    },
  },
];

export function validateRepository(root = REPOSITORY_ROOT): ValidatorResult[] {
  const context = loadContext(root);
  return VALIDATORS.map((validator) => ({
    id: validator.id,
    name: validator.name,
    severity: validator.severity,
    issues: validator.run(context).map((message) => ({
      validator: validator.id,
      severity: validator.severity,
      message,
    })),
  }));
}

export function validatorDefinitions(): ReadonlyArray<Pick<ValidatorDefinition, "id" | "name" | "severity">> {
  return VALIDATORS.map(({ id, name, severity }) => ({ id, name, severity }));
}

function runCli(): void {
  const results = validateRepository();
  for (const result of results) {
    if (result.issues.length === 0) {
      console.log(`PASS ${String(result.id).padStart(2, "0")} [${result.severity}] ${result.name}`);
      continue;
    }
    const label = result.severity === "fail" ? "FAIL" : "WARN";
    console.log(`${label} ${String(result.id).padStart(2, "0")} [${result.severity}] ${result.name}`);
    for (const issue of result.issues) console.log(`  - ${issue.message}`);
  }
  const failCount = results.reduce(
    (count, result) => count + (result.severity === "fail" ? result.issues.length : 0),
    0,
  );
  const warningCount = results.reduce(
    (count, result) => count + (result.severity === "warn" ? result.issues.length : 0),
    0,
  );
  console.log(`\nValidation complete: ${failCount} fail issue(s), ${warningCount} warning(s).`);
  if (failCount > 0) process.exitCode = 1;
}

const entryPoint = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPoint === fileURLToPath(import.meta.url)) runCli();

# ARTIFACT B — Skill Dataset Specification v1.0

> Normative. Any generator producing skills for this dataset must comply with every MUST. Violations are CI failures.

## 1. Scope

A skill is a **retained human capability with a defined threshold**, claimable by the holder without a tester.

### MUST be a skill
- Expressed as something a person **can do**
- Verifiable in the first person, no equipment or expert required
- Binary at an explicit threshold
- Atomic: no sub-part is independently claimable in a meaningful order
- Distinguishable: a reasonable person could hold a neighbour and not this one

### MUST NOT be a node
| Excluded | Example | Instead |
|---|---|---|
| Task | "Dice this onion" | Put in `examples` |
| Habit | "Cook nightly" | Excluded entirely |
| Knowledge | "Know what a variable is" | "Declare a variable and use it in an expression" |
| Achievement | "Run a marathon" | "Run 42 km continuously" |
| Trait | "Be patient" | Excluded entirely |
| Milestone | "Finish cooking basics" | Derived at runtime |

**Banned node verbs:** `know`, `understand`, `be familiar with`, `be aware of`, `appreciate`, `master`, `be good at`.

### Granularity
- Zero-to-threshold for a prepared adult MUST be **20 minutes – 6 months** (L0–L1 physical/perceptual primitives are exempt)
- MUST NOT be a domain ("Programming", "Cooking")
- MUST NOT be a keystroke-level step ("Press the A key")
- MUST NOT be the knowledge half of another node

## 2. Domains

Exactly one primary `domain` per skill, from this closed set:

`body` · `care` · `food` · `home` · `lang` · `social` · `reason` · `learn` · `digital` · `eng` · `art` · `world`

0–2 `secondary_domains`, from the same set, excluding the primary.

**Budget (total MUST equal 1000):**
`body` 110 · `eng` 110 · `lang` 90 · `social` 90 · `art` 90 · `food` 80 · `reason` 80 · `digital` 80 · `world` 80 · `care` 70 · `home` 70 · `learn` 50

## 3. Difficulty

| L | Time-to-threshold **given prerequisites** | Target count |
|---|---|---|
| 0 | seconds–minutes | 60 |
| 1 | minutes–hours | 120 |
| 2 | hours–days | 200 |
| 3 | days–weeks | 230 |
| 4 | weeks–months | 200 |
| 5 | months | 130 |
| 6 | years | 50 |
| 7 | many years, rare | 10 |

Distribution tolerance: ±10% per level, ±5% per domain. Difficulty MUST be independent of graph depth.

## 4. Identity

**Format:** `<domain>.<cluster>.<slug-fragment>` — lowercase, `[a-z0-9-]`, dots as separators, exactly three segments.
Examples: `body.balance.stand-10s`, `eng.debug.read-a-stack-trace`

- `id` is **frozen forever**. Renaming is a CI failure. Deprecate + `superseded_by` instead.
- `slug` is URL-safe, unique, renameable.
- `cluster` MUST come from the domain's declared cluster list in `domains.json`.

## 5. Edges — the most important section

Two edge types. Getting this wrong is the primary failure mode.

### `unlock_rules` — HARD, gating

Use **only** when the skill is **impossible** without the prerequisite. Test: *could a person with zero ability at A still perform B?* If yes → it is not a hard edge.

```jsonc
"unlock_rules": [
  { "label": "gradual route", "all": ["id.a", "id.b"] },
  { "label": "direct route",  "all": ["id.c"] },
  { "label": "choose one instrument", "all": ["id.d"], "any_of": { "n": 1, "of": ["id.e","id.f","id.g"] } }
]
```
Semantics: a group is satisfied when **all** of `all` are completed **and** at least `n` of `any_of.of` are completed. A skill is `AVAILABLE` when **any** group is satisfied. `[]` = root.

**Constraints (all CI-enforced):**
- Max **4** groups per skill
- Max **5** entries in `all`; max **6** in `any_of.of`; `1 ≤ n < |of|`
- Jaccard overlap between any two groups of the same skill MUST be < 0.6
- No self-reference, no cycles across the whole hard-edge graph
- Every referenced ID MUST exist and be `active`
- Transitively redundant edges MUST be removed (if A→B→C, do not also declare A→C)
- Every group MUST have a `label` in plain language

### `builds_on` — SOFT, non-gating

```jsonc
"builds_on": [ { "id": "lang.read.paragraph", "strength": 0.6, "note": "Recipes are written." } ]
```
Use for everything that *helps*. If a justification contains "helps with", "is useful for", "makes it easier", or "is related to", it MUST be `builds_on`, never `unlock_rules`. `strength` ∈ [0,1]. Max 5 per skill. Soft edges may form cycles.

### Roots
80–120 skills MUST have `unlock_rules: []`, at least 4 per domain. There MUST NOT be a universal root node.
**Rule:** if >95% of adults worldwide already hold every candidate prerequisite, make the node a root and record the relationship as `builds_on`.

### Alternative routes
Add a second group only if you can **name a type of person** who reached the skill that way. Persona categories: formal-vs-practical · domain-migration · tooling-substitution · scaffolded-vs-direct. Unnameable persona → single group.

### Cross-domain
- 15–25% of hard edges MUST cross a domain boundary
- ~60% of `builds_on` SHOULD cross
- Legitimate hard cross-domain hubs: `lang→*` (literacy), `digital→eng/world/art`, `reason→eng/world/learn`, `body→art`, `social→world/learn`
- **Forbidden:** trait-based ("requires patience"), universal ("requires communication"), thematic-resemblance edges
- Union graph MUST be a single weakly-connected component; each domain MUST have ≥8 hard edges to ≥3 other domains

## 6. Field schema

| Field | Type | Rule |
|---|---|---|
| `id` | string | §4, frozen |
| `slug` | string | unique, `[a-z0-9-]` |
| `name` | string | ≤ 60 chars, imperative verb phrase, no brands |
| `short_description` | string | ≤ 140 chars |
| `description` | string | 40–120 words, markdown |
| `domain` | enum | §2 |
| `secondary_domains` | string[] | 0–2 |
| `tags` | string[] | 1–5 |
| `difficulty` | int | 0–7 |
| `time_to_learn` | enum | `minutes\|hours\|days\|weeks\|months\|years` |
| `self_assessment` | string | §7 |
| `unlock_rules` | Group[] | §5 |
| `builds_on` | object[] | §5, 0–5 |
| `examples` | string[] | 0–3 concrete tasks |
| `safety_note` | string\|null | §8 |
| `status` | enum | `active\|deprecated` |
| `superseded_by` | string\|null | required when deprecated |

**MUST NOT be emitted by any generator** (derived at build time): `x`, `y`, `next_skills`, `related_skills`, `depth`, `cluster`, `is_root`, any state or progress field.

## 7. Self-assessment contract

MUST: exactly one sentence · start with `I can` · present tense, active · contain a **threshold** (quantity, duration, condition, or "without help") · contain an **independence qualifier** · ≤ 30 words.

MUST NOT contain: `good`, `comfortable`, `understand`, `know`, `familiar`, `confident`, `well`, `properly`, `effectively`, `generally`, `usually`, `basic`.

✅ "I can run five kilometres continuously without stopping to walk."
❌ "I am comfortable with running." — no threshold, banned word, no independence qualifier.

**Generation order: write the self-assessment before the description.** If a sharp threshold sentence can't be written, the node is too vague — reject it rather than fixing the sentence.

## 8. Safety

**Never generate:**
- Thresholds based on enduring harm, restriction, or risk (fasting, breath-hold, pain tolerance, weight/body-composition targets)
- Stunts, free-climbing, vehicle stunts, extreme speed
- Weapons manufacture or use outside regulated sport
- Invasive medical acts — first aid stops at layperson scope
- Anything illegal in most jurisdictions; security skills only in authorised/defensive framing

**Structural:**
- Safety-critical skills (emergency response, first aid, water safety) MUST sit ≤ 2 hard edges from a root
- Progression MUST NOT imply escalation ("5 km → 50 km")
- `safety_note` REQUIRED when the skill involves: heat/fire, sharp tools, power tools, electricity, water, heights, chemicals, medical, driving, or the `security` tag
- Safety notes state risk + mitigation. Not disclaimers.

## 9. Cultural neutrality

MUST NOT contain, in `name` or `self_assessment`: brand or product names · school grades, degrees or credentials · currencies · country names or national institutions · religious practice · assumed diet, family structure or housing type · English-specific language assumptions.

Brands MAY appear in `examples` only. Use metric with imperial in parentheses. `lang` skills refer to *a* language, never English. Do not assume vision, hearing, or full mobility in L0–L2.

## 10. Duplicate prevention

Before emitting any skill, the generator MUST check the supplied index. A skill is a duplicate if:
- Normalised name matches an existing name (lowercase, stopwords stripped, verbs lemmatised)
- Semantic similarity of `name + self_assessment` ≥ 0.92 against any existing skill
- Same domain, identical `unlock_rules`, difficulty within 1
- It is a micro-skill: `time_to_learn: minutes` with exactly one prerequisite and one dependent (outside the L0 floor whitelist)

Emitting a duplicate fails the batch.

## 11. Output format

**JSONL**, UTF-8, LF, one skill object per line, no trailing commas, no comments.
File: `packages/dataset/skills/<domain>.jsonl`, sorted by `id`.

## 12. Versioning

SemVer. **PATCH** = text/layout only · **MINOR** = new skills, new `builds_on`, new *alternative* groups (additive, cannot invalidate a claim) · **MAJOR** = removal, deprecation, tightening a group, changing `domain`, split or merge.

Splits and merges MUST add an entry to `migrations.json`:
```json
{ "from": "old.id", "to": ["new.id.a", "new.id.b"], "policy": "ask" }
```
Policies: `claim_all` · `claim_primary` · `ask`. User claims are **never** recomputed or deleted by a version change.

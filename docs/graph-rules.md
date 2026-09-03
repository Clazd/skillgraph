# Graph rules and validation contract

This document transcribes the normative edge rules in
[`ARTIFACT-B-dataset-spec.md`](./ARTIFACT-B-dataset-spec.md) §5 and the
21-validator table referenced by
[`ARTIFACT-C-generation-prompt.md`](./ARTIFACT-C-generation-prompt.md). When
the older validator-table shorthand conflicts with Artifact B, Artifact B is
binding.

## Hard edges: `unlock_rules`

Use a hard edge only when the target skill is impossible without the
prerequisite. Ask: *could a person with zero ability at A still perform B?* If
yes, A is not a hard prerequisite of B.

```jsonc
"unlock_rules": [
  { "label": "gradual route", "all": ["id.a", "id.b"] },
  { "label": "direct route", "all": ["id.c"] },
  {
    "label": "choose one instrument",
    "all": ["id.d"],
    "any_of": { "n": 1, "of": ["id.e", "id.f", "id.g"] }
  }
]
```

A group is satisfied when every ID in `all` is completed and at least `n`
IDs in `any_of.of` are completed. A skill is available when any group is
satisfied. An empty `unlock_rules` array marks a root.

Hard-edge constraints:

- A skill has at most 4 groups.
- `all` has at most 5 entries. `any_of.of` has at most 6 entries, with
  `1 <= n < any_of.of.length`.
- The Jaccard overlap of the prerequisite-ID sets of any two groups on the
  same skill is less than 0.6.
- There are no self-references and the full hard-edge graph is acyclic.
- Every referenced ID exists and has `status: "active"`.
- Transitively redundant edges are removed: if A leads to B and B leads to C,
  do not also declare A as a direct prerequisite of C.
- Every group has a plain-language `label`.

## Soft edges: `builds_on`

Use `builds_on` for capabilities that help but do not gate the target. If a
justification says “helps with,” “is useful for,” “makes it easier,” or “is
related to,” it belongs here, not in `unlock_rules`.

```jsonc
"builds_on": [
  {
    "id": "lang.read.paragraph",
    "strength": 0.6,
    "note": "Recipes are written."
  }
]
```

`strength` is in the closed interval `[0, 1]`. A skill has at most 5 soft
edges. Soft edges may form cycles.

## Roots

- The finished dataset has 80–120 roots and at least 4 roots per domain.
- There is no universal root node.
- If more than 95% of adults worldwide already hold every candidate
  prerequisite, make the skill a root and record helpful relationships in
  `builds_on`.

## Alternative routes

Add a second group only when a real type of person can be named who reached
the skill by that route. Accepted persona categories are formal-vs-practical,
domain-migration, tooling-substitution, and scaffolded-vs-direct. If no such
persona can be named, keep a single group.

## Cross-domain edges

- 15–25% of hard edges cross a domain boundary.
- Approximately 60% of `builds_on` edges should cross a domain boundary.
- Legitimate hard cross-domain hubs are `lang -> *` for literacy,
  `digital -> eng/world/art`, `reason -> eng/world/learn`, `body -> art`, and
  `social -> world/learn`.
- Trait-based prerequisites, universal prerequisites, and
  thematic-resemblance edges are forbidden.
- The union of hard and soft edges is one weakly connected component.
- Every domain has at least 8 hard edges connecting it to at least 3 other
  domains.

## Domain and cluster boundaries

- `digital.digital-safety` covers personal safety such as passwords,
  phishing, and privacy. `eng.security` covers defensive security and
  authorised testing only. The two clusters must not overlap.
- `body.floor` contains the L0–L1 primitives: grip, reach, visual tracking,
  sitting, standing, and posture. Most of the dataset's 60 L0 skills belong
  here; the remainder belong in `lang.reading` and `social.conversation`.
- Emotional support belongs to `social`, not `care`. `care` is limited to
  physical health, safety, and self-care.
- Translation is an L5+ skill in `lang.second-language`, not a separate
  cluster.

## Validator table

Validators run in this order and never downgrade the severity shown here.

| # | Validator | Severity |
|---:|---|---|
| 1 | JSON Schema conformance, every line | fail |
| 2 | Duplicate IDs | fail |
| 3 | ID format and immutability versus `main` | fail |
| 4 | Dangling prerequisite references | fail |
| 5 | Self-reference | fail |
| 6 | Cycles in hard edges (Kahn's algorithm; report the actual cycle path) | fail |
| 7 | Group size over 5, or group count over 4 | fail |
| 8 | Group-overlap Jaccard at least 0.6 between two groups of one skill | fail |
| 9 | Non-root node unreachable from every root | fail |
| 10 | More than one connected component in the union graph | fail |
| 11 | Component smaller than 5 nodes | warn |
| 12 | `difficulty(prerequisite) >= difficulty(skill)` | warn |
| 13 | Longest root-to-node hard chain over 12 | warn (suspicious ladder) |
| 14 | Node in-degree over 8 or out-degree over 25 | warn (likely too broad) |
| 15 | Breadth heuristics: domain word in name, at least 3 terms joined by `and`/`or`, or `time_to_learn: years` at L0–L4 | warn |
| 16 | Self-assessment contract lint | fail |
| 17 | Safety keyword without `safety_note` | fail |
| 18 | Neutrality lint: brands, currencies, country names, credential names | fail |
| 19 | Semantic duplicate similarity at least 0.92 | fail |
| 20 | Distribution drift: per-domain, per-level, cross-domain hard-edge ratio, and edges per node | warn plus PR comment |
| 21 | Layout regenerates deterministically with the same seed | fail |

### Binding clarifications used by the validator

- Validator 7 applies Artifact B's precise limits: `all` may contain 5 IDs and
  `any_of.of` may contain 6. It does not impose an additional combined limit
  of 5 on the union of those arrays.
- Aggregate completion gates that only make sense for the finished dataset
  (root counts and per-domain cross-edge minima) become hard failures at
  exactly 1,000 active skills. Validator 20 reports distribution drift while
  the dataset is still being assembled. An empty dataset produces no drift.
- Artifact B's structural duplicate rule would classify every pair of roots
  in the same domain and adjacent difficulty levels as duplicates because all
  roots have identical `unlock_rules: []`. To preserve the simultaneous rule
  requiring at least 4 roots per domain, structural duplicate comparison
  excludes roots; exact-name and embedding duplicate checks still cover them.
- Validator 19 reads the deterministic embedding artifact described below.
  If two or more skills exist and the artifact is absent or stale, that is a
  failure rather than an unimplemented check.
- Validator 21 invokes the layout generator twice in isolated temporary
  output locations and compares the exact bytes. If skills exist but the
  generator is absent, that is a failure.

## Embedding artifact contract used by validator 19

`packages/dataset/generated/embeddings.bin` is UTF-8 JSON despite its `.bin`
suffix, so the representation remains portable and reviewable during dataset
construction. It contains:

```json
{
  "source_hash": "sha256-of-sorted-id-name-self_assessment-lines",
  "dimensions": 384,
  "vectors": { "skill.id.slug": [0.1, 0.2] }
}
```

Every active skill has one finite vector of exactly `dimensions` numbers.
The validator rejects a missing/stale artifact, malformed vectors, or any
pair whose cosine similarity is at least 0.92.

## Layout determinism command contract used by validator 21

Pass 15's `scripts/compute-layout.py` must accept
`--output <path> --seed <integer>`. The validator runs it twice with seed
`73421` and requires byte-identical output. This contract makes determinism
machine-checkable without overwriting the checked-in layout.

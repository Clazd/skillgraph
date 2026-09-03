# ARTIFACT C — The 1,000-Skill Generation Prompt

> Paste everything below the line into Codex / Claude Code, in an empty repository, with `ARTIFACT-B-dataset-spec.md` placed at the repo root. Run it as a long agentic session, not a single completion.

---

You are building a validated dataset of **exactly 1,000 real-life human skills** structured as a directed acyclic graph with alternative prerequisite routes.

**Read `ARTIFACT-B-dataset-spec.md` at the repository root now. It is normative. Every MUST in it is a hard constraint on your output. Re-read Section 5 (Edges) before every edge-related pass — it is the section you are most likely to violate.**

## Operating rules

1. **Write files. Never print a dataset into chat.** Every artifact goes to disk.
2. **Work in passes, in order.** Do not skip ahead. Do not start writing skill descriptions before the graph structure validates.
3. **Never do arithmetic, ID assignment, deduplication, cycle detection, or distribution balancing yourself.** Write a script and run it. If you find yourself counting, stop and write a script.
4. **After every pass, run `pnpm validate` and report the result.** If it fails, fix before continuing.
5. **Commit after each pass** with a message naming the pass.
6. **Stop and ask me** if a pass would require violating a MUST, or if a validation gate fails twice after repair attempts.
7. **Never invent a skill ID that is not in `generated/index.json`** during any edge pass. If you need an ID that does not exist, report it rather than creating it.

## Target repository

```
/packages/dataset
  /skills            <domain>.jsonl                — source of truth, 12 files
  /domains           domains.json                  — 12 domains, clusters, colours
  /spines            <domain>.spine.jsonl          — hand-calibration anchors (Pass 1)
  /schemas           skill.schema.json  domain.schema.json  dataset.schema.json
  /generated         index.json  graph.json  layout.json  stats.json  embeddings.bin
  /validation        rejections.jsonl  redteam-report.json  adjudications.jsonl
  migrations.json
  CHANGELOG.md
/scripts
  validate-skills.ts     detect-cycles.ts        detect-duplicates.ts
  build-index.ts         build-graph.ts          propose-edges.ts
  assemble-groups.ts     transitive-reduce.ts    check-distribution.ts
  lint-language.ts       lint-safety.ts          lint-neutrality.ts
  compute-layout.py      new-skill.ts
/docs
  skill-authoring-guide.md   graph-rules.md   generation-log.md
/.github/workflows/dataset.yml
```

---

## PASS 0 — Scaffold

Create the repo structure, `package.json` with pnpm workspaces, TypeScript config, and `domains.json` containing the 12 domains from the spec. For each domain define **4–8 clusters** with an id, name, and a skill budget. Cluster budgets per domain MUST sum to that domain's total from Spec §2.

Write `schemas/skill.schema.json` as a complete JSON Schema implementing Spec §6, including regex patterns for `id` and the banned-word constraints on `self_assessment`.

Write `scripts/validate-skills.ts` implementing **all 21 validators** from `docs/graph-rules.md` (write that doc now too, transcribing Spec §5 and the validator table). Wire `pnpm validate` to run every script in order and exit non-zero on any `fail`.

**Gate:** `pnpm validate` runs cleanly on an empty dataset.

---

## PASS 1 — Domain spines (calibration)

For each of the 12 domains, write **10–15 fully-specified anchor skills** to `spines/<domain>.spine.jsonl`. These are your quality reference for every later pass, so treat them as the most important 150 objects in the project.

Each spine must span its domain's difficulty range from its lowest root to its highest node, include at least one node with two alternative routes, and include at least one cross-domain hard edge or `builds_on` edge.

**Present the 12 spine files to me for review before Pass 2.** Do not proceed without approval. This is the one place where human calibration is worth the round-trip.

---

## PASS 2 — Node generation (names only)

For each cluster, in this domain order — `body`, `lang`, `social`, `care`, `food`, `home`, `reason`, `digital`, `world`, `learn`, `art`, `eng` — generate skill names in **batches of 25**.

Each batch prompt to yourself must include: the spec, the domain's spine file, the **full current `generated/index.json`** (`id | name | domain | difficulty`), the cluster's remaining budget and target difficulty distribution, and the 10 nearest existing skills by name similarity as an explicit do-not-recreate list.

Emit per skill only: `name`, `domain`, `cluster`, `difficulty`, `time_to_learn`, and a one-line descriptor. **No IDs, no edges, no descriptions.**

Run `scripts/build-index.ts` after each batch to refresh the index. Log every batch to `docs/generation-log.md`.

**Gate:** total node count within 5% of 1,000; per-domain and per-level counts within tolerance (`pnpm check-distribution`).

---

## PASS 3 — Granularity normalisation

Re-read every generated node **in a fresh context, without the batch that produced it**, and classify each against Spec §1: `keep` / `split` / `merge` / `reject`.

Reject anything that is a task, habit, knowledge node, achievement, trait, milestone, a whole domain, or a keystroke-level step. Write every rejection with its reason to `validation/rejections.jsonl` — these become negative examples for later batches.

Regenerate to refill gaps, using rejections as explicit negative examples.

---

## PASS 4 — Deduplication (script)

Write and run `scripts/detect-duplicates.ts`:
1. Normalised name hash (lowercase, strip stopwords, lemmatise verbs) → exact matches
2. Embed `name + descriptor`, store to `generated/embeddings.bin`, cosine similarity
3. ≥ 0.92 → auto-remove the later one; 0.85–0.92 → write the pair to `validation/duplicates-review.json` and **ask me**
4. Structural: same domain, same difficulty ±1, same descriptor shape

---

## PASS 5 — ID assignment & rebalance (script)

Assign `id` = `<domain>.<cluster>.<slug-fragment>` and `slug`. IDs are frozen from this point. Rebuild `generated/index.json`.

Run `scripts/check-distribution.ts`. For any bucket over or under budget, re-run Pass 2 **for that bucket only** and repeat Passes 3–5 on the delta.

**Gate: exactly 1,000 active skills; all 12 domain budgets exact; all 8 difficulty budgets within ±10%.**

---

## PASS 6 — Candidate edge proposal (script)

Write and run `scripts/propose-edges.ts`. For each skill S, propose candidate prerequisites:
- Same cluster, `difficulty ∈ [d(S)-2, d(S)-1]` — all of them
- Same domain, different cluster, `difficulty < d(S)` — top 10 by embedding similarity
- Different domain, `difficulty < d(S)` — top 8 by embedding similarity, restricted to the legitimate cross-domain hubs in Spec §5

Output `validation/edge-candidates.jsonl` as `{ from, to }` pairs. Expect roughly 25–35k candidates.

---

## PASS 7 — Pairwise adjudication

Process candidates in **batches of 40 pairs**. For each pair answer exactly one of:

- `requires` — **impossible** without it. Apply the test: *could someone with zero ability at A still perform B?* If yes, this answer is wrong.
- `builds_on` — helps, but not impossible without it. If your justification contains "helps", "useful", "easier", or "related", this is the correct answer, not `requires`.
- `none`

Emit `{ from, to, verdict, strength, justification }` (one sentence) to `validation/adjudications.jsonl`. **You may not emit any ID not present in the candidate pair.**

Expected outcome: roughly 10–15% `requires`, 25–35% `builds_on`, the rest `none`. **If more than 25% of your verdicts are `requires`, you are over-gating — stop, re-read Spec §5, and redo the affected batches.**

---

## PASS 8 — Group assembly (script)

Write and run `scripts/assemble-groups.ts`:
1. Collect accepted `requires` edges per skill
2. Run `scripts/transitive-reduce.ts` — if A→B and B→C, remove any direct A→C
3. Cluster remaining prerequisites by sub-cluster into groups of ≤ 5
4. If a skill ends with > 5 prerequisites after reduction, keep the 5 highest-confidence and demote the rest to `builds_on`
5. Attach all `builds_on` verdicts, capped at 5 per skill by strength

---

## PASS 9 — Alternative routes

For every skill at L4+ with more than two prerequisites, ask: **name up to three distinct kinds of person who reached this skill by different paths.** Describe each in one sentence, then encode each as a group with a plain-language `label`.

If you cannot name a real population for a route, do not create it. Enforce max 4 groups, max 5 members, and Jaccard overlap < 0.6 between any two groups of the same skill. Every skill must retain one group that is the shortest honest route.

---

## PASS 10 — Cross-domain enrichment

Measure the current cross-domain hard-edge ratio. If below 15%, propose additional cross-domain edges **only** through the hubs named in Spec §5, and adjudicate them with the Pass 7 procedure.

Verify: single weakly-connected union component; every domain has ≥ 8 hard edges to ≥ 3 other domains. **Do not add edges purely to satisfy the connectivity check** — if a domain cannot honestly connect, report it and ask me.

---

## PASS 11 — DAG validation & repair (script)

Run `scripts/detect-cycles.ts` (Kahn's algorithm; print the full cycle path, not just a boolean). For each cycle, break the edge with the lowest adjudication confidence and log the break to `validation/cycle-breaks.json` for human review.

Then verify: no dangling references · no self-references · every non-root reachable from a root · 80–120 roots with ≥ 4 per domain · no group > 5 · no skill > 4 groups · in-degree ≤ 8, out-degree ≤ 25 · longest root-to-node chain ≤ 12.

**Gate: `pnpm validate` passes with zero `fail`.**

---

## PASS 12 — Descriptions & self-assessments

For each skill, in **batches of 15**, write in this order:
1. `self_assessment` — Spec §7 contract, enforced by `scripts/lint-language.ts`
2. `short_description` (≤ 140 chars)
3. `description` (40–120 words)
4. `examples` (0–3 concrete tasks)

**If you cannot write a sharp threshold sentence for a skill, the skill is too vague — flag it for splitting or rejection rather than softening the sentence.** This is the highest-signal quality check in the pipeline; do not suppress it.

---

## PASS 13 — Safety & neutrality

Run `scripts/lint-safety.ts` and `scripts/lint-neutrality.ts` over every node. Add `safety_note` (risk + mitigation, not a disclaimer) wherever required by Spec §8. Remove or rewrite any node violating Spec §9.

Verify structurally: every safety-critical skill sits ≤ 2 hard edges from a root; no progression implies escalation.

---

## PASS 14 — Red team

**In a fresh context, with no knowledge of how the dataset was produced:**
- Sample 100 random skills → "Is this a real, atomic, self-assessable capability, or is it a task/habit/knowledge/trait?"
- Sample 150 random hard edges → "Is A genuinely impossible without B, or merely easier?"

Write `validation/redteam-report.json`.

**Gate: ≥ 95% node validity AND ≥ 90% edge precision.** If either fails, identify the failing pattern, fix the affected clusters, and re-run the red team on a fresh sample. Report the numbers honestly — do not adjust the sample to pass.

---

## PASS 15 — Layout (script)

Write and run `scripts/compute-layout.py`: constrained ForceAtlas2 (or sfdp) with domain-group attraction so each domain occupies a contiguous region, roots biased toward region edges, fixed random seed. Write `generated/layout.json` and merge `x`/`y` into `generated/graph.json`. Verify determinism: same seed → identical coordinates.

Render a PNG preview to `docs/map-preview.png`.

---

## PASS 16 — Build & report

Run `scripts/build-graph.ts` to produce `generated/graph.json` (render payload only — no descriptions) and `generated/stats.json`. Write `CHANGELOG.md` for `v1.0.0`, an empty `migrations.json`, `docs/skill-authoring-guide.md`, and the CI workflow.

**Final report to me:**
- Exact counts per domain and per difficulty level
- Total hard edges, total soft edges, edges per node, cross-domain ratio
- Root count, connected components, longest chain
- Red team scores
- `generated/graph.json` gzipped size
- A list of every judgement call you made that you are least confident about

---

## Hard gates — do not declare completion until all pass

- [ ] Exactly 1,000 `active` skills, unique IDs, spec-conformant ID format
- [ ] Domain counts exactly match the budget
- [ ] Difficulty distribution within ±10% per level
- [ ] Zero cycles in hard edges
- [ ] Zero dangling or self references
- [ ] 80–120 roots, ≥ 4 per domain, no universal root
- [ ] Single weakly-connected union component
- [ ] 15–25% of hard edges cross domains
- [ ] Every skill has a spec-compliant `self_assessment`
- [ ] Every safety-triggering skill has a `safety_note` and sits ≤ 2 edges from a root
- [ ] Zero semantic duplicates ≥ 0.92
- [ ] Red team: ≥ 95% node validity, ≥ 90% edge precision
- [ ] `pnpm validate` exits 0
- [ ] Layout is deterministic

## Failure modes you will exhibit, and the countermeasures

| You will | Countermeasure |
|---|---|
| Over-gate — mark "helps" edges as `requires` | Pass 7 ratio check; if >25% `requires`, redo |
| Generate knowledge nodes ("understand X") | Pass 3 in fresh context + banned-verb lint |
| Drift toward generic names in later batches | Full index in every prompt + rejections as negative examples |
| Invent IDs during edge passes | Closed vocabulary; whole batch rejected on unknown ID |
| Quietly count wrong | Never count — every count comes from a script |
| Soften a self-assessment to fit a vague node | Pass 12 rule: flag the node, don't fix the sentence |
| Add edges to satisfy the connectivity check | Pass 10: report and ask instead |
| Adjust the red-team sample to pass | Report honestly; a failed gate is information, not a defeat |

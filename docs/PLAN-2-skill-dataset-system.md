# PLAN 2 — The 1,000-Skill Content System

## 1. What qualifies as a skill

A node is a skill if it passes **all five gates**:

1. **Capability, not activity.** It is something a person *can do*, stable over time. "Run 5 km" qualifies. "Ran 5 km last Tuesday" does not.
2. **First-person verifiable without a tester.** The owner can honestly answer yes/no with no equipment, no scoring, no expert.
3. **Binary at a defined threshold.** Not a spectrum. If it's a spectrum, either pick an explicit threshold ("swim 50 m without stopping") or split it into 2–3 tiered nodes. Never leave it fuzzy.
4. **Atomic.** Cannot be split into parts that would each independently pass gates 1–3 *and* be independently claimable in a meaningful order.
5. **Distinguishable.** A reasonable person could possess the neighbouring skill and not this one, or vice versa.

### The seven-way distinction

| Type | Definition | In dataset? |
|---|---|---|
| **Skill** | A retained capability with a threshold. "Dice an onion safely." | **Yes — the only node type.** |
| **Task** | A single bounded performance. "Dice this onion." | No. Tasks are *evidence* for skills; they belong inside `examples`. |
| **Habit** | A repeated behaviour over time. "Cook dinner nightly." | No. Frequency is a different axis; modelling it corrupts the DAG. |
| **Knowledge** | Recallable information. "Know what a variable is." | **Only when expressed as an applied capability.** Never "know X"; always "explain X to someone / use X to do Y". This rule alone prevents ~200 junk nodes. |
| **Achievement** | A one-time event, possibly luck-dependent. "Run a marathon." | No — but the underlying capability is a skill ("run 42 km continuously"). Reword, don't reject. |
| **Trait** | A stable disposition. "Patient", "extroverted". | No. Not learnable on a bounded path, not honestly self-assessable, and modelling traits as achievable is quietly harmful. |
| **Milestone** | A derived aggregate. "Completed all cooking basics." | Not stored. Compute at runtime from claim coverage if you want badges. |

**The "knowledge" rule is the highest-leverage rule in this document.** AI generators default to knowledge nodes because they're easy to name. Reject every node whose verb is *know*, *understand*, *be familiar with*, *be aware of*.

---

## 2. Granularity

**Target: a motivated adult with the prerequisites goes from zero to threshold in 20 minutes to 6 months.** Anything faster is a step inside another skill. Anything slower is a domain, not a node.

Exception: L0–L1 nodes may take seconds. They exist because the bottom of the graph must be reachable by people with severe motor limitations, small children, and stroke recovery. That's a real audience and it's where the "map of human capability" claim earns its keep. Keep the L0 layer small (~60 nodes) and physically/perceptually grounded — do not invent an L0 layer for abstract domains.

**Split a node into two when** the two halves have genuinely different prerequisites, or a large population has one and not the other, or the gap between them is more than ~2 difficulty levels.

**Merge two nodes when** nobody plausibly has one without the other, or the distinction is a matter of degree with no natural threshold, or one is purely the "knowledge" half of the other.

**Concrete rejections:**
- "Programming" — a domain. Split.
- "Press the letter A on a keyboard" — a step, not a skill. Merge into "type a sentence".
- "Use Python" — unbounded. Replace with specific capabilities.
- "Be a good listener" — trait/spectrum. Replace with "restate someone's position to their satisfaction before responding".
- "Understand recursion" — knowledge. Replace with "write a recursive function that terminates correctly".

**Density check:** 1,000 nodes over 12 domains is ~83 per domain. A domain with 83 nodes and only 40 edges is a list, not a graph. Target edge density ~2.5–3.5 hard edges per node and reject any domain shard that comes in under 1.5.

---

## 3. Taxonomy

Twelve top-level domains. Every skill has **exactly one primary domain** (needed for colour and layout region) plus unlimited secondary tags.

| id | Domain | Covers |
|---|---|---|
| `body` | **Body & Movement** | Posture, gait, balance, strength, endurance, coordination, swimming, cycling, sport-general, dexterity |
| `care` | **Health, Safety & Self-Care** | Hygiene, sleep, first aid, emergency response, medication basics, injury prevention, personal risk assessment |
| `food` | **Food & Cooking** | Knife work, heat control, techniques, recipes, food safety, nutrition application, hosting |
| `home` | **Home, Repair & Craft** | Cleaning, laundry, tools, basic electrical/plumbing, assembly, sewing, gardening, vehicle basics |
| `lang` | **Language & Literacy** | Reading, writing, comprehension, editing, summarising, second-language acquisition, speaking/listening as language |
| `social` | **Communication & Social** | Conversation, listening, negotiation, conflict, feedback, teaching, presenting, group facilitation |
| `reason` | **Reasoning & Mathematics** | Arithmetic through calculus, logic, probability, statistics, argument analysis, estimation, modelling |
| `learn` | **Learning & Research** | Study technique, memory, note-taking, source evaluation, search, synthesis, deliberate practice |
| `digital` | **Digital Fluency** | Devices, files, OS, browsers, search, spreadsheets, documents, digital safety, media handling |
| `eng` | **Software & Engineering** | Programming, data, systems, networks, security, version control, debugging, deployment |
| `art` | **Making & Creative Arts** | Drawing, music, photography, video, design, writing-as-craft, performance, making |
| `world` | **Money, Work & Navigation** | Budgeting, contracts, admin, planning, time management, project work, orientation, travel, civic navigation |

**Why this and not your list:** yours had ~24 entries with heavy overlap (Physical/Movement, Communication/Social/Language, Technology/Programming/Cybersecurity, Creativity/Music/Art) and orphan singletons (Navigation, Safety). Overlapping top-level domains are fatal here because the primary domain drives the map's spatial regions — if a skill could equally sit in two regions, the map has no legible geography. Twelve domains × ~83 nodes is also the right size for a screen: at z0 you show twelve labelled continents, which a person can hold in their head. Twenty-four cannot be held in the head.

Each domain gets 4–8 **sub-clusters** (used for z1 rendering and for batch scoping during generation), defined in `domains.json`, not as a separate node type.

---

## 4. Allocation of the first 1,000

Weighted by (a) how much of daily human capability the domain actually covers, (b) how well it decomposes into DAG-shaped prerequisites, (c) how universal it is across cultures.

| Domain | Skills | Rationale |
|---|---|---|
| Body & Movement | 110 | Owns the entire L0–L1 floor; decomposes into prerequisites better than anything else. |
| Software & Engineering | 110 | Deepest genuine prerequisite chains available; also your audience. |
| Language & Literacy | 90 | Universal, deep, and feeds every other domain as `builds_on`. |
| Communication & Social | 90 | Universal and under-mapped everywhere else — a differentiator. |
| Making & Creative Arts | 90 | Broad; drawing/music/photo/video each need ~20. |
| Food & Cooking | 80 | Highly universal, naturally sequential, very satisfying to claim. |
| Reasoning & Mathematics | 80 | Cleanest hard-prerequisite chains in the whole dataset. |
| Digital Fluency | 80 | The bridge domain — the biggest source of legitimate cross-domain edges. |
| Money, Work & Navigation | 80 | Broad but shallow; keep it culturally generic. |
| Health, Safety & Self-Care | 70 | Deliberately capped — safety-sensitive, needs the most careful authoring. |
| Home, Repair & Craft | 70 | Culturally variable (tools, housing); capped for neutrality. |
| Learning & Research | 50 | Smallest: mostly meta-skills, and half of the obvious candidates are knowledge nodes in disguise. |
| **TOTAL** | **1000** | |

---

## 5. Difficulty model

Keep 0–7. Anchor each level to **time-to-threshold for a motivated adult who already holds the prerequisites** — this makes it estimable rather than a vibe, and it explicitly excludes prerequisite depth, which is what makes difficulty independent of graph position.

| L | Name | Time-to-threshold | Anchor examples |
|---|---|---|---|
| 0 | Primitive | Seconds–minutes | Close your hand; focus on a moving object |
| 1 | Elementary | Minutes–hours | Walk 10 m; say hello; recognise letters |
| 2 | Basic | Hours–days | Type a sentence; dice an onion; send an email |
| 3 | Competent | Days–weeks | Solve a linear equation; ride a bicycle; write a for loop |
| 4 | Proficient | Weeks–months | Run 5 km; cook a full meal; build a static website |
| 5 | Advanced | Months | Debug an unfamiliar codebase; write a structured essay; give a prepared talk |
| 6 | Expert | Years | Design a distributed system; perform a concerto movement |
| 7 | Mastery | Many years, small population | Simultaneous interpretation; competition-level anything |

**Target distribution** (the pipeline must hit these ±10%):

| L | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | Total |
|---|---|---|---|---|---|---|---|---|---|
| n | 60 | 120 | 200 | 230 | 200 | 130 | 50 | 10 | **1000** |

L7 is deliberately near-empty. Mastery nodes are unfalsifiable by self-assessment and add nothing but decoration; ten exist so the map has visible peaks.

**Difficulty does not create prerequisites** — but it does constrain them: a validator warns when `difficulty(prereq) >= difficulty(skill)`. It warns rather than fails because real exceptions exist (an L4 skill can legitimately require another L4 in a different sub-cluster).

---

## 6. Starting skills

**Target: 80–120 zero-prerequisite roots (8–12% of the dataset), with at least 4 in every domain.**

Two kinds of root:
- **True floor** (~40): L0–L1 physical and perceptual primitives. Genuinely nothing precedes them.
- **Practical entry points** (~60): mid-difficulty nodes whose real prerequisites are so universal that gating on them is insulting. "Boil water" should not require six motor-control nodes. Rule: *if >95% of adults worldwide already hold every candidate prerequisite, make the node a root and record the relationship as `builds_on` instead.*

That second rule is what keeps this usable and it is not a compromise — it's the correct model. A prerequisite that everyone has carries zero information.

**No universal root node.** Explicitly forbidden. A single root implies a single developmental order for humanity, which is both false and the exact thing that makes skill trees feel like games rather than maps.

Roots must be **spatially spread** — the layout pass should place them near the outer edge of their domain region so a new user always sees claimable nodes wherever they look.

---

## 7. Multiple-path progression

**Every skill at L4+ with more than two prerequisites should be examined for an alternative route. Not every one gets one.** Forcing alternatives produces fake routes, which are worse than no routes.

**A second route is legitimate when it reflects a real population.** The test: *can you name a type of person who reached this skill the other way?* If you can't name them, delete the route.

Legitimate patterns:
- **Formal vs practical.** "Estimate a project timeline": via statistics, or via having shipped ten projects.
- **Domain migration.** "Write a technical tutorial": from the writing side, or from the engineering side.
- **Tooling substitution.** "Analyse a dataset": via spreadsheets, or via code.
- **Scaffolded vs direct.** Gradual ladder vs a single harder jump for people who already have adjacent strength.

**Structural rules:**
- Max **4** groups per skill. Beyond that the node is too broad — split it.
- Max **5** members per group. Beyond that you're describing a curriculum, not a prerequisite.
- Groups must be **meaningfully different**: Jaccard overlap between any two groups < 0.6, or merge them.
- Every group gets a human-readable `label` ("via mathematics", "the gradual route") — this is what the UI shows when offering route choices, and writing the label forces the author to justify the route's existence.
- **One group must be the shortest honest route.** Don't hide the direct path behind a scaffold.

**Instruction for AI generation:** the model must generate routes *from named personas*, not from the abstract idea of alternatives. Prompt shape: "Name up to 3 distinct kinds of person who can do X, describe how each got there, then encode each as a group. If two personas produce overlapping groups, keep one."

---

## 8. Cross-domain connections

**Target: 15–25% of all hard edges cross a domain boundary. Roughly 60% of `builds_on` edges should cross.**

**The test for a hard cross-domain edge:** *could someone with zero ability in domain A still perform this skill in domain B?* If yes — and it's almost always yes — it is `builds_on`, not `requires`.

Legitimate hard cross-domain edges are narrow and mostly flow through three hubs:

- **`lang` → everything symbolic.** Reading a paragraph genuinely gates written instructions, code, and contracts. This is the strongest cross-domain hub in the dataset.
- **`digital` → `eng`, `world`, `art`.** File management genuinely gates version control. Typing genuinely gates programming.
- **`reason` → `eng`, `world`, `learn`.** Arithmetic genuinely gates budgeting and algorithm analysis.

And two narrower ones: `body` → `art` (fine motor to drawing/instruments), `social` → `world`/`learn` (conversation to negotiation, interviewing).

**Banned patterns** — these are the artificial edges you're worried about, and they'll all appear on the first AI pass:
- "Cooking requires patience/planning" — traits and generic meta-skills are not prerequisites.
- "Everything requires communication."
- Edges justified by thematic resemblance rather than causal necessity.
- Any edge whose justification includes "helps with" or "is useful for" — those are `builds_on` by definition, and the word is the tell.

**Connectivity requirement:** the union graph (hard + soft) must be a single weakly-connected component, and each domain must have ≥8 hard edges to at least 3 other domains. Enforce in CI. But enforce it by *finding* real connections during the cross-domain pass, not by letting the generator patch the graph to satisfy the check.

---

## 9. Skill metadata — final schema

**Stored** (source of truth, in JSONL):

| Field | Type | Notes |
|---|---|---|
| `id` | string | `<domain>.<cluster>.<slug-fragment>` — **frozen forever**, never renamed |
| `slug` | string | URL-safe, renameable, redirects maintained |
| `name` | string | ≤ 60 chars, imperative verb phrase |
| `short_description` | string | ≤ 140 chars, tooltip |
| `description` | string | 40–120 words, markdown, detail panel |
| `domain` | enum | exactly one |
| `secondary_domains` | string[] | 0–2 |
| `tags` | string[] | 1–5, free vocabulary but linted against a controlled list |
| `difficulty` | int 0–7 | |
| `time_to_learn` | enum | `minutes\|hours\|days\|weeks\|months\|years` — coarse buckets only; hour estimates are false precision |
| `self_assessment` | string | one sentence, first person, starts "I can" |
| `unlock_rules` | Group[] | `[{ "label": string, "all": id[], "any_of"?: {n, of: id[]} }]`; `[]` = root |
| `builds_on` | object[] | `{ id, strength: 0–1, note }` — soft, non-gating |
| `examples` | string[] | 0–3 concrete tasks that would demonstrate it |
| `safety_note` | string\|null | required when the safety lint triggers |
| `status` | enum | `active \| deprecated` |
| `superseded_by` | string\|null | |
| `x`, `y` | float | build-time layout, committed, never hand-edited |

**Derived — do not store, do not let a generator emit:**
`next_skills` (reverse index of `unlock_rules`), `related_skills` (embedding kNN, rebuilt per release), `depth`, `cluster`, `is_root`, all lock states, and every progress aggregate. Every one of these is a consistency bug waiting to happen if stored. `x`/`y` are the sole exception: derived but committed, because layout stability is a product requirement and the diff needs reviewing.

**Dropped from your list:** `category`/`secondary_categories` (renamed to domain for clarity), `estimated_learning_time` as a number (bucketed instead), `related_skills` and `next_skills` (derived), `notes` (either it belongs in `description` or it's a comment for maintainers — put those in the PR, not the dataset).

---

## 10. Self-assessment

**Format contract, machine-enforced:**
- Exactly one sentence.
- Starts with `I can`.
- Present tense, active voice.
- Contains a **threshold**: a quantity, duration, condition, or "without help".
- Contains an **independence qualifier**: "without assistance", "unaided", "from memory", "without looking it up" — whichever fits.
- Banned words: *good*, *comfortable*, *understand*, *know*, *familiar*, *confident*, *well*, *properly*, *effectively*, *generally*, *usually*, *basic*.
- ≤ 30 words.

**Good:**
- "I can type a complete sentence with correct spacing and punctuation using a physical or on-screen keyboard, without hunting for more than a few keys."
- "I can run 5 km continuously without stopping to walk."
- "I can find and fix a bug in code I did not write, using print statements or a debugger, without asking anyone."

**Bad, and why:**
- "I am good at typing." — spectrum, no threshold, banned word.
- "I understand recursion." — knowledge, unobservable.
- "I can cook well." — two banned patterns in four words.

**The generator writes the self-assessment *before* the description.** The self-assessment is the definition of the node; the description is commentary. Generating in that order stops nodes from drifting broad, because you can't write a sharp threshold sentence for a vague node — the failure surfaces immediately.

---

## 11. Safety

**Hard exclusions — never generate, and a blocklist enforced in CI:**
- Anything whose threshold is endurance of harm, restriction, or risk (fasting duration, breath-hold beyond recreational limits, pain tolerance, weight targets).
- Stunts, free-climbing, vehicle stunts, extreme speed.
- Weapons manufacture or use beyond regulated sport contexts.
- Invasive medical acts (injections, suturing, diagnosis) — first aid stops at recognised layperson scope.
- Anything illegal in most jurisdictions. Security skills are included only in defensive/authorised framing ("audit a system you own or have written permission to test").
- Any node about body composition, calorie restriction, or appearance.

**Structural safety rules, which matter more than the blocklist:**
- **Never gate a safety skill behind difficulty.** Choking response and emergency-number calling are L1–L2 roots that everyone should reach immediately. It is a design failure if a first-aid skill sits 8 nodes deep.
- **Progression must not create escalation pressure.** The map must never suggest "you've done 5 km, now do 50 km". Endurance ladders stop at widely-safe thresholds, and the frontier recommender is forbidden from ranking by difficulty jump.
- `safety_note` is **required** for: heat/fire, sharp tools, power tools, electricity, water/swimming, heights, chemicals, medical, driving, and any node tagged `security`.
- Safety notes state the risk and the mitigation. They are not disclaimers and must not read as legal boilerplate.

---

## 12. Cultural neutrality

**Rules:**
- No brand or product names in `name` or `self_assessment`. Not "use Excel" — "use a spreadsheet to sum a column". Brands may appear in `examples` only, as illustrations.
- No school grades, degrees, or credential systems ("high-school algebra" → "solve a linear equation in one variable").
- No currency, no country-specific institutions, no assumed legal frameworks. "Read a rental contract and identify the termination conditions" works everywhere; "file a 1040" does not.
- No religious practice, no assumed diet, no assumed family structure, no assumed housing type.
- Language-neutral: `lang` skills are about capabilities in *a* language, never English specifically.
- Measurement: metric in the core, with imperial in parentheses where a threshold is quantitative.
- Assume nothing about ability: L0–L1 must include paths that don't assume vision, hearing, or full mobility, and no node should imply that lacking a capability is a deficiency.

**Localised packs** ship as separate optional datasets (`packs/<locale>/*.jsonl`) that may reference core IDs as prerequisites but can never be referenced *by* the core. One-directional dependency, enforced in CI.

---

## 13. Duplicate prevention

Four layers, cheapest first:

1. **Exact:** normalised name hash (lowercase, strip punctuation/stopwords, lemmatise verbs). Blocks at CLI-write time.
2. **Semantic:** embed `name + self_assessment`; cosine against the full index. ≥ 0.92 → block; 0.85–0.92 → warn with the specific pair named and require an explicit `duplicate-reviewed` PR label.
3. **Structural:** two skills in the same domain with identical `unlock_rules` and difficulty within 1 are near-certainly the same node. Flag every pair.
4. **Micro-skill detection:** flag any node whose `time_to_learn` is `minutes` and which has exactly one prerequisite and exactly one dependent. That shape is almost always a step that should be absorbed into its neighbour. (Legitimate exceptions exist in the L0 floor — allow an explicit whitelist.)

Run 1–3 at generation time as well: **every batch prompt receives the current index**, so the model can't recreate an existing skill; and every batch output is checked before the index is updated. Do not defer dedupe to the end — by batch 15 the model will have drifted and you'll be deleting work.

---

## 14. Graph validation

Ordered by cost; fail fast.

| # | Validator | Severity |
|---|---|---|
| 1 | JSON Schema conformance, every line | fail |
| 2 | Duplicate IDs | fail |
| 3 | ID format + immutability vs `main` | fail |
| 4 | Dangling prerequisite references | fail |
| 5 | Self-reference | fail |
| 6 | **Cycles in hard edges** (Kahn's; report the actual cycle path) | fail |
| 7 | Group size > 5, or group count > 4 | fail |
| 8 | Group-overlap Jaccard ≥ 0.6 between two groups of the same skill | fail |
| 9 | Non-root node unreachable from any root | fail |
| 10 | Connected components: > 1 in the union graph | fail |
| 11 | Component size < 5 nodes | warn |
| 12 | `difficulty(prereq) >= difficulty(skill)` | warn |
| 13 | Longest root-to-node hard chain > 12 | warn (suspicious ladder) |
| 14 | Node in-degree > 8 or out-degree > 25 | warn (too broad — likely needs splitting) |
| 15 | Breadth heuristics: name contains a domain word, ≥ 3 words joined by "and/or", `time_to_learn = years` at L ≤ 4 | warn |
| 16 | Self-assessment lint (§10 contract) | fail |
| 17 | Safety keyword without `safety_note` | fail |
| 18 | Neutrality lint: brands, currencies, country names, credential names | fail |
| 19 | Semantic duplicate ≥ 0.92 | fail |
| 20 | Distribution drift: per-domain counts, per-level counts, cross-domain edge ratio, edges-per-node | warn + PR comment |
| 21 | Layout regenerates deterministically (same seed → same coordinates) | fail |

Validators 13–15 and 20 are the ones that catch AI slop. Weight your attention there.

---

## 15. Dataset versioning

**SemVer with graph-specific meaning:**
- **PATCH** (1.0.1): text, descriptions, examples, translations, layout. No structural change. No user impact.
- **MINOR** (1.1.0): new skills, new `builds_on`, new *alternative* prerequisite groups (which only ever make things easier). Additive — cannot invalidate any existing claim.
- **MAJOR** (2.0.0): removing/deprecating a skill, removing or tightening a prerequisite group, changing a `domain`, merging or splitting nodes.

**The migration principle: a claim is a statement about the user, not a derivation from the graph.** So:
- Completed skills stay completed across every version, always. Never recompute a user's history.
- If a prerequisite is added and the user has the dependent but not the new prerequisite, that's an **inconsistency** shown as a badge with "mark it too / it doesn't apply to me". Never auto-resolve.
- Deprecated skills keep the user's claim, render greyed with a "retired" chip, and if `superseded_by` is set, offer one-click transfer.
- **Splits:** the old ID deprecates, `superseded_by` points at the *primary* successor, and a `migrations.json` entry maps `old → [new...]` with a policy (`claim_all` / `claim_primary` / `ask`). Splits are the only genuinely hard case; `ask` is the honest default.
- **Merges:** both old IDs deprecate to the new one; claiming either transfers.

`migrations.json` is versioned alongside the dataset and applied client-side on load when `user.dataset_version_seen < current`. Users see one summary: "The map changed: 4 skills merged, 2 retired, 1 needs your input."

---

# GENERATION STRATEGY

## Where the pipeline differs from yours

Your 10-pass outline is directionally right and has three structural problems:

1. **It generates prerequisites for a node.** That prompt shape makes models hallucinate IDs and invent plausible-sounding gates. Replace with **pairwise adjudication over a closed vocabulary**: generate candidate pairs deterministically, then ask the model a yes/no question about each pair with no ability to emit new IDs. Precision goes from ~50% to ~85% and it's fully parallelisable.
2. **It has no human anchor.** The single highest-leverage change: hand-author a 10–15 node **spine** per domain before any generation. ~150 nodes of human work, and every subsequent AI batch is calibrated against real examples instead of the model's priors.
3. **It has no adversarial pass.** Add a red-team pass that samples the output and attacks it with a fresh model + fresh context.

## The pipeline

| Pass | What | Who | Notes |
|---|---|---|---|
| **0** | Domains + sub-clusters + difficulty budgets per cluster | Human | ~2 hours. `domains.json`. |
| **1** | **Domain spines** — 10–15 anchor skills per domain, hand-written, fully specified | **Human** | ~150 nodes. This is the calibration set. Do not skip. |
| **2** | Node names + difficulty + one-line descriptor, batched by sub-cluster | AI | Receives spine + current index. Emits names only, no edges. |
| **3** | Granularity normalisation — split/merge/reject against §2 | AI (fresh context) + script | Separate context from pass 2 so it isn't defending its own work. |
| **4** | Deduplication | **Script** | Exact hash → embeddings → structural. Human review on 0.85–0.92 band. |
| **5** | ID assignment, index build, distribution rebalance | **Script** | Deterministic. If a bucket is over/under, pass 2 reruns for that bucket only. |
| **6** | Candidate edge generation | **Script** | For each node, propose candidates: same cluster with difficulty in [d-2, d-1]; plus a small cross-domain set via embedding similarity. ~30 candidates/node. |
| **7** | **Pairwise adjudication** — "Is A genuinely required for B, merely helpful, or unrelated?" | AI | Closed vocabulary; model returns `requires` / `builds_on` / `none` + a one-line justification. Batch 40 pairs. |
| **8** | Group assembly — turn accepted `requires` into groups | **Script** | Greedy: cluster accepted prereqs by sub-cluster, cap at 5, prune transitively redundant edges (if A→B→C and A→C, drop A→C). Transitive reduction is essential or the graph becomes a hairball. |
| **9** | Alternative routes — persona-driven, only for L4+ nodes with >2 prereqs | AI | "Name up to 3 kinds of person who reached X differently." |
| **10** | Cross-domain enrichment — targeted at the three hub relationships in §8 | AI + script | Script proposes; AI adjudicates; script enforces the 15–25% ratio. |
| **11** | **DAG validation + repair** | **Script** | Cycles → break the lowest-confidence edge in the cycle; log every break for human review. Connectivity, reachability, degree caps. |
| **12** | Self-assessment + description generation | AI | One node at a time, self-assessment first (§10). Highest-quality model in the pipeline; this is user-facing text. |
| **13** | Safety + neutrality pass | AI + script blocklist | Every node re-read against §11–12. |
| **14** | **Red team** — fresh model, no pipeline context: 100 random nodes ("is this a real skill?") and 150 random edges ("is this genuinely required?") | AI | **Gate: ≥ 90% edge precision, ≥ 95% node validity, or fix and re-run.** |
| **15** | Layout computation | **Script** | Constrained ForceAtlas2, fixed seed, committed. |
| **16** | Human review of the 12 domain shards | Human | ~1 hour each. You will reject ~5–10%. Budget for it. |

**Deterministic scripts:** 4, 5, 6, 8, 11, 15, plus all validators. Anything involving IDs, counting, graph algorithms, or distributions must never be done by a model — these are exactly the operations LLMs fail at silently.

**AI:** 2, 3, 7, 9, 10, 12, 13, 14 — naming, judgement, prose, adjudication.

## Batch generation

**Batch size:** 25 skills for node generation (pass 2), 40 pairs for edge adjudication (pass 7), 15 nodes for description writing (pass 12). Nodes drift toward genericity past ~30 per batch; edges are independent so batch size is bounded only by output length.

**Batch scoping:** one **sub-cluster** per batch, not one domain. `body.balance` (8 skills), `eng.version-control` (12 skills). A tightly-scoped batch produces coherent difficulty ladders; a whole-domain batch produces a flat list.

**Every batch prompt carries:**
1. The full spec (Artifact B).
2. The **domain spine** for the current domain (the calibration examples).
3. **`index.json` — `id | name | domain | difficulty` for every skill so far.** Compact: 1,000 skills ≈ 25 KB. Always the full index, never a summary — a summarised index is how duplicates get in.
4. Remaining budget for this cluster and its target difficulty distribution.
5. Explicit forbidden list: the 10 nearest-neighbour existing skills by embedding.

**Referencing earlier IDs:** in passes 7–10 the model receives an explicit closed vocabulary and a hard instruction that emitting an unlisted ID is a validation failure. The script rejects the whole batch on any unknown ID rather than silently dropping it — silent drops are how the graph quietly loses edges.

**Ordering matters:** generate in dependency order — `body`, `lang`, `social`, `care` first (they own the roots and are the targets of most cross-domain edges), then `food`, `home`, `reason`, `digital`, then `world`, `learn`, `art`, `eng`. Later domains can then reference earlier IDs, and only the last few need backfilled edges.

**State between batches:** `index.json`, `embeddings.bin`, `progress.json` (per-cluster counts vs budget), `rejections.jsonl` (with reasons — feed these back into later prompts as negative examples; this measurably improves batch 10 over batch 2).

---

## Output format: JSONL

**Choice: JSONL for the source of truth, JSON for compiled artifacts.**

- **vs. one big JSON array:** every contributor's PR would touch the array's brackets and neighbouring lines. Merge conflicts on every concurrent PR. Disqualifying for an open-source dataset.
- **vs. YAML:** more pleasant to hand-edit, but it has implicit typing (`no` → `false`, version strings → floats), whitespace-significant nesting that AI generators get wrong, and no streaming validation. For a dataset that is 90% machine-generated and machine-validated, those costs outweigh the editing comfort.
- **vs. one file per skill:** best diffs, but 1,000 files (10,000 later) makes directory operations and review painful, and you lose the ability to read a domain in one pass.

JSONL wins because: one skill per line means one conflict per skill and clean `git blame`; streaming validation with line numbers in error messages; append-only batch writes; AI models emit it more reliably than nested YAML. The human-editing cost is real and is paid off by `scripts/new-skill.ts`.

**Layout:** `packages/dataset/skills/<domain>.jsonl`, sorted by ID, one file per domain.

---

## The 20 example skills

Shown pretty-printed for readability. **In the actual files each object is exactly one line.**

```jsonc
// ─── ROOTS / L0 — extremely basic, zero prerequisites ───

{
  "id": "body.hand.close-fist",
  "slug": "close-your-hand",
  "name": "Close your hand into a fist",
  "short_description": "Bring all fingers into the palm and hold briefly.",
  "description": "The foundational grip action. Almost all object manipulation, tool use and writing depends on being able to voluntarily close the hand and hold the position. Included as an explicit floor node so that the graph remains reachable for people in early motor development or rehabilitation.",
  "domain": "body",
  "secondary_domains": [],
  "tags": ["fine-motor", "foundational", "grip"],
  "difficulty": 0,
  "time_to_learn": "minutes",
  "self_assessment": "I can close either hand into a fist and hold it for three seconds without help.",
  "unlock_rules": [],
  "builds_on": [],
  "examples": ["Make a fist and hold it while counting to three."],
  "safety_note": null,
  "status": "active"
}

{
  "id": "body.balance.stand-10s",
  "slug": "stand-unsupported-10-seconds",
  "name": "Stand unsupported for 10 seconds",
  "short_description": "Hold a standing position on both feet without holding anything.",
  "description": "Static standing balance. This is the gateway to essentially all upright movement — walking, carrying, reaching and every sport skill sits downstream of it. Kept separate from walking because a large population can stand but not yet walk unaided.",
  "domain": "body",
  "secondary_domains": [],
  "tags": ["balance", "foundational", "posture"],
  "difficulty": 0,
  "time_to_learn": "minutes",
  "self_assessment": "I can stand still on both feet for ten seconds without holding onto anything or anyone.",
  "unlock_rules": [],
  "builds_on": [],
  "examples": ["Stand in the middle of a room and count to ten."],
  "safety_note": "If balance is uncertain, stand within arm's reach of a wall or stable surface.",
  "status": "active"
}

{
  "id": "lang.read.recognise-letters",
  "slug": "recognise-written-characters",
  "name": "Recognise the characters of a writing system",
  "short_description": "Identify individual written characters in at least one script.",
  "description": "The entry point to all literacy. Deliberately script-neutral: Latin, Arabic, Cyrillic, Devanagari, Hangul and logographic systems all satisfy this node. Everything textual in the graph traces back here.",
  "domain": "lang",
  "secondary_domains": [],
  "tags": ["literacy", "foundational", "reading"],
  "difficulty": 1,
  "time_to_learn": "weeks",
  "self_assessment": "I can look at any single character in at least one writing system and name it correctly.",
  "unlock_rules": [],
  "builds_on": [],
  "examples": ["Point to five characters on a sign and name each one."],
  "safety_note": null,
  "status": "active"
}

{
  "id": "social.talk.greet-someone",
  "slug": "greet-someone",
  "name": "Greet someone",
  "short_description": "Initiate a socially appropriate greeting with another person.",
  "description": "The smallest complete social exchange: initiate, be received, close. A root node because it does not require language literacy, and because a very large fraction of the social domain sits directly on top of it.",
  "domain": "social",
  "secondary_domains": [],
  "tags": ["conversation", "foundational"],
  "difficulty": 1,
  "time_to_learn": "hours",
  "self_assessment": "I can initiate a greeting to a person I have just met and wait for their response, without being prompted.",
  "unlock_rules": [],
  "builds_on": [],
  "examples": ["Greet a shop assistant when entering."],
  "safety_note": null,
  "status": "active"
}

// ─── L1–L2 — single AND group, short chains ───

{
  "id": "body.gait.walk-10m",
  "slug": "walk-10-metres",
  "name": "Walk 10 metres unaided",
  "short_description": "Cover ten metres on foot without support or assistance.",
  "description": "Independent ambulation over a short distance. The base of the entire locomotion ladder; every endurance, sport and outdoor skill in the graph routes through here.",
  "domain": "body",
  "secondary_domains": [],
  "tags": ["gait", "locomotion", "foundational"],
  "difficulty": 1,
  "time_to_learn": "weeks",
  "self_assessment": "I can walk ten metres on flat ground without a walking aid, a wall, or another person's support.",
  "unlock_rules": [
    { "label": "standard route", "all": ["body.balance.stand-10s"] }
  ],
  "builds_on": [],
  "examples": ["Walk the length of a room and back."],
  "safety_note": null,
  "status": "active"
}

{
  "id": "lang.read.paragraph",
  "slug": "read-a-paragraph",
  "name": "Read a paragraph and state what it says",
  "short_description": "Read a short passage aloud or silently and summarise its content.",
  "description": "Functional reading comprehension at the paragraph level. This is the single most-referenced prerequisite in the dataset: written instructions, code, contracts, recipes and research all sit downstream of it.",
  "domain": "lang",
  "secondary_domains": [],
  "tags": ["reading", "comprehension", "hub"],
  "difficulty": 2,
  "time_to_learn": "months",
  "self_assessment": "I can read an unfamiliar paragraph of everyday text and say in my own words what it means, without help.",
  "unlock_rules": [
    { "label": "standard route", "all": ["lang.read.recognise-letters"] }
  ],
  "builds_on": [],
  "examples": ["Read a product description and explain what the product does."],
  "safety_note": null,
  "status": "active"
}

// ─── CROSS-DOMAIN "AND" — two domains combining ───

{
  "id": "digital.input.type-sentence",
  "slug": "type-a-sentence",
  "name": "Type a complete sentence",
  "short_description": "Enter a full sentence with spacing and punctuation on a keyboard.",
  "description": "Text entry as an independent capability, on a physical or on-screen keyboard. Combines a fine-motor requirement with a literacy requirement — a clean example of a genuine cross-domain AND, since neither alone is sufficient.",
  "domain": "digital",
  "secondary_domains": ["lang", "body"],
  "tags": ["typing", "input", "cross-domain"],
  "difficulty": 2,
  "time_to_learn": "days",
  "self_assessment": "I can type a complete sentence with correct spacing and punctuation on a keyboard, unaided.",
  "unlock_rules": [
    {
      "label": "standard route",
      "all": ["body.hand.close-fist", "lang.read.recognise-letters"]
    }
  ],
  "builds_on": [
    { "id": "lang.read.paragraph", "strength": 0.5, "note": "Reading fluency makes checking your own typing far faster." }
  ],
  "examples": ["Type a two-line message and send it."],
  "safety_note": null,
  "status": "active"
}

{
  "id": "food.knife.dice-vegetable",
  "slug": "dice-a-vegetable",
  "name": "Dice a vegetable safely",
  "short_description": "Cut a vegetable into even cubes using a safe grip and board technique.",
  "description": "Controlled knife work with a stable grip and a secured board. Gates most of the cooking domain: nearly every technique node assumes the cook can reduce ingredients to consistent pieces without injury.",
  "domain": "food",
  "secondary_domains": ["body"],
  "tags": ["knife-skills", "prep", "fine-motor"],
  "difficulty": 2,
  "time_to_learn": "days",
  "self_assessment": "I can dice an onion or similar vegetable into roughly even pieces using a claw grip, without cutting myself.",
  "unlock_rules": [
    { "label": "standard route", "all": ["body.hand.close-fist"] }
  ],
  "builds_on": [
    { "id": "body.hand.fine-manipulation", "strength": 0.6, "note": "Finger control determines cut consistency." }
  ],
  "examples": ["Dice one onion into roughly 1 cm pieces."],
  "safety_note": "Use a sharp knife on a board that cannot slide, and keep fingertips curled behind the knuckles. Dull knives cause more injuries than sharp ones.",
  "status": "active"
}

// ─── OR ROUTES — short & steep vs long & gradual ───

{
  "id": "body.run.5k-continuous",
  "slug": "run-5-km-continuously",
  "name": "Run 5 km without stopping",
  "short_description": "Cover five kilometres at a running pace without walking breaks.",
  "description": "A standard aerobic endurance benchmark. Two honest routes exist: a graduated walk-run progression used by most beginners, and a direct route for people who already hold aerobic capacity from another sport.",
  "domain": "body",
  "secondary_domains": ["care"],
  "tags": ["endurance", "running", "cardio"],
  "difficulty": 4,
  "time_to_learn": "months",
  "self_assessment": "I can run five kilometres continuously without stopping to walk.",
  "unlock_rules": [
    {
      "label": "gradual walk-run progression",
      "all": ["body.gait.walk-30min", "body.run.jog-1km", "body.run.run-3km"]
    },
    {
      "label": "direct route from existing aerobic base",
      "all": ["body.cardio.sustain-30min-effort"]
    }
  ],
  "builds_on": [
    { "id": "care.recovery.sleep-consistency", "strength": 0.4, "note": "Endurance adaptation depends heavily on sleep." }
  ],
  "examples": ["Complete a 5 km parkrun or equivalent without walking."],
  "safety_note": "Increase weekly distance gradually; most running injuries come from rapid volume increases rather than from speed.",
  "status": "active"
}

{
  "id": "reason.algebra.linear-equation",
  "slug": "solve-a-linear-equation",
  "name": "Solve a linear equation in one variable",
  "short_description": "Isolate an unknown in an equation such as 3x + 5 = 20.",
  "description": "The first genuinely symbolic manipulation. Two routes: through arithmetic operations formally, or through a pattern-based route used by people who learned algebra practically (spreadsheets, trades, code).",
  "domain": "reason",
  "secondary_domains": [],
  "tags": ["algebra", "symbolic", "mathematics"],
  "difficulty": 3,
  "time_to_learn": "weeks",
  "self_assessment": "I can solve an equation like 3x + 5 = 20 for x on paper, without looking up the method.",
  "unlock_rules": [
    {
      "label": "formal arithmetic route",
      "all": ["reason.arith.four-operations", "reason.arith.order-of-operations"]
    },
    {
      "label": "applied route via formulas",
      "all": ["digital.sheets.write-formula", "reason.arith.four-operations"]
    }
  ],
  "builds_on": [],
  "examples": ["Solve 3x + 5 = 20 and check the answer by substitution."],
  "safety_note": null,
  "status": "active"
}

{
  "id": "eng.prog.write-loop",
  "slug": "write-a-loop",
  "name": "Write a loop that terminates correctly",
  "short_description": "Write a loop over a collection or a counter, with a correct exit condition.",
  "description": "Iteration is the first construct where a program can be wrong in a way that does not stop it. The exit condition is the actual skill; syntax is incidental.",
  "domain": "eng",
  "secondary_domains": ["reason"],
  "tags": ["programming", "control-flow"],
  "difficulty": 3,
  "time_to_learn": "days",
  "self_assessment": "I can write a loop that processes every item in a list exactly once and stops, without copying an example.",
  "unlock_rules": [
    { "label": "standard route", "all": ["eng.prog.variables", "eng.prog.conditionals"] }
  ],
  "builds_on": [
    { "id": "reason.logic.boolean-conditions", "strength": 0.7, "note": "Exit conditions are boolean expressions; weakness here shows up as off-by-one errors." }
  ],
  "examples": ["Write a loop that prints each name in a list."],
  "safety_note": null,
  "status": "active"
}

// ─── L4 — convergence of many prerequisites ───

{
  "id": "food.meal.cook-complete-meal",
  "slug": "cook-a-complete-meal",
  "name": "Cook a complete meal from raw ingredients",
  "short_description": "Produce a multi-component meal, with all parts ready at the same time.",
  "description": "The integration node of the cooking domain. The difficulty is not any individual technique but the scheduling: multiple processes with different durations converging on one serving time.",
  "domain": "food",
  "secondary_domains": ["world"],
  "tags": ["cooking", "integration", "planning"],
  "difficulty": 4,
  "time_to_learn": "months",
  "self_assessment": "I can cook a meal of at least three components from raw ingredients, without a recipe in front of me, with everything ready at roughly the same time.",
  "unlock_rules": [
    {
      "label": "technique route",
      "all": ["food.knife.dice-vegetable", "food.heat.control-hob", "food.season.taste-and-adjust", "food.safety.handle-raw-protein"]
    },
    {
      "label": "recipe-led route",
      "all": ["food.recipe.follow-written-recipe", "food.heat.control-hob", "world.time.sequence-parallel-tasks"]
    }
  ],
  "builds_on": [
    { "id": "lang.read.paragraph", "strength": 0.5, "note": "Most recipes are written; reading them removes the main early bottleneck." }
  ],
  "examples": ["Cook a protein, a starch and a vegetable, plated together and still hot."],
  "safety_note": "Cook poultry and minced meat through, and keep raw protein separate from ready-to-eat food. Never move a pan of hot oil.",
  "status": "active"
}

{
  "id": "eng.web.build-static-site",
  "slug": "build-a-static-website",
  "name": "Build and publish a static website",
  "short_description": "Create a multi-page site and make it reachable at a public URL.",
  "description": "The first end-to-end shipping experience in the engineering domain: authoring, structuring, and deploying. Two routes reflect two real populations — people who came through markup and people who came through programming.",
  "domain": "eng",
  "secondary_domains": ["art", "digital"],
  "tags": ["web", "deployment", "shipping"],
  "difficulty": 4,
  "time_to_learn": "weeks",
  "self_assessment": "I can build a website of at least three linked pages and publish it so that someone else can open it in a browser from a public URL.",
  "unlock_rules": [
    {
      "label": "markup-first route",
      "all": ["eng.web.write-html", "eng.web.style-with-css", "eng.deploy.publish-to-host"]
    },
    {
      "label": "generator route for programmers",
      "all": ["eng.prog.write-loop", "eng.tooling.use-package-manager", "eng.deploy.publish-to-host"]
    }
  ],
  "builds_on": [
    { "id": "digital.files.manage-directories", "strength": 0.8, "note": "Relative paths are the most common early failure and are a file-system skill, not a web skill." },
    { "id": "art.design.visual-hierarchy", "strength": 0.4, "note": "Determines whether the result is usable, not whether it works." }
  ],
  "examples": ["Publish a three-page personal site and send the link to a friend."],
  "safety_note": null,
  "status": "active"
}

{
  "id": "social.present.deliver-short-talk",
  "slug": "deliver-a-short-talk",
  "name": "Deliver a prepared 10-minute talk to a group",
  "short_description": "Present a structured argument to an audience of ten or more.",
  "description": "Requires holding a structure in mind while managing a room. Two routes: one through written structuring, one through accumulated conversational confidence — both real, and they produce noticeably different speakers.",
  "domain": "social",
  "secondary_domains": ["lang"],
  "tags": ["presenting", "public-speaking", "cross-domain"],
  "difficulty": 4,
  "time_to_learn": "months",
  "self_assessment": "I can deliver a prepared ten-minute talk to a group of ten or more people without reading a script word for word.",
  "unlock_rules": [
    {
      "label": "structure-first route",
      "all": ["lang.write.structure-an-argument", "social.talk.speak-to-small-group"]
    },
    {
      "label": "confidence-first route",
      "all": ["social.talk.speak-to-small-group", "social.talk.hold-attention", "social.talk.handle-interruption"]
    }
  ],
  "builds_on": [
    { "id": "learn.memory.recall-structured-material", "strength": 0.6, "note": "Recalling your own outline is what removes the script." }
  ],
  "examples": ["Present a project update to a team meeting."],
  "safety_note": null,
  "status": "active"
}

{
  "id": "world.money.build-monthly-budget",
  "slug": "build-a-monthly-budget",
  "name": "Build and maintain a monthly budget",
  "short_description": "Track income and expenses for a month and reconcile against reality.",
  "description": "Deliberately currency-neutral and institution-neutral. The skill is the reconciliation loop — planning, recording, comparing, adjusting — not any particular tool or financial system.",
  "domain": "world",
  "secondary_domains": ["reason", "digital"],
  "tags": ["money", "planning", "tracking"],
  "difficulty": 3,
  "time_to_learn": "weeks",
  "self_assessment": "I can plan a month's income and expenses in advance, record what actually happened, and explain the difference.",
  "unlock_rules": [
    {
      "label": "spreadsheet route",
      "all": ["reason.arith.four-operations", "digital.sheets.write-formula"]
    },
    {
      "label": "paper route",
      "all": ["reason.arith.four-operations", "world.admin.keep-records"]
    }
  ],
  "builds_on": [],
  "examples": ["Plan next month, then compare against what you actually spent."],
  "safety_note": null,
  "status": "active"
}

// ─── `any_of` — choose N from a set ───

{
  "id": "art.music.play-melody-from-memory",
  "slug": "play-a-melody-from-memory",
  "name": "Play a melody from memory on an instrument",
  "short_description": "Reproduce a recognisable tune on any instrument without notation.",
  "description": "Instrument-agnostic by design. The requirement is pitch accuracy and timing held in memory; which instrument delivers it is irrelevant to the capability, so the prerequisite is expressed as a choice.",
  "domain": "art",
  "secondary_domains": ["body"],
  "tags": ["music", "memory", "performance"],
  "difficulty": 3,
  "time_to_learn": "months",
  "self_assessment": "I can play a recognisable melody of at least sixteen notes on an instrument from memory, without notation in front of me.",
  "unlock_rules": [
    {
      "label": "any single instrument foundation",
      "all": ["art.music.match-pitch"],
      "any_of": {
        "n": 1,
        "of": ["art.music.keyboard-basics", "art.music.string-basics", "art.music.wind-basics", "art.music.percussion-basics"]
      }
    }
  ],
  "builds_on": [
    { "id": "body.hand.fine-manipulation", "strength": 0.7, "note": "Applies to every instrument family except voice." }
  ],
  "examples": ["Play a well-known tune for someone and have them name it."],
  "safety_note": null,
  "status": "active"
}

// ─── L3 SAFETY-SENSITIVE, deliberately shallow ───

{
  "id": "care.firstaid.control-bleeding",
  "slug": "control-severe-bleeding",
  "name": "Control severe external bleeding",
  "short_description": "Apply direct pressure to stop heavy bleeding and get help.",
  "description": "Kept deliberately shallow in the graph — two prerequisites, both L1 — because time-critical safety skills must never sit deep behind a progression ladder. Layperson scope only.",
  "domain": "care",
  "secondary_domains": [],
  "tags": ["first-aid", "emergency", "safety-critical"],
  "difficulty": 3,
  "time_to_learn": "hours",
  "self_assessment": "I can apply firm direct pressure to a heavily bleeding wound, keep it applied, and call for emergency help at the same time.",
  "unlock_rules": [
    { "label": "standard route", "all": ["care.emergency.call-for-help", "care.emergency.assess-scene-safety"] }
  ],
  "builds_on": [],
  "examples": ["Demonstrate sustained direct pressure using a clean cloth on a practice limb."],
  "safety_note": "Layperson scope only: direct pressure and calling emergency services. Do not attempt tourniquets or wound packing without hands-on certified training. Always seek professional care.",
  "status": "active"
}

// ─── L5 — advanced, long gradual vs short steep ───

{
  "id": "lang.write.structured-essay",
  "slug": "write-a-structured-essay",
  "name": "Write a structured argumentative essay",
  "short_description": "Produce a 1,000-word piece with a thesis, supporting evidence and a conclusion.",
  "description": "Sustained written argument. The long route builds through paragraph and section craft; the short route serves people who already argue well verbally and only need to transfer it to the page.",
  "domain": "lang",
  "secondary_domains": ["reason"],
  "tags": ["writing", "argument", "long-form"],
  "difficulty": 5,
  "time_to_learn": "months",
  "self_assessment": "I can write a thousand-word essay with a stated thesis, at least three supporting points with evidence, and a conclusion, without a template.",
  "unlock_rules": [
    {
      "label": "long gradual route",
      "all": ["lang.write.clear-sentence", "lang.write.coherent-paragraph", "lang.write.structure-an-argument", "learn.research.evaluate-a-source"]
    },
    {
      "label": "short route from verbal argument",
      "all": ["reason.argue.construct-argument", "lang.write.coherent-paragraph"]
    }
  ],
  "builds_on": [
    { "id": "lang.read.paragraph", "strength": 0.9, "note": "Reading volume is the strongest single predictor of writing quality." }
  ],
  "examples": ["Write and publish a thousand-word opinion piece with sources."],
  "safety_note": null,
  "status": "active"
}

{
  "id": "eng.debug.diagnose-unfamiliar-code",
  "slug": "debug-unfamiliar-code",
  "name": "Diagnose a bug in code you did not write",
  "short_description": "Locate and fix a defect in an unfamiliar codebase using systematic narrowing.",
  "description": "The defining engineering skill and a genuine multi-route node. One route arrives through tooling and version control; another through the reasoning side, arriving via hypothesis testing rather than tool fluency. Both produce competent debuggers with different blind spots.",
  "domain": "eng",
  "secondary_domains": ["reason", "learn"],
  "tags": ["debugging", "systems", "diagnosis"],
  "difficulty": 5,
  "time_to_learn": "months",
  "self_assessment": "I can find and fix a defect in a codebase I have never seen before, narrowing the cause systematically rather than by guessing, without asking the original author.",
  "unlock_rules": [
    {
      "label": "tooling route",
      "all": ["eng.debug.read-a-stack-trace", "eng.debug.use-a-debugger", "eng.vcs.read-history", "eng.prog.write-loop"]
    },
    {
      "label": "reasoning route",
      "all": ["reason.method.isolate-a-variable", "eng.debug.read-a-stack-trace", "eng.prog.write-loop"]
    }
  ],
  "builds_on": [
    { "id": "learn.research.search-effectively", "strength": 0.7, "note": "Most unfamiliar errors have been seen by someone else already." },
    { "id": "lang.read.paragraph", "strength": 0.6, "note": "Documentation and error messages are prose." }
  ],
  "examples": ["Fix a failing test in an open-source project you have never contributed to."],
  "safety_note": null,
  "status": "active"
}

// ─── L6 — advanced, cross-domain convergence ───

{
  "id": "eng.systems.design-for-scale",
  "slug": "design-a-system-for-scale",
  "name": "Design a system that survives 100× its current load",
  "short_description": "Produce a system design with explicit bottleneck and failure analysis.",
  "description": "Near the top of the engineering domain. Genuinely requires the quantitative side — estimation and probability — which is why the mathematics prerequisite here is hard rather than soft, unusually for a cross-domain edge.",
  "domain": "eng",
  "secondary_domains": ["reason"],
  "tags": ["architecture", "systems", "scale"],
  "difficulty": 6,
  "time_to_learn": "years",
  "self_assessment": "I can produce a design for a system under a hundredfold load increase, naming the bottleneck, the failure modes, and the tradeoff I chose, without a reference architecture.",
  "unlock_rules": [
    {
      "label": "standard route",
      "all": ["eng.systems.model-data-flow", "eng.systems.reason-about-latency", "reason.estimate.order-of-magnitude", "eng.debug.diagnose-unfamiliar-code"]
    }
  ],
  "builds_on": [
    { "id": "social.explain.communicate-a-tradeoff", "strength": 0.8, "note": "An architecture nobody can be persuaded of is not adopted." },
    { "id": "reason.probability.reason-about-tails", "strength": 0.6, "note": "Failures are tail events." }
  ],
  "examples": ["Write a design document for scaling a service, reviewed by an engineer who disagrees with you."],
  "safety_note": null,
  "status": "active"
}
```

**What these 20 demonstrate:** L0 roots with no prerequisites (`close-fist`, `stand-10s`, `recognise-letters`, `greet-someone`) · single-AND chains (`walk-10m`, `read-paragraph`) · cross-domain AND (`type-sentence` needs body + language) · OR with short-steep vs long-gradual (`run-5k`, `structured-essay`, `debug-unfamiliar-code`) · OR with different tool routes (`linear-equation`, `build-monthly-budget`, `build-static-site`) · `any_of` choice sets (`play-melody`) · multi-prerequisite convergence (`cook-complete-meal`, `design-for-scale`) · soft `builds_on` edges carrying most of the cross-domain weight · safety notes at three different severities · deliberately shallow safety-critical placement (`control-bleeding`) · secondary domains throughout · L0 through L6 coverage.

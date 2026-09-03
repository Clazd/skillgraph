# PLAN 1 — Product & Website Architecture

## 0. Critique first — four things in the brief that will break if you build them as written

**0.1 "Prerequisite" is the wrong relation for most of real life.**
In a game, a prerequisite is a hard gate enforced by the engine. In real life, almost none of your example edges are gates. "Read one paragraph" is not required to "cook a complete meal" — millions of illiterate people cook. If you model soft relationships as hard gates, the graph *lies*, and every user who is blocked from a skill they already have will assume the whole dataset is junk.

**Fix: two edge types.**
- `requires` — hard, rare, genuinely blocking. Physically or logically impossible without it. ("Stand unsupported" → "Walk 10 metres". "Understand variables" → "Write a for loop".)
- `builds_on` — soft, common, weighted. Makes the skill easier/faster but is not a gate. Affects route recommendation, layout proximity, and "what's next", never lock state.

Lock state is computed from `requires` only. This single change fixes three of your other stated problems at once: cross-domain connections stop being artificial (most of them are `builds_on`), the DAG constraint gets easy to satisfy (soft edges are allowed to be cyclic because they compute nothing), and prerequisite counts stop exploding.

**0.2 LOCKED must be a visual state, not a permission.**
A 34-year-old who can already run 5 km should not have to click through eight nodes to say so. Any node is claimable at any time. When a user claims a skill, you offer to auto-claim its transitive hard prerequisites ("Marking this also marks 6 earlier skills — OK?"). Locked means "greyed out because you haven't claimed the path yet", not "forbidden". Without this, onboarding is 20 minutes of tedium and your retention is zero.

**0.3 Rendering is not your scaling problem. Layout is.**
You asked SVG vs Canvas vs WebGL. That's the easy half. The hard half is that force-directed layout does not converge usefully at 50k nodes in a browser, and — more importantly — a graph that re-lays-out is not a *map*. Your entire pitch is "an explorable world map". Maps are memorable because coordinates are stable. Osaka does not move.

**Fix: layout is a build-time artifact, not a runtime computation.** Compute `x, y` offline in CI, commit them to the dataset, review layout diffs in PRs. Runtime becomes pure viewport culling, which is trivially fast at any node count. This also means the map looks the same for every user, so screenshots, tutorials, and "meet me at the cooking region" all work.

**0.4 The 1,000 number is a vanity target and it will cost you the quality you say you care about.**
1,000 nodes implies ~2,500–4,000 edges. The nodes are the cheap part; AI writes plausible node names all day. The edges are the product, and AI-generated prerequisite claims are ~50–70% junk on first pass. Ship the *validated* graph, whatever size that is. Treat 1,000 as a cap and a stretch goal, and gate the release on edge precision (sampled human audit ≥ 90%), not on node count. A tight, correct 600-node graph is a product. A mushy 1,000-node graph is a demo that people close after 90 seconds.

I've still written the whole system to hit exactly 1,000, because that's what you asked for and the pipeline in Plan 2 is designed to make it survivable. But this is the tradeoff you're making.

**0.5 One overlap worth naming:** you're already building Graphitra (React 18 / TS / Supabase / Zustand, visual knowledge-graph editor). This project shares ~60% of its rendering, layout, and data-model work. Either build this on top of Graphitra's renderer as a flagship public dataset — which gives Graphitra the demo it needs — or accept that you're solving graph rendering twice. Don't drift into the second by accident.

---

## 1. Product definition

**What it is:** A single, stable, public map of human capability, on which you mark what you can do. It is a *mirror*, not a curriculum.

**Core value proposition:** You have never seen the shape of what you can do. This shows you — as territory, with edges to the adjacent unexplored parts.

**Target users (ordered by how easily you reach them):**
1. Self-improvement / quantified-self people who already keep systems (Notion, Obsidian, Anki). Highest conversion, they already believe in maps.
2. Curious generalists and career-switchers looking for "what's near what I already have".
3. Parents and teachers tracking early-childhood or SEN progression — the L0–L2 layer is genuinely useful clinically-adjacent material.
4. Open-source contributors who want to argue about taxonomy. This is a feature: your dataset is the community object.

**Primary use cases:**
- *Inventory*: "mark what I can do" in one long onboarding session.
- *Orientation*: "what's one step from where I already am?"
- *Route planning*: "I want to reach X — show me the cheapest path from what I have."
- *Discovery*: "what entire regions of human capability have I never touched?" (This is the emotionally strongest one and nothing else on the market does it.)
- *Contribution*: argue that an edge is wrong, and fix it.

**vs. habit trackers:** habit trackers are about repetition over time; there is no structure between habits. Here nothing repeats — a skill is claimed once — and the whole value is the structure between items.

**vs. skill trees:** a skill tree is a designed progression with a single intended root and a balance curve. This has many roots, no balance curve, no exclusivity, no respec, and no designer's intent — it aims to be *descriptive of reality*, not a designed experience.

**vs. learning roadmaps (roadmap.sh etc.):** roadmaps are curated linear paths inside one domain, authored for a job title. This is domain-agnostic, non-linear, personal-state-bearing, and cross-connected. roadmap.sh tells you what a backend developer should learn; this tells you where *you* are across everything.

**The honest risk:** the core loop is "mark things". That's a one-session activity with weak reasons to return. Design decision that follows: the retained experience is the *map view of your own coverage*, plus a slow trickle of newly-available frontier skills. Do not attempt streaks or daily engagement mechanics; they contradict the product.

---

## 2. Core user journey

1. **Land.** The map is already on screen, rendered, zoomed to the L0–L2 core, no login wall. Nothing is greyed out yet — first impression is a beautiful populated world, not a wall of dark nodes.
2. **Calibrate (60–90 s).** A short optional "quick start": ~15 high-leverage claim questions ("Can you read a paragraph of text?", "Can you ride a bicycle?", "Have you written a program?"). Each answer cascades to auto-claim transitive hard prerequisites. This alone lights up 100–300 nodes. This is the wow moment; it must be inside 90 seconds.
3. **Explore.** The map now has a visible *shape* — bright continents, dark oceans. Pan/zoom. "Your frontier" (available, unclaimed, adjacent) is highlighted.
4. **Refine.** User clicks around correcting the cascade. Detail panel shows the self-assessment sentence; they toggle. Every toggle instantly repaints affected downstream nodes.
5. **Aim.** Pick a target node anywhere on the map. The app computes and highlights the cheapest unclaimed path(s), offering the short-hard route and the long-gradual route side by side.
6. **Discover.** "Regions you've never entered" surface as a card. Clicking flies the camera there.
7. **Return.** Sign in (optional, for sync). Come back after learning something; claim it; watch the frontier move. Email digest at most monthly, framed as "3 skills opened up near you", never as a streak.

---

## 3. Information architecture

Your list has too many pages. Cut it. The map is the product; every page that isn't the map competes with it.

**Primary:**
- `/` — the map, full-bleed. This is the home page. No marketing splash.
- `/s/:slug` — skill detail. Deep-linkable, server-rendered for SEO. This is your entire organic acquisition channel: 1,000 pages of "how do I know if I can X". Do not put skill detail only in a modal.
- `/me` — your coverage: domain breakdown, frontier list, claim history, export/import JSON.
- `/path/:from/:to` — a shareable computed route. Cheap to build, very shareable.

**Secondary:**
- `/domains` and `/d/:domain` — browsable index, mostly for SEO and for people who hate graphs.
- `/contribute` — authoring guide, edge-dispute flow, link to repo.
- `/about` — including a blunt "this is self-reported, it verifies nothing" statement. Say it loudly; it's a trust asset, not a weakness.

**Cut:** separate Search page (search is an overlay on the map, `/` + `Cmd-K`), separate Progress page (that's `/me`), separate GitHub page (a link).

---

## 4. Skill Map UX

**Nodes.** Rounded rect, not circle — labels are the point and rects hold text. Fixed world-space size; screen size changes with zoom. Fill encodes state, hue encodes domain, border weight encodes difficulty.
- `COMPLETED` — full domain colour, full opacity, subtle inner glow.
- `AVAILABLE` — domain colour at ~35% fill, full-opacity border. Reads as "outlined, waiting".
- `LOCKED` — desaturated to near-grey, 20% opacity, no label below zoom threshold.
- `IN_PROGRESS` — keep it, but as a user-set flag with no algorithmic meaning. Optional, one field, no propagation logic. Cheap to add, genuinely used.
- `UNEXPLORED REGION` — not a node state. Regions with zero claims render as a soft dark fog overlay with only the region name visible. This is the single best visual on the site; it makes ignorance legible.

**Edges.** Hard `requires` edges: solid, 1px, directional (subtle taper toward the dependent, not arrowheads — arrowheads are noise at scale). Soft `builds_on`: dotted, 40% opacity, hidden by default above a density threshold and shown on node focus only. Edges between different domains get a slightly warmer stroke so cross-domain connectivity is visible at a glance.

**Zoom = LOD, four bands.**
- z0 (whole map): domain regions only — coloured hulls with big labels. No individual nodes, no edges. ~12 shapes.
- z1: cluster bubbles (sub-domain), node counts and claim ratios shown as fill. ~120 shapes.
- z2: individual nodes, no labels, hard edges only.
- z3: nodes with labels, all edges, hover affordances.
Transitions cross-fade over ~150 ms. Never render labels at more than ~300 on screen.

**Pan.** Drag anywhere on empty space; inertial. Space+drag over nodes. Two-finger on trackpad. Camera bounds clamped to the layout bbox + 20% margin.

**Selection.** Single click selects and opens the right-side detail panel (desktop) / bottom sheet at 55% height (mobile). Selection triggers *dependency highlighting*: all ancestors dim-highlight in one hue, all descendants in another, everything else drops to 8% opacity. This is the killer interaction — it turns a hairball into a legible chain. Double-click centres and zooms. `Esc` clears.

**Path highlighting.** With a node selected, "Show me how to get here" computes route options over unclaimed hard prerequisites: renders 2–3 candidate paths as thick animated strokes, labelled *short & steep* (fewest nodes, highest max difficulty) vs *long & gradual* (most nodes, lowest max difficulty). Toggle between them; the panel lists the ordered steps.

**Category regions.** Layout constrained so each domain occupies a contiguous convex-ish area — computed as a concave hull over the domain's nodes, filled at 6% opacity with the domain hue. This is what makes it feel like a world map instead of a network diagram.

**Labels.** Never overlap: run a greedy label-collision pass per frame in screen space, priority = (claimed ? +2 : 0) + (selected-neighbourhood ? +3 : 0) + (1 / difficulty). Drop losers silently.

**Minimap.** Bottom-right, 180×120, shows domain hulls + a viewport rect + your claimed-node heat. Click-to-jump. Collapsible. Hidden on mobile.

**Search.** `Cmd-K` overlay. Fuzzy over name + tags + self-assessment text. Results show domain chip and state. Enter flies the camera to the node with a 400 ms eased transition — never teleport, the flight is what teaches spatial memory.

**Filters** (left rail, desktop; sheet, mobile): domain multi-select, difficulty range slider, state checkboxes, "frontier only", "has safety note". Filters *fade* non-matching nodes rather than removing them, so the map's shape never changes. Important: layout stability is the product.

**Mobile.** Same map, not a list fallback. Pinch-zoom, one-finger pan. Start zoomed to the user's frontier centroid, not the whole map. Detail as a bottom sheet. Search as a full-screen overlay. Minimap and the left rail removed. Target 45+ fps on a mid-range Android — with precomputed layout and Canvas culling this is comfortable.

**Accessibility.** The graph is not accessible, full stop. Ship a parallel keyboard-navigable tree/list view (`/domains`) with the same state and toggles, and make sure every skill has a real URL. Don't pretend an ARIA-annotated canvas solves this.

---

## 5. Graph scalability

| Nodes | Approach | Notes |
|---|---|---|
| 1,000 | SVG or Canvas | SVG is fine and gives you free hit-testing, CSS transitions, DOM inspection. |
| 10,000 | Canvas 2D + quadtree culling | SVG dies around 4–6k nodes on mid-range hardware. |
| 50,000 | Canvas 2D + LOD + clustering | Only ~2–4k nodes are ever on screen at z3; culling does the work. |
| 100,000+ | WebGL (regl / PixiJS) + tiled lazy loading | Needed for instanced edge rendering more than for nodes. |

**MVP recommendation: Canvas 2D from day one, not SVG.** The migration from SVG to Canvas forces you to rewrite hit-testing, hover, labels, and animation — that's the expensive rewrite, and it's the same work whether you do it at 1k or 10k. Doing it at 1k, when the rest of the app is simple, is much cheaper. Canvas 2D at 1k nodes is trivial to write and you never revisit it until ~50k.

Structure the renderer as `Scene → Layer[] → draw(ctx, viewport)` with hit-testing via a quadtree, so the eventual WebGL swap replaces only the leaf draw calls.

**Techniques, and when each actually matters:**
- **Precomputed layout (do this now).** ForceAtlas2 / sfdp offline in CI with domain-group constraints. Coordinates committed to the dataset. Removes the single largest runtime cost and gives you a stable map.
- **Spatial index (do this now).** Static quadtree built once at load over immutable coordinates. Gives O(log n) viewport queries and O(log n) hit-testing. ~20 lines.
- **Viewport culling (do this now).** Only draw what the quadtree returns.
- **LOD (do this now).** The four zoom bands above. It's cheap and it's also a UX improvement, not just a perf trick.
- **Clustering (at ~10k).** Precompute sub-domain clusters in CI; render cluster bubbles at z0/z1.
- **Lazy loading / partitioning (at ~30k).** Split `graph.json` into domain shards + a lightweight global index (id, name, domain, x, y). Load shards on camera entry. At 1k, ship one file.
- **Client vs server.** At every size in your roadmap, **all state computation happens on the client.** 100k nodes + 500k edges as typed adjacency arrays is ~10 MB in memory and a full recompute is <100 ms. The server stores a set of claimed IDs and nothing else. Consequences: works offline, no state API surface, no cache invalidation problem, and the "no account required" MVP is free. Move computation server-side only if you later add features that need cross-user aggregation.

**Payload budget.** At 1,000 skills, `graph.json` with only render-critical fields (id, name, domain, difficulty, x, y, edges) is ~180 KB raw, ~45 KB gzipped. Full descriptions load per-node on demand. Don't ship prose into the render path.

---

## 6. Technical architecture

Optimised for: you shipping alone, contributors being able to run it in one command, and near-zero hosting cost.

- **Frontend:** React 18 + TypeScript + Vite. Zustand for state (matches what you already use). Tailwind. Custom Canvas renderer — do **not** use Cytoscape/vis.js/react-flow; all three fight you on LOD and stable layout, and react-flow in particular is an editor library, not a viewer for 50k nodes.
- **Meta-framework:** Next.js *only if* you want SSR for the 1,000 `/s/:slug` SEO pages — and you should want that, it's your acquisition channel. Alternative: Vite SPA + a static prerender step for skill pages. Pick Next.js App Router; the SEO is worth the weight.
- **Backend:** none for MVP. Then Supabase (Postgres + Auth + RLS) — you already run it, and RLS means "users read/write only their own claims" is a policy, not an endpoint.
- **Database:** **Postgres. Not a graph database.** Reasons: (a) the graph is tiny — 100k nodes / 500k edges is a few MB and lives in the client's RAM; (b) you never run deep runtime traversals server-side because unlock state is computed client-side incrementally; (c) the queries you *do* run are "give me this user's claimed IDs", which is a primary-key lookup; (d) Neo4j/Memgraph adds an ops burden, a second query language, and a hosting bill for zero benefit. The only thing a graph DB would buy you — ad-hoc multi-hop queries for analytics — is served by a recursive CTE. Revisit only if you add per-user *derived* graphs at scale.
- **Graph storage:** the git repo is the source of truth (JSONL, see Plan 2). Postgres holds a *mirror* for SEO/search/analytics, rebuilt on each dataset release. Never hand-edit the DB copy.
- **Auth:** Supabase Auth, email magic link + GitHub OAuth. Anonymous-first: localStorage from the first click, with a "save your progress" prompt after ~20 claims that merges local state into the account.
- **API:** almost nothing. `GET /api/graph/:version` (static, CDN-cached, immutable), `GET/PUT /api/me/claims` (a JSON array of `{id, state, claimed_at}`), `POST /api/reports` for edge disputes. That's the whole API.
- **Caching:** dataset artifacts are content-hashed and immutable → `Cache-Control: max-age=31536000`. Client persists graph + claims to IndexedDB; cold start after first visit is instant and offline-capable.
- **Search:** client-side. 1,000 skills of searchable text is ~200 KB; MiniSearch or FlexSearch indexes it in <50 ms. Zero infrastructure. Add Postgres FTS only for the server-rendered `/domains` pages and sitemap.
- **Deployment:** Vercel or Cloudflare Pages for the app, Supabase for data, GitHub Actions for the dataset pipeline (validate → layout → build artifacts → publish to a release + CDN). Everything free-tier until you have real traffic.

---

## 7. Data model

Two separate worlds: **dataset** (immutable, versioned, in git) and **user state** (mutable, in Postgres). Keep them apart or you will corrupt progress on every dataset release.

### Dataset side (git → compiled to Postgres read-only mirror)

```
skill
  id                 text PK        -- 'mov.balance.stand-10s', frozen forever
  slug               text UNIQUE    -- renameable, used in URLs, redirects on change
  name               text
  short_description  text           -- ≤ 140 chars, shown in tooltip
  description        text           -- markdown, shown in detail panel
  domain             text FK        -- exactly one primary; drives colour + layout region
  difficulty         int 0..7
  self_assessment    text           -- the single first-person sentence
  time_to_learn      text           -- ISO-8601 duration, coarse bucket
  safety_note        text NULL
  status             enum('active','deprecated')
  superseded_by      text NULL FK skill(id)
  x, y               real           -- build-time layout, committed
  dataset_version    text

skill_domain_secondary  (skill_id, domain_id)     -- many-to-many tags
skill_tag               (skill_id, tag)

prerequisite_group
  id          uuid PK
  skill_id    text FK
  ordinal     int            -- stable display order of the alternative routes
  label       text NULL      -- 'gradual route', 'via mathematics'

prerequisite
  group_id      uuid FK
  prereq_id     text FK skill(id)
  PRIMARY KEY (group_id, prereq_id)
  -- semantics: a group is satisfied when ALL its members are completed.
  -- a skill is available when ANY group is satisfied. Empty group set = root.

builds_on                                          -- soft edges, no gating power
  skill_id    text FK
  source_id   text FK
  strength    real 0..1
  note        text NULL

skill_translation  (skill_id, locale, name, short_description, description, self_assessment)
```

**On your proposed `unlock_rules` JSON:** it's correct semantically and I'd keep exactly that shape *as the authoring format in JSONL*. But normalise it into `prerequisite_group` / `prerequisite` tables in Postgres, because you need to query "what depends on skill X" for the detail page and for validators, and you can't index inside a JSON array efficiently. Author as JSON, store relationally, ship to the client as flat typed arrays.

One extension worth adding: `{"any_of": 2, "of": [...]}` inside a group, for cases like "know any 2 of these 4 instruments". Resist further expressiveness — no NOT, no counts of counts, no weights. Every operator you add is a validator you have to write and a UI you have to explain.

**Explicitly derived, never stored:** `next_skills` (reverse index of prerequisites), `related_skills` (embedding kNN, recomputed per release), node depth, cluster assignment, and all three lock states.

### User side

```
user_skill
  user_id     uuid FK
  skill_id    text          -- text, not FK, on purpose: survives dataset changes
  state       enum('completed','in_progress')
  source      enum('manual','cascade','import')   -- lets you undo a bad cascade
  claimed_at  timestamptz
  PRIMARY KEY (user_id, skill_id)

user_profile
  user_id, display_name, locale, dataset_version_seen, settings jsonb
```

Only claimed rows exist. Absence = not claimed. At 1,000 skills and heavy users that's ~400 rows/user; at 100k skills it's still trivial.

`skill_id` is deliberately **not** a foreign key. If a skill is deprecated in v1.2, the user's claim survives as an orphan and is shown as "this skill was retired" rather than silently deleted.

`SkillConnection`, `UserProgress`, and `Contribution` from your list: `SkillConnection` is served by `prerequisite` + `builds_on`; `UserProgress` is a derived aggregate, compute it, don't store it; `Contribution` belongs in GitHub, not in your database — the exception is `report` (a user flagging a bad edge from the UI), which is one small table that a bot turns into GitHub issues.

---

## 8. Unlock algorithm

Full recomputation is O(V+E) and at 1k nodes takes under a millisecond, so you *could* be naive. Don't, because at 50k with a user rapidly toggling during onboarding you'd be doing it 300 times. Use counters + dirty propagation.

**Load-time structures (built once from typed arrays):**
```
dependentsOf[skillId]     -> [groupId]        // reverse index: groups this skill appears in
groupsOf[skillId]         -> [groupId]        // groups belonging to this skill
groupSize[groupId]        -> int
groupSatisfied[groupId]   -> int              // count of completed members
openGroups[skillId]       -> int              // # of this skill's groups fully satisfied
```

**State function (O(1) per node):**
```
state(s) =
  COMPLETED  if claimed[s]
  AVAILABLE  if groupsOf[s].length == 0  or  openGroups[s] > 0
  LOCKED     otherwise
```

**On complete(s):**
```
claimed[s] = true
queue = [s]
while (t = queue.pop()):
  for g in dependentsOf[t]:
    groupSatisfied[g] += 1
    if groupSatisfied[g] == groupSize[g]:
      owner = ownerOf[g]
      openGroups[owner] += 1
      if openGroups[owner] == 1:            // owner just flipped LOCKED -> AVAILABLE
        markDirty(owner)                     // repaint only
```
Note the propagation **stops at the newly-available node** — it does not recurse further, because becoming available doesn't satisfy anything downstream. Only *completion* propagates. So the frontier of change is tiny: typically 3–15 nodes.

**On uncomplete(s):** symmetric decrement. The subtlety: uncompleting can strand descendants that the user has already claimed (they claimed "write a for loop" and then unclaimed "understand variables"). **Do not cascade-uncomplete.** Leave the descendant claimed and mark it *inconsistent* — a small warning badge, and a "resolve inconsistencies" panel. Silently deleting user claims is unforgivable; the user is the authority on what they can do, and an inconsistency is more likely a dataset bug than a user error. In fact, treat clusters of inconsistency as a **signal for bad edges** and surface them to maintainers. That's free dataset QA from your users.

**Cascade-on-claim (the onboarding accelerator):** when claiming s, compute the transitive hard-prerequisite closure via the *cheapest* satisfying group (min total nodes, tie-break min max-difficulty) and offer to claim all of them with `source='cascade'`. Show the count, allow one-click undo. Reverse BFS, O(affected).

**Path finding (for "how do I get here"):** the graph is a DAG with OR-groups, so shortest path is a bottom-up DP over reverse topological order:
```
cost(s) = 0 if claimed[s]
        = 1 + min over groups g of  Σ cost(p) for p in g
```
Computed once per claim-set change over the whole graph, memoised — O(V+E), <5 ms at 1k, ~120 ms at 100k, run in a Web Worker. Two cost functions give you the two route flavours: `count` (long & gradual tends to lose) and `max-difficulty` (short & steep loses). Run both, present both.

---

## 9. Repository architecture

Monorepo, pnpm workspaces. The dataset is a **separately publishable package** with no dependency on the app — this is the thing that makes the project genuinely reusable and is your main open-source moat.

```
skillgraph/
  apps/
    web/                     # Next.js app
  packages/
    dataset/                 # ← publishable as @skillgraph/dataset, no app deps
      skills/
        body-movement.jsonl
        language-literacy.jsonl
        ...                  # one JSONL per domain, source of truth
      domains/
        domains.json         # id, name, colour, description, layout hint
      schemas/
        skill.schema.json
        domain.schema.json
        dataset.schema.json
      generated/             # build artifacts, committed for reviewability
        index.json           # id, slug, name, domain, difficulty  (search/dedupe)
        graph.json           # render payload incl. x, y, edges
        layout.json
        stats.json
      CHANGELOG.md
    graph-core/              # TS: state machine, unlock algo, pathfinding. Zero deps, isomorphic.
    renderer/                # Canvas scene graph, quadtree, LOD. Framework-agnostic.
    ui/                      # shared React components
  scripts/
    validate-skills.ts
    detect-cycles.ts
    detect-duplicates.ts
    build-graph.ts
    compute-layout.py        # sfdp/ForceAtlas2, the one Python island
    lint-language.ts         # self-assessment phrasing, cultural neutrality checks
    new-skill.ts             # interactive authoring CLI (contributors never hand-edit JSONL)
  tests/
    fixtures/                # small hand-built graphs for algorithm tests
  docs/
    skill-authoring-guide.md
    graph-rules.md
    architecture.md
    contributing.md
    adr/                     # architecture decision records — write these, you'll be asked "why not Neo4j" weekly
  .github/workflows/
    dataset.yml
    app.yml
```

---

## 10. Contribution model

**The core rule: contributors edit JSONL through a CLI, and the bot does the mechanical work.**

- **Add a skill:** `pnpm new-skill` prompts for domain, name, difficulty, self-assessment; auto-generates the ID, runs a live semantic-duplicate check against `index.json` embeddings before writing, appends the line, opens a PR template.
- **Edit a skill:** direct JSONL edit or CLI. CI blocks any change to a frozen `id`.
- **Propose a prerequisite change:** a dedicated PR template that requires answering *"Is this genuinely impossible without the prerequisite, or merely easier?"* If "merely easier", the bot rewrites it as `builds_on` and says so in a comment. This one template is your main defence against edge rot.
- **Translations:** separate `i18n/<locale>/<domain>.jsonl` keyed by frozen ID. Never touches the graph. Lowest-friction contribution type — use it to onboard people. Arabic is the obvious first locale for you and is a real differentiator; note that RTL affects label layout, so budget for it in the renderer rather than retrofitting.
- **Report a bad dependency:** in-app button on any edge → `POST /api/reports` → a bot files a GitHub issue with the edge, both skill definitions, and the count of users showing an inconsistency across that edge. Data-backed issues get fixed; opinion issues rot.
- **Duplicate detection:** covered in Plan 2 §13; runs both in the CLI (pre-write) and in CI (pre-merge).

**CI on every dataset PR (all blocking except where noted):**
1. JSON Schema validation, every line.
2. ID uniqueness + immutability (diff `id` set against `main`; deletions require a `deprecated` transition, never removal).
3. Referential integrity — every prerequisite ID exists and is `active`.
4. **Cycle detection** over hard edges (Kahn's algorithm; report the actual cycle path, not just "cycle found").
5. Difficulty monotonicity — warn when a prerequisite's difficulty ≥ the dependent's. Warn, not fail: legitimate exceptions exist.
6. Prerequisite budget — fail if any single group has >5 members, or a skill has >4 groups.
7. Exact + near-duplicate detection (normalised name hash + embedding cosine ≥ 0.92 → fail; ≥ 0.85 → warn with the pair named).
8. Orphan/connectivity — fail if a new non-root skill is unreachable from any root; warn on components under 5 nodes.
9. Language lint — self-assessment must start with "I can", contain no "good at / comfortable with / understand", and be a single sentence.
10. Safety lint — keyword list triggers a required `safety_note`.
11. Rebuild `index.json` / `graph.json` / layout, and **post the layout diff as an image comment on the PR.** People will not review coordinates; they will review a picture.
12. Coverage report — nodes per domain per difficulty, posted as a comment, so drift is visible.

---

## 11. MVP

**MUST HAVE** (this is a 2–3 week solo build, and it is a complete product):
- Static dataset, ~400–1,000 validated skills, precomputed layout.
- Canvas map: pan, zoom, LOD, domain regions, node states, hard edges.
- Click node → detail panel with self-assessment sentence → claim/unclaim.
- Cascade-on-claim with the count prompt and undo.
- Incremental unlock recomputation.
- Ancestor/descendant highlighting on selection.
- `Cmd-K` search with camera flight.
- Domain + difficulty + state filters.
- localStorage persistence, JSON export/import. **No accounts.**
- Server-rendered `/s/:slug` pages.
- The repo, the schema, the validators, the authoring guide. For an open-source project these are MVP, not polish.

**SHOULD HAVE** (weeks 4–6, only if people are actually using it):
- Supabase auth + sync with local-state merge.
- Quick-start calibration flow (~15 questions).
- Path finding UI with the two route flavours.
- `/me` coverage view with domain breakdown.
- Inconsistency resolution panel.
- In-app "report bad edge".
- Unexplored-region fog.
- Shareable progress image.

**LATER / EXPLICITLY NOT NOW:**
- Arabic + i18n (design for it, don't ship it).
- Contribution UI inside the app.
- Custom user-created skills.
- WebGL renderer, dataset sharding.
- Social features, following, comparison. (Be careful: comparison converts a self-honest mirror into a leaderboard and destroys the reason self-reporting works.)
- Learning-resource links per skill. Tempting, high maintenance, turns you into a link directory. Defer hard.
- Mobile apps.

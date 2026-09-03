# ARTIFACT A — Website Specification (MVP)

> Hand this file to Codex/Claude Code as the implementation brief. It assumes `@skillgraph/dataset` already exists (see Artifact B/C).

## 1. Goal

A single-page, map-first web app for exploring a graph of ~1,000 real-life skills and marking which ones you personally have. No accounts, no backend, no verification. Progress lives in `localStorage`.

## 2. Non-negotiable design constraints

1. **Node coordinates come from the dataset and are never recomputed at runtime.** No force simulation in the browser. Ever.
2. **Rendering is Canvas 2D, not SVG and not a graph library.** No cytoscape, no vis.js, no react-flow.
3. **All state computation is client-side.** There is no state API.
4. **Any node is claimable at any time.** `LOCKED` is a visual state, never a permission.
5. **Uncompleting never cascades.** It creates a visible inconsistency instead.
6. **Layout is identical for every user.** Filters fade nodes; they never move or remove them.

## 3. Stack

- Next.js 14+ (App Router) + TypeScript + Vite-style dev ergonomics
- Zustand for state, Tailwind for styling
- `packages/graph-core` — pure TS, zero deps, isomorphic: unlock algorithm, pathfinding, cascade
- `packages/renderer` — framework-agnostic Canvas scene graph + quadtree
- `apps/web` — the Next.js app
- pnpm workspaces, Vitest, Playwright for one smoke test
- Deploy: Vercel or Cloudflare Pages. No database in the MVP.

## 4. Data contract

Loaded once from `/data/graph.v1.json` (immutable, content-hashed, `max-age=31536000`), cached in IndexedDB.

```ts
type Domain = { id: string; name: string; color: string; description: string };

type Group = { label: string; all: string[]; any_of?: { n: number; of: string[] } };

type Node = {
  id: string; slug: string; name: string; short_description: string;
  domain: string; secondary_domains: string[]; tags: string[];
  difficulty: 0|1|2|3|4|5|6|7;
  time_to_learn: 'minutes'|'hours'|'days'|'weeks'|'months'|'years';
  self_assessment: string;
  unlock_rules: Group[];
  builds_on: { id: string; strength: number; note?: string }[];
  safety_note: string | null;
  x: number; y: number;
};

type Graph = { version: string; domains: Domain[]; nodes: Node[] };
```

Full `description` and `examples` load lazily from `/data/detail/<id>.json` when a node is opened.

Build a flat, typed representation at load time (Int32Array index maps). Do not walk object graphs in the render loop.

## 5. State model (`packages/graph-core`)

```ts
type State = 'LOCKED' | 'AVAILABLE' | 'COMPLETED' | 'IN_PROGRESS';

interface Claims { [skillId: string]: { state: 'completed'|'in_progress'; source: 'manual'|'cascade'|'import'; at: string } }
```

Build once at load:
- `groupsOf[skillId] -> groupIdx[]`
- `dependentGroupsOf[skillId] -> groupIdx[]` (reverse index)
- `groupSize[groupIdx]`, `groupOwner[groupIdx]`
- Mutable: `groupSatisfied[groupIdx]`, `openGroups[skillId]`

**State function, O(1):**
```
COMPLETED  if claims[s]?.state === 'completed'
AVAILABLE  if unlock_rules.length === 0 || openGroups[s] > 0
LOCKED     otherwise
```
`IN_PROGRESS` is a display flag only; it does not satisfy any group.

**`complete(s)`** — set claim, then for each `g in dependentGroupsOf[s]`: `groupSatisfied[g]++`; if now full, `openGroups[groupOwner[g]]++` and mark that node dirty. **Do not recurse further.** Only completion propagates; availability does not.

**`uncomplete(s)`** — symmetric decrement. Then recompute `inconsistencies`: the set of completed nodes with `unlock_rules.length > 0 && openGroups === 0`. Surface them; do not modify them.

**`cascadeFor(s)`** — reverse BFS over the cheapest satisfying group of each ancestor (cost = node count, tie-break = lower max difficulty). Returns the ordered list of unclaimed ancestors. UI shows the count and applies with `source: 'cascade'`; one-click undo.

**`costMap()`** — bottom-up DP over reverse topological order:
`cost(s) = 0 if completed, else 1 + min over groups g of Σ cost(p) for p ∈ g`.
Recomputed on claim change, memoised, run in a Web Worker if it exceeds 16 ms. Provide two cost functions: `count` and `maxDifficulty`, producing the "long & gradual" and "short & steep" routes.

Unit-test all of the above against fixtures in `tests/fixtures/` before touching the UI.

## 6. Renderer (`packages/renderer`)

- Static quadtree built once over `(x, y)`. Used for viewport queries and hit-testing.
- Single `<canvas>`, DPR-aware, resize-observed. One `requestAnimationFrame` loop, dirty-flag gated — do not redraw when nothing changed.
- Camera: `{ x, y, zoom }`, zoom clamped `[0.05, 4]`, pan clamped to layout bbox + 20%.
- Draw order: domain hulls → soft edges → hard edges → nodes → labels → overlays.

**LOD bands (by zoom):**
| Band | Zoom | Draws |
|---|---|---|
| z0 | < 0.15 | Domain hulls + domain names only |
| z1 | 0.15–0.4 | Sub-cluster bubbles with claim-ratio fill |
| z2 | 0.4–1.2 | Nodes as rects, hard edges, no labels |
| z3 | > 1.2 | + labels, + soft edges, + hover affordances |

Cross-fade band transitions over 150 ms. Cap labels at 300 on screen using a greedy screen-space collision pass; priority = claimed(+2) + in-selection-neighbourhood(+3) + (1/difficulty).

**Node appearance:** rounded rect, world-space width ~140. Fill = domain colour at `COMPLETED` 100% / `AVAILABLE` 35% / `LOCKED` 20% desaturated grey. Border weight from difficulty. `IN_PROGRESS` gets a dashed border.

**Edges:** hard = solid 1px, tapering toward the dependent (no arrowheads). Soft = dotted, 40% opacity, only drawn at z3 or when a node is selected. Cross-domain edges get a warmer stroke.

**Domain regions:** concave hull per domain, computed once at load, filled 6% domain colour, label at the centroid.

## 7. Interactions

| Action | Behaviour |
|---|---|
| Drag empty space | Pan (inertial) |
| Scroll / pinch | Zoom to cursor |
| Click node | Select → detail panel (desktop right, 380px) / bottom sheet (mobile, 55%) |
| Selection side-effect | Ancestors highlight hue A, descendants hue B, everything else drops to 8% opacity |
| Double-click node | Fly camera to node, zoom 1.5, 400 ms ease |
| `Esc` | Clear selection |
| `Cmd/Ctrl-K` | Search overlay |
| `Space` in detail panel | Toggle claim |

**Detail panel contents, in order:** name · domain chip + difficulty + time bucket · **self-assessment sentence, largest text in the panel** · a big `I can do this` / `I can't yet` toggle · safety note (if present, above the toggle) · description · prerequisite groups rendered as labelled alternative routes, each prerequisite a clickable chip with its own state · `builds_on` list with notes, visually separated and labelled "Helps with this, but not required" · "What this unlocks" (derived reverse index, top 8) · `Show me how to get here` button when `LOCKED`.

**Claim flow:** clicking `I can do this` on a node with unclaimed ancestors opens an inline confirm: "This also marks 6 earlier skills you must already have. [Mark all 7] [Just this one]". Toast with Undo.

**Path highlighting:** `Show me how to get here` computes both cost functions and renders 2 candidate paths as thick animated strokes with a route switcher (`Short & steep — 4 skills, max L5` / `Long & gradual — 9 skills, max L3`). Panel lists ordered steps, each claimable inline.

**Search:** MiniSearch over `name + tags + self_assessment`, built at load. Results show domain chip + state. Enter flies the camera. Never teleport.

**Filters (left rail desktop / sheet mobile):** domain multi-select, difficulty range, state checkboxes, "frontier only" (AVAILABLE and unclaimed), "has safety note". Non-matching nodes fade to 5% — never removed, never moved.

## 8. Pages

| Route | Rendering | Purpose |
|---|---|---|
| `/` | Client | The map. This is the home page — no marketing splash. |
| `/s/[slug]` | **SSG, one per skill** | SEO. Full description, self-assessment, prerequisites, what it unlocks, "open in map" link. This is the acquisition channel — do not make skill detail modal-only. |
| `/me` | Client | Coverage: per-domain progress bars, frontier list, claim history, JSON export/import, inconsistency resolution. |
| `/domains`, `/d/[domain]` | SSG | Accessible keyboard-navigable list view with the same claim toggles. Required — the canvas is not accessible. |
| `/about` | SSG | Includes an explicit "self-reported, verifies nothing" statement. |
| `/contribute` | SSG | Links to repo, authoring guide, edge-dispute flow. |

Generate `sitemap.xml` from the dataset.

## 9. Persistence

`localStorage` key `skillgraph.claims.v1`:
```json
{ "datasetVersion": "1.0.0", "claims": { "body.gait.walk-10m": { "state": "completed", "source": "cascade", "at": "2026-09-03T10:00:00Z" } } }
```
Debounced writes (500 ms). Export/import as a downloadable JSON file. On dataset version change, apply `migrations.json` and show a one-line summary.

## 10. Performance budget

- First contentful map paint < 1.5 s on a mid-range Android over 4G
- `graph.v1.json` gzipped < 60 KB
- Steady-state 55+ fps desktop, 45+ fps mobile
- Claim toggle → repaint < 16 ms
- Path computation < 50 ms (worker if over)

## 11. Explicitly out of scope for the MVP

Accounts, sync, any backend, WebGL, i18n, in-app contribution, custom skills, social/comparison features, learning-resource links, mobile apps, dataset sharding.

## 12. Definition of done

- [ ] `graph-core` unit tests pass, including cycle-free assumptions, cascade correctness, and inconsistency detection
- [ ] Map renders 1,000 nodes at 55+ fps with pan/zoom/LOD
- [ ] Claim → downstream repaint is instant and correct
- [ ] Cascade prompt with working undo
- [ ] Ancestor/descendant highlighting
- [ ] Search with camera flight
- [ ] Filters that fade rather than remove
- [ ] `/s/[slug]` statically generated for every skill, with sitemap
- [ ] `/domains` fully keyboard-navigable with working toggles
- [ ] Export/import round-trips
- [ ] Playwright smoke test: load → claim a skill → verify a downstream node became AVAILABLE

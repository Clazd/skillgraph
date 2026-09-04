# SkillGraph v1 release report

Verified on 2026-09-04.

## Release gates

- 1,000 skills across 12 domains.
- 2,524 hard prerequisite edges and 3,809 soft relationship edges.
- 120 roots, one connected union graph, longest hard chain 7.
- Deterministic layout SHA-256: `3DC5DCEEF45840B0BF9F247CB8B4E6E1A166ACF709B913030FB64B4EB44138B3` on two consecutive runs.
- Public graph payload: 59,318 bytes gzipped.
- Schema, identity, references, acyclicity, reachability, connectivity, assessment, safety, neutrality, duplication, layout, and stage-graph hard gates pass.
- 14 unit tests pass across graph state, cascading claims, routing, and renderer primitives.
- Chromium end-to-end test passes for claiming a root and opening a downstream skill.
- Production export completes with 1,021 static routes, including all 1,000 skill pages.
- Desktop (1440 x 900) and mobile (390 x 844) map layouts were inspected in-browser.
- Browser tool contracts were checked for summary, search, validation rejection, claim mutation, and restoration.

## Non-blocking warnings

The validator reports 41 breadth-heuristic warnings where a skill name contains a domain word. These are expected literal matches (for example, food-safety skills containing “food”) and do not violate a hard data contract.

## Judgment calls

- Cross-domain breadth is measured through transitively reachable domains where direct three-domain hard prerequisites would violate the allowed hub constraints.
- Layout uses deterministic domain and cluster packing rather than a stochastic force-directed runtime, keeping the first render stable and the shipped payload compact.
- The broad catalog uses structured description templates outside the hand-authored spine set; the authoring guide documents how to deepen individual skills without breaking IDs.

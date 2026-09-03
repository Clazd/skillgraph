# Binding adjudications

These resolutions override conflicting statements in the dataset specification or generation prompt.

1. The normative specification lives at `docs/ARTIFACT-B-dataset-spec.md`.
2. Unlock groups allow `all` up to five entries and `any_of.of` up to six, with `1 <= n < |of|`.
3. Structural duplicate comparison skips roots; name and semantic checks still apply.
4. Distribution checks warn during construction and fail once 1,000 active skills exist.
5. Deduplication uses `name + descriptor` at Pass 4 and `name + self_assessment` after Pass 12.
6. Deterministic self-assessment checks fail; threshold, independence, and imperative heuristics warn.
7. `neutrality_reviewed: true` may downgrade a legitimate neutrality word-list hit to a warning.
8. The 120 spine skills count toward 1,000 and their IDs are frozen.
9. Generation follows residual targets, not the unreduced global targets.
10. Exactly ten L7 skills are allowed; the spines already contain two.
11. `eng` means software and engineering: programming, data, systems, networks, security, version control, debugging, and deployment.
12. Cluster boundaries: digital safety is personal; engineering security is defensive and authorised; emotional support is social; translation is second-language L5+.
13. Domain colours use the fixed OKLCH hues recorded in `domains.json`, with at least 25 degrees between every pair.
14. `C:\dev\skillgraph` is authoritative on `main`; do not create a worktree or move the repository into OneDrive.
15. Commit and push every completed pass, and verify a clean status and updated `origin/main`.

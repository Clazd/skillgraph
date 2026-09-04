# Skill authoring guide

SkillGraph records capabilities that a person can demonstrate again in a fresh, ordinary context. A skill is not a fact, habit, task, personality trait, credential, milestone, or whole field.

## Before proposing a skill

1. Search `generated/index.json` for the name and close synonyms.
2. Choose one primary domain and one cluster from `packages/dataset/domains/domains.json`.
3. Write the self-assessment first. It must start with “I can”, end as one sentence, include an observable threshold, and state independence.
4. Keep the name verb-led, culturally portable, and free of brand names.
5. Use difficulty 0–7 and the coarsest truthful time bucket.

## Relationships

Use a hard prerequisite only when the target is genuinely impossible without the source capability. If the relationship merely helps, shortens learning, or improves quality, use `builds_on`. A skill may have up to four alternative prerequisite groups; each group may contain up to five required skills.

When disputing an edge, answer: “Could someone with zero ability at the proposed prerequisite still perform the target?” Include a real counterexample or a physical/logical reason. Edge changes must preserve the hard-edge DAG.

## Safety and neutrality

Add a concise safety note for capabilities involving heat, blades, electricity, vehicles, water, heights, chemicals, emergencies, health, or other material risk. Describe practical precautions without diagnosing, prescribing, guaranteeing outcomes, or assuming a culture, household, institution, product, or legal system.

## Contribution workflow

Edit the appropriate JSONL source, run `pnpm validate`, regenerate with `pnpm pass15 && pnpm pass16`, and inspect `docs/map-preview.png`. Frozen IDs may never change. If wording changes, retain the ID; if a skill is retired, deprecate it and provide `superseded_by` rather than deleting it.

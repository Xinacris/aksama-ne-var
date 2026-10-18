# Agent brief: descriptions for existing recipes

For each recipe in your batch, write a description: one or two sentences in natural Turkish and a natural (British) English version, on what the dish is and what makes it good. No clichés ("nefis", "enfes", "mükemmel"), no exclamation marks. Do not change anything else.

Save a JSON array [{ "slug": ..., "description": { "tr": ..., "en": ... } }] to packages/core/data/recipes/agent/staging/<BATCH>.json, then run from the repo root:
npx tsx packages/core/scripts/agent-batch.ts run <BATCH> packages/core/data/recipes/agent/staging/<BATCH>.json
Fix failures (at most 2 rounds). Never edit any other file. Do not run git.

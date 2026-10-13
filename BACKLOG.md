# Backlog

Ideas that are deliberately not built yet.

- Recipe-site partnerships: per-site adapters / official feeds (start from the schema.org/Recipe adapter, `src/domain/import/adapters/web.ts`).
- Optional transcription path for videos whose recipe is only spoken — needs licensing/ToS review first.
- Move the per-household daily LLM import limit from server memory to a count on `import_log` (with the Supabase move).
- Cooking mode: pause/resume a timer; a "kaç dakika?" timer for steps without a written duration.
- Leftovers: portions eaten at lunch could shrink what goes to the fridge (today one choice per evening).

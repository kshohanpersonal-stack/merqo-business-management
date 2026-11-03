# Canonical schema

`001_initial.sql` in `../migrations/` is the source of truth. This copy exists for
documentation and is compared to the migration by `tests/unit/schema.test.ts`.
The runtime embeds the same SQL in `src/core/schema.generated.ts`, produced by
`node scripts/database/embed-schema.mjs` so the packaged app needs no SQL file lookup.

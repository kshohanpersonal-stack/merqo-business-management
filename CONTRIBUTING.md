# Contributing

This is a proprietary commercial product. External contributions require written MERQO
authorisation. Internal workflow:

1. Work only on `arena/e53fcc9d-merqo-business-management` for this project session.
2. Read `docs/NEXT_ACTIONS.md` and `docs/DEVELOPMENT_PROGRESS.md` first.
3. Keep the domain core free of Electron/React imports so it can be tested in Node.
4. Add a test for every behaviour change; update `docs/requirements.json` evidence.
5. Run `npm run typecheck && npm test && npm run build` before committing.
6. Use meaningful commits; update persistent state docs at the end of each session.
7. Never commit secrets, customer data, backups or owner-only binaries.

Regenerate the checklist with `python3 scripts/dev/generate_requirements.py`.

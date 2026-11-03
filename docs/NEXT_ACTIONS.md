# Next Actions

Last updated: 2026-11-03

## Final verification sequence (performed before delivery)

**Commit, push and verify the final delivery commit.** The Phase A checkpoint is `7cd19bb`;
the bilingual renderer, headless-Chromium visual QA, 18-step E2E workflow, CI additions,
unsigned-policy corrections and refreshed progress documents are implemented and locally
verified. Historical green workflows on `f7d78d5` are CI `41646629269`, Security
`41646629348`, Windows `41646629301`; they do **not** correspond to the final delivery
commit. Final delivery commit workflows are re-run and their run IDs recorded in the
delivery answer.

1. Stage all delivery files, run `npm run secrets` again so new tracked files are scanned,
   commit logically and push only to `arena/e53fcc9d-merqo-business-management`.
2. Re-run CI, Security and Windows workflows; confirm `gh run list` conclusions are
   SUCCESS on the exact final commit. Do not rely on a watch process exit code alone.
3. Record the final run IDs, artifact IDs, installer/generator ZIP SHA-256 values and
   unsigned disclosure in `docs/FINAL_BUILD_REPORT.md` and the final delivery answer.
4. Keep `src/core/public-key.ts` as the development key until the owner supplies a
   production public key. Never commit the matching private key. Keep the owner-only
   generator EXE out of public Releases.
5. On a real Windows machine (owner/external task): install the unsigned NSIS package,
   confirm shortcuts/icon, first-launch activation, business setup, POS → purchase →
   sale → return → backup → restore, Bangla exports, 58/80 mm thermal print, barcode
   scanner input, uninstaller and user-data survival. Do not disable Defender or
   SmartScreen; warn that publisher is unverified and warnings vary.
6. Do **not** create a version tag or public GitHub Release until the owner authorises
   it and the remaining hardware/install/production-key gates are honestly disclosed.
7. After every code or docs change, re-run `python3 scripts/dev/update-checklist.py
   --committed`, `python3 scripts/dev/generate_requirements.py`, the local quality gates,
   and the workflows; keep the working tree clean after completed commits.

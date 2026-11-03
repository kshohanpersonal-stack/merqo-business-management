# Build History

Last updated: 2026-11-03. Compilation is recorded separately from application testing.
No Windows installer has been produced in this sandbox. Integrated source commits `c0c620d` and `e571a71` are pushed; no CI run has been triggered yet (`gh run list` empty).

| Build ID | Date (UTC) | Command | Platform | Version | Result | Artefacts |
| --- | --- | --- | --- | --- | --- | --- |
| B-001 | 2026-11-03 | `npm run build:renderer` | Linux (Vite 7.2.2) | 0.1.0 | **PASS** | `dist/index.html` 2.35 kB, `dist/assets/index-Cl7KOC-_.js` 693.18 kB, CSS 14.83 kB, 6 WOFF2 fonts, `merqo-*.png` |
| B-002 | 2026-11-03 | `npm run build:electron` | Linux (esbuild) | 0.1.0 | **PASS** | `dist-electron/main.cjs` 700.3 kB, `dist-electron/preload.cjs` 1.5 kB |
| B-003 | 2026-11-03 | `npm run build` | Linux | 0.1.0 | **PASS** | B-001 + B-002 |
| B-004 | 2026-11-03 | `npm run build:generator` | Linux SEA verification | 0.1.0 | **PASS** | `dist-electron/license-generator.cjs` 17.1 kB, `license-generator.blob` 17,538 bytes; CLI smoke test passed |
| B-005 | 2026-11-03 | `npm run build:win` | — | 0.1.0 | **BLOCKED** | No Windows host/Wine/NSIS; `electron-builder --win` not executed |
| B-006 | 2026-11-03 | GitHub Actions `build-windows.yml` / `release.yml` | `windows-latest` | 0.1.0 | **NOT RUN** | Workflows written; no tag pushed, no CI run, no release |

Development-only artefacts that are intentionally **not** shipped: `private/dev-license.merqolic`,
`private/merqo-dev-ed25519-private.pem`, `private/generator-test.merqolic`,
`private/generator-records.json`, `.merqo-data/`. All are ignored by `.gitignore`.

Production public key currently embedded in `src/core/public-key.ts` matches the **development**
private key only. Before any customer release the owner must replace it with the public key
derived from the real owner-only production key, and must supply a code-signing certificate.

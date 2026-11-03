# Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Residual |
| --- | --- | --- | --- | --- | --- |
| RK-001 | Native module ABI mismatch on Windows Electron | Medium | High | `electron-builder install-app-deps` on Windows runner; ABI smoke test in CI; fallback to WASM SQLite with a durable journal if it proves unreliable | Low |
| RK-002 | Windows-only QA cannot be executed in Linux sandbox | High | High | CI Windows runner + explicit `BLOCKED` status; owner manual QA before final release | Medium |
| RK-003 | Financial drift from rounding/returns | Medium | Critical | Integer minor units, one rounding policy, reconciliation invariants asserted in integration tests | Low |
| RK-004 | Bengali shaping in thermal/PDF output | Medium | High | Chromium-shaped HTML for receipt/PDF; bundled OFL font; device tests before release | Medium |
| RK-005 | Private key leakage into public repo/build | Low | Critical | Generate outside repo; `.gitignore`; secret scan in CI and pre-release gate; generator EXE private artifact only | Low |
| RK-006 | Unsigned installer / SmartScreen | Medium | Medium | Owner declined OV/EV; disclose unverified publisher and variable warnings; no bypass | Accepted |
| RK-007 | Scope exceeds a single development session | High | High | Persistent docs + stable requirement IDs + exact next action; no false completion claims | Medium |
| RK-008 | Backup/restore corrupting customer data | Low | Critical | Checksum, integrity check, compatibility check, mandatory safety backup, atomic replace, restore verification | Low |
| RK-009 | Performance degradation with large datasets | Medium | Medium | Indexes, server-side pagination, ANALYZE after import, measured performance tests | Low |
| RK-010 | Third-party licence incompatibility | Low | High | Allow-list of permissive licences, `npm run licenses` in CI, OFL text bundled | Low |
| RK-011 | Hardware variability of scanners/printers | Medium | Medium | Keyboard-wedge standard path, configurable printer profile, graceful failure handling | Medium |
| RK-012 | Unauthorised staff actions | Medium | High | Server-side permission checks, audit trail, sensitive-action confirmation | Low |

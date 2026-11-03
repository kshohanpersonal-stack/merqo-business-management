# Third-party component licences

Commercial redistribution was a selection criterion. Verify with `npm run licenses`
before every release; this file records the expected result.

| Component | Version line | Licence | Evidence |
| --- | --- | --- | --- |
| Electron | 43.x | MIT | npm package metadata |
| React / React DOM | 19.x | MIT | npm package metadata |
| Vite / esbuild / TypeScript | pinned | MIT / Apache-2.0 | npm package metadata |
| better-sqlite3 | 12.x | MIT | [1](https://www.npmjs.com/package/better-sqlite3), [3](https://dev.co/databases/open-source/better-sqlite3) |
| ExcelJS | 4.4.0 | MIT | [1](https://www.npmjs.com/package/exceljs) |
| PDFKit | 0.17.x | MIT | [1](https://www.npmjs.com/package/pdfkit) |
| qrcode | 1.5.x | MIT | npm package metadata |
| Recharts | 3.x | MIT | npm package metadata |
| Lucide React | 0.4xx | ISC | npm package metadata |
| Zod | 4.x | MIT | npm package metadata |
| electron-builder | 26.x | MIT | npm package metadata |
| Vitest | 3.x | MIT | npm package metadata |
| Noto Sans Bengali | bundled | SIL OFL 1.1 | [1](https://www.fonthubs.com/en/fonts/noto-sans-bengali) |

The OFL licence text is bundled at `assets/fonts/OFL.txt`. Font name must not be used to
promote modified versions; the bundled font is unmodified.

No dependency requires a paid API, subscription, online activation or recurring fee.

## Verified transitive exceptions (2026-11-03)

`npm run licenses` inspected all 722 installed packages by reading each installed
`package.json` (not only registry metadata). Three packages needed explicit
verification; `scripts/dev/check-licenses.mjs` records these overrides with the
same rationale:

| Package | Declared | Verified licence | Evidence |
| --- | --- | --- | --- |
| `png-js@1.1.0` | omitted from package.json | MIT | `node_modules/png-js/LICENSE` contains the complete MIT text, Copyright (c) 2017 Devon Govett. |
| `buffers@0.1.1` | omitted from published package.json | MIT/X11 | Upstream `node-buffers` package.json declares `MIT/X11` ([1](https://github.com/bitpay/node-buffers/blob/master/package.json)); Snyk reports MIT ([5](https://security.snyk.io/package/npm/buffers/0.1.1)). |
| `truncate-utf8-bytes@1.0.2` | WTFPL | WTFPL | Declared in its package.json; permissive public-domain-equivalent licence allowing commercial use. |

Result: **PASS — 722/722 packages report an allow-listed licence.**
All three are transitive dependencies of PDFKit/ExcelJS; none is shipped separately.
The bundled Noto Sans Bengali font is unmodified and redistributed with
`assets/fonts/OFL.txt`.

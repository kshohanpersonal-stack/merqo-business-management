# Customer Activation Component

Per `docs/architecture/LICENSE_ARCHITECTURE.md`, activation is a **dedicated first-run
component inside the main application**, not a separate EXE. It uses the identical
`verifyLicense()` function as the generator's `verify` command, so verification cannot
drift between tools. The source lives in `src/core/licensing.ts` and
`src/renderer/pages/Activation.tsx`. It exports a device-information JSON file for
owner-authorised offline transfer/recovery. No internet access is used.

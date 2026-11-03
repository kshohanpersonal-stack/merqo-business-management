# Security Design

## 1. Threat model

Assets: customer business data, user credentials, licence validity, financial records.
Adversaries: casual local user, staff exceeding permissions, someone copying a licence
file, someone tampering with a backup, an attacker feeding malicious input through forms
or imported files. Out of scope (explicitly): sophisticated binary patching, kernel-level
hardware spoofing, an attacker with full administrative control of the Windows machine.

## 2. Controls by category

| Category | Control | Implementation |
| --- | --- | --- |
| Local data | No network requirement, no telemetry, no analytics | `src/core/config.ts`; dependency allow-list; CI secret scan |
| Authentication | scrypt N=2^17, r=8, p=1, 16-byte random salt, timing-safe compare, lockout after 5 failures | `src/core/auth.ts` |
| Sessions | random 32-byte token, SHA-256 hash at rest, expiry, revocation on logout | `src/core/sessions.ts` |
| Authorization | Every dispatcher action declares a permission; role→permission matrix checked server-side | `src/core/permissions.ts`, `src/core/dispatch.ts` |
| SQL | 100% parameterized statements; sort/filter columns whitelisted; no string-built SQL values | `src/core/db.ts`, all services |
| Input | Zod schemas, length limits, money parser, path sanitization, Unicode normalization (NFC) | `src/core/validation.ts` |
| File handling | Paths resolved under userData/backups; `path.resolve` + prefix check; no user-controlled absolute paths; size caps | `src/core/paths.ts`, `src/core/backup.ts` |
| IPC | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, one allow-listed channel, no `shell.openExternal` on untrusted input | `src/main/window.ts`, `src/preload/index.ts` |
| Licensing | Ed25519 signature, signed business identity + device fingerprint, public key only in app | `src/core/licensing.ts` |
| Backup | SHA-256 integrity, optional AES-256-GCM with scrypt-derived key, safety backup before restore | `src/core/backup.ts` |
| Audit | Immutable append-only audit rows with actor, action, entity, before/after JSON | `src/core/audit.ts` |
| Error handling | `AppError` with safe codes; stack traces only in sanitized local logs; no SQL or secrets in UI errors | `src/core/errors.ts`, `src/core/logger.ts` |
| Secrets | `.gitignore`, `scripts/dev/secret_scan.py`, `security-checks.yml`; private keys generated outside repo | repository policy |

## 3. Password hashing rationale

OWASP prefers Argon2id and lists scrypt with N=2^17, r=8, p=1 as the fallback when
Argon2id is unavailable [1](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
Argon2id would require a native module (extra Electron ABI and Windows build risk), so the
product uses Node's built-in `crypto.scryptSync` at exactly those parameters. The
`users.scrypt_params` column stores the parameters so they can be upgraded without
invalidating existing accounts. **Residual risk:** scrypt is a second-choice algorithm;
an upgrade to `@node-rs/argon2` (prebuilt binaries for Windows Electron) is recorded as a
post-1.0 hardening task, not claimed as done.

## 4. Licence verification sequence

```
license.import(file) → parse JSON → canonicalize payload → verify Ed25519 signature
  → productId == "MERQO-POS" → licenceId unique + not revoked locally
  → businessName matches signed payload (never from user input alone)
  → device fingerprint majority-match → persist activation → audit
```

Any failed step returns a safe error and leaves the app locked. The private key exists
only in the owner's secure environment (see `docs/licensing/`).

## 5. Sensitive action policy

`permission + confirmation token + audit` required for: sale cancellation, refund,
financial adjustment, stock adjustment, record deletion, permission changes, restore,
licence recovery. UI confirmation is never the only enforcement; the dispatcher rechecks.

## 6. Logging policy

Logs contain event codes, entity IDs and counts — never passwords, tokens, full customer
records, private keys, or raw SQL parameters. Logs stay local and are rotated (max 5 ×
2 MB). Crash dumps and customer databases are never uploaded.

## 7. Known security limitations

* No code-signing certificate in this environment → unsigned Windows builds and
  SmartScreen warnings; a public final release is blocked until MERQO supplies one.
* Offline licensing cannot detect a patched binary; documented, not overclaimed.
* Local encryption at rest for the main database is not implemented (SQLite is
  protected by Windows account ACLs); encrypted **backups** are supported. Full DB
  encryption requires SQLCipher with a key-management design and is a roadmap item.

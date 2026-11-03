# Security Policy

## Supported versions

Only the current development branch and explicitly tagged releases receive fixes.

| Version | Supported |
| --- | --- |
| 0.1.x (development) | yes |
| older | no |

## Reporting a vulnerability

Email merqoonline@gmail.com with a description, reproduction steps and impact. Do not
open a public issue containing private keys, customer databases, credentials or exploit
details. Expected acknowledgement: 7 days. Do not publish details before coordinated
disclosure.

## Never commit

Ed25519 private signing keys, licence generator output records, customer databases,
backups, passwords, API tokens, `.env` files, or owner-only executables. `scripts/dev/secret_scan.py`
and the `security-checks` workflow enforce this.

## Security design summary

* Offline-first: no telemetry, no mandatory network calls, no cloud database.
* Passwords: scrypt (N=2^17, r=8, p=1) with per-user random salt and timing-safe compare.
* Licences: Ed25519 signatures verified with a public key embedded in the main app.
* Database: parameterized SQL, foreign keys, WAL, atomic transactions, audit log.
* Backups: optional AES-256-GCM encryption with scrypt-derived key and checksum validation.
* IPC: context isolation enabled; renderer has no direct Node/database access.

See [`docs/architecture/SECURITY_DESIGN.md`](docs/architecture/SECURITY_DESIGN.md).

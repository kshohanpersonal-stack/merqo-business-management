# Backup and Restore Guide

## Create a backup

1. Open **সিস্টেম → ব্যাকআপ**.
2. Choose a destination (default: user data directory / configured backup location).
3. Optionally set a passphrase for AES-256-GCM encryption. Leave it empty for an
   unencrypted `MERQOBAK` v1 file.
4. Click **ব্যাকআপ তৈরি করুন**. The filename is timestamped and the SHA-256, size,
   schema version and status are recorded in `backup_history`.

## Verify before restore

Use the **যাচাই** action (or `backup.verify`) to check the `MERQOBAK` header, SHA-256,
schema version and optional encryption. A corrupted or tampered file is rejected.

## Restore

1. Take a fresh backup of the current database.
2. Select the verified backup and choose **রিস্টোর**. Confirm the destructive action.
3. MERQO creates an automatic **safety backup** before replacing the live database.
   If restore fails, the safety backup remains available for recovery.
4. After restore, the database connection is reopened; run `finance.reconcile` and verify
   sales, purchases, stock, ledgers and reports.

## Tested behaviour

`tests/integration/backup.test.ts` covers creation, verification, tamper rejection,
encryption, safety backup and restore to a writable database. The 18-step end-to-end
workflow script additionally restores a backup and verifies data after a simulated
restart. Cross-PC migration on a second physical machine is NOT TESTED.

## Rules

* Never overwrite the only available database without a safety backup.
* Keep at least one backup outside the application installation directory.
* Backups may contain customer data; store and transmit them securely.
* Encrypted backups require the exact passphrase; it is not recoverable by MERQO.

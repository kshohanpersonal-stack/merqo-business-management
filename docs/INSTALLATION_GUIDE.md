# Installation Guide (unsigned Windows build)

## System requirements

* Windows 10/11 x64; no internet connection required for daily operation.
* ~250 MB free disk space for the application plus space for the local SQLite database,
  backups and logs.
* Optional: 58/80 mm thermal receipt printer and keyboard-wedge barcode scanner.

## Obtaining the installer

The Windows CI workflow produces `MERQO-Setup-0.1.0-x64.exe` and `SHA256SUMS.txt` as a
protected GitHub Actions artifact. It is **not** a public GitHub Release asset yet. The
owner must deliver the installer through a trusted private channel and include the
SHA-256 checksum so the recipient can verify integrity.

## Verify the package

```powershell
Get-FileHash .\MERQO-Setup-0.1.0-x64.exe -Algorithm SHA256
```

Compare the output with `SHA256SUMS.txt`. A mismatch means the file is corrupted or
tampered with; do not install it.

## Install

1. Run the installer. Windows may show **"Windows protected your PC"** because the build
   is unsigned. This is expected. Confirm the publisher is shown as unverified and that
   you obtained the file directly from the owner.
2. Choose the install location. Business data is stored in the Windows user data
   directory, not inside the installation folder, so uninstalling or upgrading does not
   delete it.
3. Finish the wizard. Desktop and Start Menu shortcuts use the custom MERQO icon.

Do not disable Windows Defender, SmartScreen or antivirus. If your organisation blocks
unsigned executables, ask the owner for its internal deployment policy rather than using
a security bypass.

## First run

1. Launch MERQO. The offline activation screen appears.
2. Import the `.merqolic` licence file issued by MERQO. No online activation or
   subscription check occurs.
3. Complete business setup (name, address, currency BDT ৳, fiscal/date settings) and
   create the first owner/admin account.
4. Log in. The dashboard opens with real (initially empty) database figures.

## Upgrade, backup and uninstall

* Take a manual backup before upgrading (`সিস্টেম → ব্যাকআপ`).
* The installer supports upgrade; user data remains in the user data directory.
* Use Windows "Apps & features" / the provided uninstaller to remove the application.
  Remove the data directory manually only if the business intentionally wants to delete
  all local records.

## Unsigned status

MERQO is intentionally distributed without a paid code-signing certificate. Windows
SmartScreen behaviour varies with file reputation, distribution method and system policy.
No trusted-publisher or "Microsoft verified" claim is made.

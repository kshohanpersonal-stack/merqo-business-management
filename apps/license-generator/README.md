# MERQO Licence Generator (OWNER ONLY)

**This tool must never be committed as an executable or shipped as a public release
asset.** Private signing keys are read at runtime from an owner-controlled path outside
the repository.

## Setup (owner's secure machine only)

```bash
node apps/license-generator/src/index.ts init-key --out "C:/secure/merqo-ed25519-private.pem"
```

`init-key` prints the matching public key. The public key belongs in
`src/core/licensing.ts` (`MERQO_PUBLIC_KEY_PEM`) and must be committed; the private key
must not.

## Commands

```bash
# Requires the customer's offline device-info JSON produced by the activation screen
node apps/license-generator/src/index.ts issue \
  --private-key "C:/secure/merqo-ed25519-private.pem" \
  --business-name "মেসার্স রহিম ট্রেডার্স" \
  --business-info "ঢাকা, বাংলাদেশ" \
  --device-info device-info.json \
  --out license.merqolic

node apps/license-generator/src/index.ts verify --license license.merqolic
node apps/license-generator/src/index.ts list
```

Records are stored in the owner's private local store outside the repository. The
generated EXE is produced by `npm run build:generator` on the Windows CI runner and
uploaded as a protected artifact only.

#!/usr/bin/env python3
"""Fail if secrets, private keys, customer data or owner-only binaries are tracked."""
from __future__ import annotations
import re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
tracked = subprocess.check_output(['git', 'ls-files'], cwd=ROOT, text=True).splitlines()
BANNED_SUFFIX = ('.pem', '.key', '.p12', '.pfx', '.sqlite', '.db', '.merqobak', '.exe', '.msi')
BANNED_NAMES = {'license-private-key.json', 'license-generator-records.json', '.env'}
PATTERNS = [
    (re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'), 'private key block'),
    (re.compile(r'PRIVATE_SIGNING_KEY\s*=\s*["\'][^"\']{20,}'), 'hardcoded signing secret'),
    (re.compile(r'(?:ghp_|github_pat_|sk_live_|AKIA)[A-Za-z0-9_]{16,}'), 'access token'),
]
problems = []
for rel in tracked:
    p = ROOT / rel
    if p.suffix.lower() in BANNED_SUFFIX and not rel.startswith('assets/fonts/'):
        problems.append(f'{rel}: forbidden file type')
    if p.name in BANNED_NAMES:
        problems.append(f'{rel}: forbidden filename')
    if not p.is_file() or p.stat().st_size > 2_000_000:
        continue
    try:
        text = p.read_text(encoding='utf-8')
    except (UnicodeDecodeError, OSError):
        continue
    for pattern, label in PATTERNS:
        if pattern.search(text):
            problems.append(f'{rel}: {label}')
if problems:
    print('SECRET SCAN FAILED:')
    for x in problems: print(' -', x)
    sys.exit(1)
print(f'SECRET SCAN PASSED: {len(tracked)} tracked files inspected, no secrets found.')

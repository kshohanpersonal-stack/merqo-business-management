#!/usr/bin/env python3
"""Generate the master checklist from the canonical requirement register.

Usage: python3 scripts/dev/generate_requirements.py
Reads : scripts/dev/requirements_data.py, docs/requirement-overrides.json
Writes: docs/requirements.json, docs/MASTER_REQUIREMENT_CHECKLIST.md
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "dev"))
from requirements_data import GROUPS, VERIFICATION_STEPS  # noqa: E402

STATUS_ORDER = [
    "NOT STARTED", "PLANNED", "IN PROGRESS", "IMPLEMENTED", "TESTING",
    "PASSED", "FAILED", "BLOCKED",
]


def main() -> None:
    overrides_path = ROOT / "docs" / "requirement-overrides.json"
    overrides = json.loads(overrides_path.read_text(encoding="utf-8")) if overrides_path.exists() else {}
    requirements = []
    for part, titles in GROUPS.items():
        for i, title in enumerate(titles, start=1):
            rid = f"R-{part}-{i:03d}"
            ov = overrides.get(rid, {})
            flags = {s: False for s in VERIFICATION_STEPS}
            for k, v in (ov.get("verification") or {}).items():
                if k in flags:
                    flags[k] = bool(v)
            requirements.append({
                "id": rid,
                "part": part,
                "title": title,
                "priority": ov.get("priority", "MUST"),
                "status": ov.get("status", "NOT STARTED"),
                "code": ov.get("code", []),
                "tests": ov.get("tests", []),
                "notes": ov.get("notes", ""),
                "verification": flags,
            })

    payload = {
        "product": "MERQO Business Management & POS",
        "version": (ROOT / "VERSION").read_text(encoding="utf-8").strip() if (ROOT / "VERSION").exists() else "0.0.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "statuses": STATUS_ORDER,
        "verificationSteps": VERIFICATION_STEPS,
        "requirements": requirements,
    }
    (ROOT / "docs" / "requirements.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    counts = {s: sum(1 for r in requirements if r["status"] == s) for s in STATUS_ORDER}
    lines = [
        "# MERQO — Master Requirement Checklist",
        "",
        f"Generated: {payload['generatedAt']} · Version: {payload['version']} · Source: `docs/requirements.json`",
        "",
        "Statuses: " + ", ".join(f"`{s}`" for s in STATUS_ORDER) + ".",
        "",
        "A requirement may only be `PASSED` when all eleven verification steps are true and the referenced tests were actually executed. "
        "Generated docs never claim a test result; run the generator only after updating `docs/requirement-overrides.json` from real evidence.",
        "",
        "| Status | Count |",
        "| --- | ---: |",
    ]
    lines += [f"| {s} | {counts[s]} |" for s in STATUS_ORDER]
    lines += [f"| **TOTAL** | **{len(requirements)}** |", ""]

    for part, titles in GROUPS.items():
        lines += [f"## {part}", "", "| ID | Requirement | Status | Code | Tests | Verified steps | Notes |",
                  "| --- | --- | --- | --- | --- | ---: | --- |"]
        for r in [x for x in requirements if x["part"] == part]:
            done = sum(1 for v in r["verification"].values() if v)
            code = ", ".join(f"`{c}`" for c in r["code"]) or "—"
            tests = ", ".join(f"`{t}`" for t in r["tests"]) or "—"
            notes = r["notes"].replace("|", "\\|") or "—"
            lines.append(f"| {r['id']} | {r['title']} | **{r['status']}** | {code} | {tests} | {done}/11 | {notes} |")
        lines.append("")

    (ROOT / "docs" / "MASTER_REQUIREMENT_CHECKLIST.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {len(requirements)} requirements; status counts: {counts}")


if __name__ == "__main__":
    main()

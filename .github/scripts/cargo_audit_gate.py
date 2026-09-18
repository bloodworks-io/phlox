import json
import sys

if len(sys.argv) != 2:
    sys.exit("usage: python cargo_audit_gate.py <cargo-audit-json>")

with open(sys.argv[1]) as f:
    report = json.load(f)

failing = 0
blocked = 0

for finding in report.get("vulnerabilities", {}).get("list", []):
    advisory = finding.get("advisory", {})
    package = finding.get("package", {})
    patched = (finding.get("versions") or {}).get("patched") or []
    label = f"{package.get('name')}@{package.get('version')} ({advisory.get('id')})"
    if patched:
        print(f"::error::cargo {label} - patched in {', '.join(patched)}")
        failing += 1
    else:
        print(f"::warning::cargo {label} - no patched version yet")
        blocked += 1

for kind in ("unmaintained", "unsound", "yanked", "vulnerabilities"):
    for item in report.get("warnings", {}).get(kind, []):
        advisory = item.get("advisory", {})
        package = item.get("package", {})
        name = package.get("name") or advisory.get("package")
        label = f"{name} ({advisory.get('id') or 'yanked'})"
        print(f"::warning::cargo {kind}: {label}")

print(
    f"cargo audit: {failing + blocked} vulnerability finding(s), "
    f"{failing} actionable, {blocked} waiting on upstream"
)
sys.exit(1 if failing else 0)

import json
import sys

if len(sys.argv) != 2:
    sys.exit("usage: python pip_audit_gate.py <pip-audit-json>")

with open(sys.argv[1]) as f:
    report = json.load(f)

dependencies = report["dependencies"] if isinstance(report, dict) else report

failing = 0
blocked = 0

for dep in dependencies:
    for vuln in dep.get("vulns") or []:
        aliases = ", ".join(vuln.get("aliases") or [])
        label = (
            f"{dep['name']}=={dep['version']} ({vuln['id']}"
            f"{'; ' + aliases if aliases else ''})"
        )
        fix_versions = vuln.get("fix_versions") or []
        if fix_versions:
            print(f"::error::pip {label} - fix available in {', '.join(fix_versions)}")
            failing += 1
        else:
            print(f"::warning::pip {label} - no fix available yet")
            blocked += 1

print(
    f"pip audit: {failing + blocked} finding(s), "
    f"{failing} actionable, {blocked} waiting on upstream"
)
sys.exit(1 if failing else 0)

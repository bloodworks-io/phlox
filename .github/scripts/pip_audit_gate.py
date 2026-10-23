import json
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

COOLDOWN = timedelta(days=3)
_pypi_cache = {}


def publish_time(name, version):
    key = (name, version)
    if key not in _pypi_cache:
        url = f"https://pypi.org/pypi/{name}/{version}/json"
        req = urllib.request.Request(url, headers={"User-Agent": "phlox-audit-gate"})
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.load(res)
        _pypi_cache[key] = data["urls"][0]["upload_time"] if data.get("urls") else None
    return _pypi_cache[key]


def fixes_in_cooldown(name, fix_versions):
    times = []
    for version in fix_versions:
        stamp = publish_time(name, version)
        if stamp is None:
            return False
        times.append(datetime.fromisoformat(stamp).replace(tzinfo=timezone.utc))
    cutoff = datetime.now(timezone.utc) - COOLDOWN
    return all(t > cutoff for t in times)


def main():
    if len(sys.argv) != 2:
        print("usage: python pip_audit_gate.py <pip-audit-json>")
        return 2

    try:
        with open(sys.argv[1]) as f:
            report = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"::error::pip audit report missing or invalid - did pip-audit run? ({e})")
        return 1

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
                try:
                    cooldown = fixes_in_cooldown(dep["name"], fix_versions)
                except (OSError, ValueError, KeyError):
                    cooldown = False
                if cooldown:
                    print(
                        f"::warning::pip {label} - fix still in release cooldown "
                        f"({', '.join(fix_versions)})"
                    )
                    blocked += 1
                else:
                    print(f"::error::pip {label} - fix available in {', '.join(fix_versions)}")
                    failing += 1
            else:
                print(f"::warning::pip {label} - no fix available yet")
                blocked += 1

    print(
        f"pip audit: {failing + blocked} finding(s), "
        f"{failing} actionable, {blocked} waiting on upstream"
    )
    return 1 if failing else 0


if __name__ == "__main__":
    sys.exit(main())

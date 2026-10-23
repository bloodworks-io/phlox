import json
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

COOLDOWN = timedelta(days=3)
CVSS_CRITICAL = 9.0
_pypi_cache = {}
_advisory_cache = {}


def publish_time(name, version):
    key = (name, version)
    if key not in _pypi_cache:
        url = f"https://pypi.org/pypi/{name}/{version}/json"
        req = urllib.request.Request(url, headers={"User-Agent": "phlox-audit-gate"})
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.load(res)
        _pypi_cache[key] = data["urls"][0]["upload_time"] if data.get("urls") else None
    return _pypi_cache[key]


def advisory_severity(ghsa_id):
    if ghsa_id not in _advisory_cache:
        url = f"https://api.github.com/advisories/{ghsa_id}"
        req = urllib.request.Request(
            url, headers={"Accept": "application/vnd.github+json", "User-Agent": "phlox-audit-gate"}
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            _advisory_cache[ghsa_id] = json.load(res)
    advisory = _advisory_cache[ghsa_id]
    score = (advisory.get("cvss_severities") or {}).get("cvss_v4", {}).get("score") or (
        advisory.get("cvss") or {}
    ).get("score")
    return advisory.get("severity"), score


def fixes_in_cooldown(name, fix_versions):
    times = []
    for version in fix_versions:
        stamp = publish_time(name, version)
        if stamp is None:
            return False
        times.append(datetime.fromisoformat(stamp).replace(tzinfo=timezone.utc))
    cutoff = datetime.now(timezone.utc) - COOLDOWN
    return all(t > cutoff for t in times)


def is_critical(severity, score):
    return (score is not None and score >= CVSS_CRITICAL) or (severity or "").lower() == "critical"


def severity_suffix(severity, score):
    parts = []
    if severity:
        parts.append(severity)
    if score is not None:
        parts.append(f"cvss {score}")
    return f" [{', '.join(parts)}]" if parts else ""


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
                severity, score = None, None
                ghsa = next(
                    (
                        a
                        for a in [vuln["id"], *(vuln.get("aliases") or [])]
                        if a.startswith("GHSA-")
                    ),
                    None,
                )
                if ghsa:
                    try:
                        severity, score = advisory_severity(ghsa)
                    except (OSError, ValueError, KeyError):
                        severity, score = None, None
                if cooldown and is_critical(severity, score):
                    print(
                        f"::error::pip {label} - fix in cooldown but severity critical"
                        f"{severity_suffix(severity, score)} - update now despite cooldown"
                    )
                    failing += 1
                elif cooldown:
                    print(
                        f"::warning::pip {label} - fix still in release cooldown "
                        f"({', '.join(fix_versions)}){severity_suffix(severity, score)}"
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

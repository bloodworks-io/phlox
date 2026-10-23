import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

COOLDOWN = timedelta(days=3)
CVSS_CRITICAL = 9.0
_crates_cache = {}
_advisory_cache = {}


def publish_time(crate, version):
    key = (crate, version)
    if key not in _crates_cache:
        url = f"https://crates.io/api/v1/crates/{crate}/{version}"
        req = urllib.request.Request(url, headers={"User-Agent": "phlox-audit-gate"})
        with urllib.request.urlopen(req, timeout=30) as res:
            data = json.load(res)
        _crates_cache[key] = data.get("version", {}).get("created_at")
    return _crates_cache[key]


def github_severity(ghsa_id):
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


def osv_severity(vuln_id):
    url = f"https://api.osv.dev/v1/vulns/{vuln_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "phlox-audit-gate"})
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.load(res)
    return (data.get("database_specific") or {}).get("severity"), None


def advisory_severity(vuln_id, aliases):
    ghsa = next((a for a in aliases if a.startswith("GHSA-")), None)
    if ghsa:
        return github_severity(ghsa)
    return osv_severity(vuln_id)


def base_versions(patched):
    bases = []
    for entry in patched:
        for match in re.finditer(r">=\s*v?([0-9][0-9A-Za-z.\-+]*)", entry):
            bases.append(match.group(1))
    return bases


def fixes_in_cooldown(crate, patched):
    bases = base_versions(patched)
    if not bases:
        return False
    times = []
    for version in bases:
        stamp = publish_time(crate, version)
        if stamp is None:
            return False
        times.append(datetime.fromisoformat(stamp.replace("Z", "+00:00")))
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
        print("usage: python cargo_audit_gate.py <cargo-audit-json>")
        return 2

    try:
        with open(sys.argv[1]) as f:
            report = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"::error::cargo audit report missing or invalid - did cargo audit run? ({e})")
        return 1

    failing = 0
    blocked = 0

    for finding in report.get("vulnerabilities", {}).get("list", []):
        advisory = finding.get("advisory") or {}
        package = finding.get("package") or {}
        patched = (finding.get("versions") or {}).get("patched") or []
        label = f"{package.get('name')}@{package.get('version')} ({advisory.get('id')})"
        if patched:
            try:
                cooldown = fixes_in_cooldown(package.get("name"), patched)
            except (OSError, ValueError):
                cooldown = False
            severity, score = None, None
            if cooldown:
                try:
                    severity, score = advisory_severity(
                        advisory.get("id"), advisory.get("aliases") or []
                    )
                except (OSError, ValueError, KeyError):
                    severity, score = None, None
            if cooldown and is_critical(severity, score):
                print(
                    f"::error::cargo {label} - fix in cooldown but severity critical"
                    f"{severity_suffix(severity, score)} - update now despite cooldown"
                )
                failing += 1
            elif cooldown:
                print(
                    f"::warning::cargo {label} - fix still in release cooldown "
                    f"({', '.join(patched)}){severity_suffix(severity, score)}"
                )
                blocked += 1
            else:
                print(f"::error::cargo {label} - patched in {', '.join(patched)}")
                failing += 1
        else:
            print(f"::warning::cargo {label} - no patched version yet")
            blocked += 1

    for kind in ("unmaintained", "unsound", "yanked", "vulnerabilities"):
        for item in report.get("warnings", {}).get(kind, []):
            advisory = item.get("advisory") or {}
            package = item.get("package") or {}
            name = package.get("name") or advisory.get("package") or "unknown"
            label = f"{name} ({advisory.get('id') or 'yanked'})"
            print(f"::warning::cargo {kind}: {label}")

    print(
        f"cargo audit: {failing + blocked} vulnerability finding(s), "
        f"{failing} actionable, {blocked} waiting on upstream"
    )
    return 1 if failing else 0


if __name__ == "__main__":
    sys.exit(main())

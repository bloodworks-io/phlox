import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node npm_audit_gate.mjs <npm-audit-json>");
  process.exit(2);
}

const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const CVSS_CRITICAL = 9;

let report;
try {
  report = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.log(`::error::npm audit report missing or invalid - did npm audit run? (${e})`);
  process.exit(1);
}
const vulnerabilities = Object.values(report.vulnerabilities ?? {});

const packumentCache = new Map();
const advisoryCache = new Map();

async function fetchAdvisory(advisoryId) {
  if (!advisoryCache.has(advisoryId)) {
    const res = await fetch(`https://api.github.com/advisories/${advisoryId}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`advisory ${res.status} for ${advisoryId}`);
    advisoryCache.set(advisoryId, await res.json());
  }
  return advisoryCache.get(advisoryId);
}

async function publishTime(name, version) {
  if (!packumentCache.has(name)) {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`registry ${res.status} for ${name}`);
    packumentCache.set(name, await res.json());
  }
  const time = packumentCache.get(name).time?.[version];
  return time ? new Date(time).getTime() : null;
}

async function evaluateFix(name, via) {
  const advisories = (via ?? []).filter(
    (v) => typeof v === "object" && v.url?.startsWith("https://github.com/advisories/"),
  );
  if (advisories.length === 0) return { cooldown: false, severity: null, score: null };
  const entries = [];
  for (const adv of advisories) {
    const advisory = await fetchAdvisory(adv.url.split("/").pop());
    for (const v of advisory.vulnerabilities ?? []) {
      if (v.package?.name !== name || !v.first_patched_version) continue;
      entries.push({
        version: v.first_patched_version,
        severity: advisory.severity ?? null,
        score: advisory.cvss_severities?.cvss_v4?.score ?? advisory.cvss?.score ?? null,
      });
    }
  }
  if (entries.length === 0) return { cooldown: false, severity: null, score: null };
  const times = [];
  for (const entry of entries) {
    const t = await publishTime(name, entry.version);
    if (t === null) return { cooldown: false, severity: null, score: null };
    times.push(t);
  }
  const worst = entries.reduce((a, b) => ((b.score ?? -1) > (a.score ?? -1) ? b : a));
  return {
    cooldown: times.every((t) => Date.now() - t < COOLDOWN_MS),
    severity: worst.severity,
    score: worst.score,
  };
}

function isCritical(severity, score) {
  return (typeof score === "number" && score >= CVSS_CRITICAL) || severity === "critical";
}

function severitySuffix(severity, score) {
  const parts = [];
  if (severity) parts.push(severity);
  if (typeof score === "number") parts.push(`cvss ${score}`);
  return parts.length ? ` [${parts.join(", ")}]` : "";
}

async function main() {
  let failing = 0;
  let blocked = 0;

  for (const vuln of vulnerabilities) {
    const ids = (vuln.via ?? [])
      .filter((v) => typeof v === "object")
      .map((v) => (v.url ?? "").replace("https://github.com/advisories/", "") || v.title)
      .join(", ");
    const label = `${vuln.name} (${vuln.severity})${ids ? ` ${ids}` : ""}`;
    const fix = vuln.fixAvailable;

    if (fix === true) {
      let result;
      try {
        result = await evaluateFix(vuln.name, vuln.via);
      } catch {
        result = { cooldown: false, severity: null, score: null };
      }
      if (result.cooldown && isCritical(result.severity, result.score)) {
        console.log(
          `::error::npm ${label} - fix in cooldown but severity critical${severitySuffix(result.severity, result.score)} - update now despite cooldown`,
        );
        failing++;
      } else if (result.cooldown) {
        console.log(
          `::warning::npm ${label} - fix still in release cooldown (min-release-age)${severitySuffix(result.severity, result.score)}`,
        );
        blocked++;
      } else {
        console.log(`::error::npm ${label} - fix available via \`npm audit fix\``);
        failing++;
      }
    } else if (fix && typeof fix === "object") {
      console.log(
        `::warning::npm ${label} - fix requires major bump of ${fix.name} to ${fix.version}`,
      );
      blocked++;
    } else {
      console.log(`::warning::npm ${label} - no fix available yet`);
      blocked++;
    }
  }

  console.log(
    `npm audit: ${vulnerabilities.length} finding(s), ${failing} actionable, ${blocked} waiting on upstream`,
  );
  process.exit(failing > 0 ? 1 : 0);
}

await main();

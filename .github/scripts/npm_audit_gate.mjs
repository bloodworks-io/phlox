import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node npm_audit_gate.mjs <npm-audit-json>");
  process.exit(2);
}

const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

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

async function publishTime(name, version) {
  if (!packumentCache.has(name)) {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`registry ${res.status} for ${name}`);
    packumentCache.set(name, await res.json());
  }
  const time = packumentCache.get(name).time?.[version];
  return time ? new Date(time).getTime() : null;
}

async function firstPatchedVersions(name, advisoryUrl) {
  const advisoryId = advisoryUrl.split("/").pop();
  if (!advisoryCache.has(advisoryId)) {
    const res = await fetch(`https://api.github.com/advisories/${advisoryId}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`advisory ${res.status} for ${advisoryId}`);
    advisoryCache.set(advisoryId, await res.json());
  }
  const advisory = advisoryCache.get(advisoryId);
  return (advisory.vulnerabilities ?? [])
    .filter((v) => v.package?.name === name)
    .map((v) => v.first_patched_version)
    .filter(Boolean);
}

async function fixInCooldown(name, via) {
  const advisories = (via ?? []).filter(
    (v) => typeof v === "object" && v.url?.startsWith("https://github.com/advisories/"),
  );
  if (advisories.length === 0) return false;
  const times = [];
  for (const adv of advisories) {
    for (const version of await firstPatchedVersions(name, adv.url)) {
      const t = await publishTime(name, version);
      if (t === null) return false;
      times.push(t);
    }
  }
  if (times.length === 0) return false;
  return times.every((t) => Date.now() - t < COOLDOWN_MS);
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
      let cooldown;
      try {
        cooldown = await fixInCooldown(vuln.name, vuln.via);
      } catch {
        cooldown = false;
      }
      if (cooldown) {
        console.log(`::warning::npm ${label} - fix still in release cooldown (min-release-age)`);
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

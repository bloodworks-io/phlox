import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node npm_audit_gate.mjs <npm-audit-json>");
  process.exit(2);
}

let report;
try {
  report = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.log(`::error::npm audit report missing or invalid - did npm audit run? (${e})`);
  process.exit(1);
}
const vulnerabilities = Object.values(report.vulnerabilities ?? {});

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
    console.log(`::error::npm ${label} - fix available via \`npm audit fix\``);
    failing++;
  } else if (fix && typeof fix === "object") {
    console.log(
      `::warning::npm ${label} - fix requires major bump of ${fix.name} to ${fix.version}`
    );
    blocked++;
  } else {
    console.log(`::warning::npm ${label} - no fix available yet`);
    blocked++;
  }
}

console.log(
  `npm audit: ${vulnerabilities.length} finding(s), ${failing} actionable, ${blocked} waiting on upstream`
);
process.exit(failing > 0 ? 1 : 0);

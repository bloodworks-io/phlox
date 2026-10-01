# Release Process

This document describes how Phlox releases are built, verified, and published, and which repository settings protect that process. Publishing a release is a **two-step manual sign-off**: you merge the release PR (sign-off on *content*), and you publish the draft release (sign-off on *evidence*).

## Release flow

```
conventional commits on main
  → release-please opens/updates a release PR
  → maintainer merges the release PR          (sign-off #1: content)
  → release-please creates a DRAFT release (the git tag only materializes at publish)
    and dispatches "Build and Release" on main, passing the release tag:
      macOS:   build → sign → notarize → VERIFY (fail-hard) → upload
      Windows: build → signature check (warn-only) → upload
      Linux:   flatpak build → upload
      release-evidence job: download artifacts → SHASUMS256.txt + manifest.json
                            → attach everything to the DRAFT release
  → maintainer reviews the draft release      (sign-off #2: evidence)
  → maintainer clicks "Publish release"       (this creates the v* tag)
  → notify-website workflow fires on release.published
```

## What CI verifies automatically

| Platform | Artifact | SHA-256 | Signature gate |
| --- | --- | --- | --- |
| macOS | `.dmg` | ✅ in `SHASUMS256.txt` | ✅ **fail-hard**: `codesign --verify --deep --strict`, `spctl --assess`, `xcrun stapler validate` |
| Windows | `-setup.exe` | ✅ in `SHASUMS256.txt` | ⚠️ warn-only: `Get-AuthenticodeSignature` status recorded in `manifest.json` (installer is not Authenticode-signed yet) |
| Linux | `.flatpak` | ✅ in `SHASUMS256.txt` | none — digest only |

If the macOS gate fails, the workflow fails and nothing is attached to the release. The release-evidence job only runs when all three platform builds succeed, and it fails if any expected artifact is missing.

## Reviewer checklist before publishing the draft

1. All expected assets are attached: `.dmg`, `-setup.exe`, `.flatpak`, `SHASUMS256.txt`, `manifest.json`.
2. The macOS job's verification step is green (codesign + Gatekeeper + stapler).
3. `manifest.json` shows the expected tag/commit, and `windows_authenticode` status is acceptable (currently `NotSigned`).
4. Spot-check one digest: `shasum -a 256 -c SHASUMS256.txt` against a downloaded asset.
5. Publishing is the point of no return — see "Immutability" below.

## Manual runs and recovery

- **Dry run** (gates only, nothing attached): Actions → *Build and Release* → *Run workflow* → any branch, leave `tag` empty.
- **Populate or re-run a draft**: Actions → *Build and Release* → *Run workflow* → branch `main`, set `tag` to the draft's version (e.g. `v2.5.0`). Artifacts and evidence attach to the existing draft. This is also the recovery path if the release-please dispatch ever fails to fire.
- Git-pushed `v*` tags still trigger the full flow.

## Immutability

Artifacts are only ever attached to the **draft** release, so CI never publishes; re-running the workflow replaces assets on the draft only. Once published, a release can never be edited: **cut a new version instead**.

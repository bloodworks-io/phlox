# Clinical Folio Phase 1 — Theme Foundation

**Date:** 26 October 2026  
**Status:** Complete  
**Migration target:** Clinical Folio in `design-portfolio.html`  
**Phase 0 baseline:** `CLINICAL_FOLIO_PHASE_0_BASELINE.md`  
**Production scope:** Foundation only; no broad component conversion

## Objective

Phase 1 establishes the Clinical Folio foundation while preserving existing workflows and keeping most product surfaces visually close to the Phase 0 baseline.

Completed objectives:

1. Repaired the existing frontend lint/typecheck blockers.
2. Added canonical Folio semantic tokens with compatibility aliases.
3. Self-hosted Public Sans and Source Serif 4.
4. Added separate body, heading, and display typography roles.
5. Implemented persisted system/light/dark behavior.
6. Restored the saved theme before the first visible application frame.
7. Coordinated browser metadata, root color scheme, and native Tauri appearance.
8. Applied Folio only to the root, boot surfaces, and minimal sidebar background.
9. Preserved generated PDF output and clinical workflows.

`.gitignore` was not modified during Phase 1.

---

## 1. Frontend blocker repairs

### `src/components/modals/CompanionImportModal.jsx`

Removed the manual `useMemo` around session day grouping. React Compiler could not preserve the existing memoization, and the grouping is inexpensive enough for compiler-managed rendering.

No behavior, state, or callback changes were made.

### `src/pages/PatientDetails.tsx`

Changed `handleSavePatientData` to accept an optional form event:

```tsx
async (e?: FormEvent) => {
    e?.preventDefault();
    ...
}
```

This preserves form submission while allowing the ungenerated-note generation flow to call the saver without fabricating an event.

### `src/utils/api/companionApi.ts`

Added a narrow import options type:

```ts
type ImportBatchOptions = {
    generate?: boolean;
    templateKey?: string;
};
```

The API method now accepts `string[]` session IDs and the explicit options type. No broad response casts or `any` were introduced.

---

## 2. Canonical Folio semantic tokens

### `src/theme/colors.jsx`

Clinical Folio roles are registered under a `folio.*` namespace:

- `folio.canvas`
- `folio.paper`
- `folio.paperAlt`
- `folio.sidebar`
- `folio.sidebarAlt`
- `folio.sidebarInk`
- `folio.sidebarMuted`
- `folio.ink`
- `folio.muted`
- `folio.faint`
- `folio.line`
- `folio.accent`
- `folio.accentInk`
- `folio.accentSoft`
- `folio.brand`
- `folio.brandOnSidebar`
- `folio.brandInk`
- `folio.badgeInk`
- `folio.success`
- `folio.successSoft`
- `folio.danger`
- `folio.warning`
- `folio.info`
- `folio.selection`
- `folio.selectionInk`
- `folio.hover`
- `folio.focus`

The exact light/dark values come from `.theme-folio-light` and `.theme-folio-dark` in `design-portfolio.html`.

### Why the tokens are namespaced

The existing top-level `accent` and `brand` tokens have many live consumers. Replacing those values in Phase 1 would broadly recolor focus, agent, artifact, upload, auth, and scribe surfaces before their meanings are classified.

The legacy palette remains unchanged as a compatibility layer. Existing top-level `accent` and `brand` values are intentionally preserved.

A concrete `folioColors.light` / `folioColors.dark` view is exported for future SVG, canvas, and other genuinely non-CSS consumers.

### Shadows and radii

`src/theme/index.jsx` registers:

```txt
shadows.overlay
  light: 0 12px 32px rgba(58, 42, 25, 0.08)
  dark:  0 16px 36px rgba(0, 0, 0, 0.28)

radii.folioControl = 4px
radii.folioPanel   = 7px
radii.folioOverlay = 10px
```

The single Chakra system and provider architecture is unchanged.

### Token tests

`src/theme/colors.spec.jsx` verifies:

- All exact Folio light/dark values.
- Concrete Folio values for non-CSS consumers.
- Legacy top-level `accent` remains the old teal.
- Legacy top-level `brand` remains the old orange.
- Legacy sidebar values remain unchanged.
- Overlay shadow and radius tokens.

---

## 3. Typography foundation

### Self-hosted fonts

Added:

- `@fontsource/public-sans@5.3.0`
- `@fontsource/source-serif-4@5.3.1`

Imported weights:

- Public Sans 400
- Public Sans 500
- Public Sans 600
- Public Sans 700
- Source Serif 4 500

No Google Fonts requests are used in production.

The existing Roboto and Space Grotesk packages remain temporarily because multiple components still hard-code those families. They are compatibility assets until Phase 2 migrates their call sites by meaning.

### Roles

`src/theme/typography.jsx` now exposes:

```txt
body    = Public Sans
heading = Public Sans
display = Source Serif 4
```

Normal `h1`–`h7` styles remain Public Sans. `fontFamily="heading"` consumers therefore remain sans-serif.

Source Serif 4 is registered only as a separate display role. It is not applied to any product component in Phase 1.

### Minimal central application

`src/theme/styles/base.jsx` uses:

- `folio.canvas` for the body background.
- `folio.ink` for body text.
- The `body` font role for body and paragraph text.

Clinical line heights and tabular numerals are preserved.

---

## 4. Effective theme behavior

### First-paint boot

Added `public/theme-boot.js` and loaded it synchronously from `index.html`.

Before the application module renders, it:

1. Reads the `next-themes` storage key (`theme`).
2. Normalizes the preference to `light`, `dark`, or `system`.
3. Resolves `system` through `prefers-color-scheme`.
4. Applies the effective class to `<html>`.
5. Sets:
   - `root.style.colorScheme`
   - `root.dataset.themePreference`
   - `root.dataset.effectiveTheme`
   - Root background
6. Updates `meta[name="theme-color"]`.

`src/index.jsx` no longer deletes the saved theme or forces the OS preference on every load.

### Pre-JS CSS fallback

`src/index.css` provides Folio canvas and `color-scheme` fallbacks for:

- Light.
- Dark.
- System dark when no explicit light class exists.

This prevents a white or old-navy first paint.

### Color-mode API

`src/components/ui/color-mode.tsx` keeps the existing `next-themes` architecture and adds:

```ts
type ThemePreference = "light" | "dark" | "system";

useThemePreference();
setThemePreference();
```

Existing `useColorMode`, `toggleColorMode`, and `useColorModeValue` APIs remain available.

An internal effective-theme coordinator synchronizes:

- Root class.
- Root `color-scheme`.
- Preference/effective-theme datasets.
- Browser theme metadata.
- Native Tauri appearance when running in Tauri.

While `system` is selected, live OS changes update the effective theme. Explicit light/dark choices remain stable across OS changes and reload.

### Sidebar system control

`VersionInfo.jsx` adds a compact “Use system appearance” control beside the existing light/dark toggle in both expanded and collapsed sidebar states.

The control:

- Is a real button.
- Has a localized accessible name.
- Exposes `aria-pressed`.
- Has visible focus.
- Persists the `system` preference.

The existing light/dark toggle and its API are unchanged.

### Browser theme coverage

Added `tests/browser/scenarios/theme.spec.ts`.

It covers, in Chromium and WebKit light/dark projects:

- System default behavior.
- Explicit light under dark system.
- Explicit dark under light system.
- Reload persistence.
- Live OS theme changes.
- Manual override stability.
- Returning to system through the sidebar control.
- Root class, color scheme, datasets, and browser metadata.
- Same-origin font loading only.

---

## 5. Native startup coordination

### Window startup

`src-tauri/tauri.conf.json` now starts the main window hidden:

```json
"visible": false
```

The window is revealed only after the frontend has restored the effective theme and synchronized native appearance.

An explicit `"theme": "system"` field was initially tried, but Tauri’s schema rejected it. It was removed because system is already the default behavior.

### Native commands

`src-tauri/src/main.rs` adds:

- `set_window_appearance`
- `reveal_main_window`

`set_window_appearance` receives:

- Preference: `light`, `dark`, or `system`.
- Effective theme: `light` or `dark`.

It:

- Calls Tauri’s native theme API.
- Uses `None` for system preference so the app continues following the OS.
- Uses an explicit theme for manual overrides.
- On macOS, updates the `NSWindow` background to the Folio sidebar color:
  - Light effective: `#272A24`
  - Dark effective: `#1C201B`

`reveal_main_window` is idempotent and uses an atomic reveal guard.

A three-second native fallback reveals the window if frontend startup fails before it can report a theme.

### Preserved native behavior

- macOS traffic-light positioning is unchanged.
- macOS resize/fullscreen observers are unchanged.
- Drag regions are unchanged.
- Windows and GNOME native controls are not replaced with HTML.
- Existing window size, CSP, and drag/drop configuration are preserved.

### macOS smoke result

A full `npm run tauri-dev` run exposed and corrected the invalid explicit theme field.

After the fix, direct `npx tauri dev`:

- Compiled the Rust application.
- Started Vite.
- Launched the native app.
- Reached the encryption/passphrase gate.
- Started the bundled Python server.
- Cleaned up managed processes when the bounded smoke test ended.

No native appearance/reveal command errors were logged.

Windows and GNOME native frames were not manually available in this environment.

---

## 6. Minimal root, boot, and sidebar application

### Root and main shell

- Body and `.main-bg` now use `folio.canvas`.
- Root fallback styles use the Folio light/dark canvases.
- Root `color-scheme` is mode-aware.

### Boot surfaces

`src/theme/styles/panel.jsx` converts only:

- `.splash-bg`
- `.splash-panel`

`.splash-bg` now uses `folio.canvas`. The old aurora gradient, dotted mask, and `phloxAuroraDrift` keyframes were removed.

`.splash-panel` now uses:

- `folio.paper`
- `folio.ink`
- `folio.line`
- `folioOverlay` radius
- `overlay` shadow

This covers blank initialization, auth, setup, encryption, server startup, and splash onboarding.

`AuthGate.jsx` uses `folio.ink` for the login subtitle so the Folio boot card does not add a new axe color-contrast finding.

### Sidebar

`Sidebar.jsx` uses `folio.sidebar` for the web and Tauri sidebar background. The Tauri sidebar’s unconditional blur and navy gradient were removed.

Preserved:

- 220/80px sidebar widths.
- 236/96px Tauri content offsets.
- Tauri inset and radius.
- Drag regions.
- Traffic-light clearance.
- Small-screen overlay behavior.
- Child component behavior and geometry.

No sidebar child controls, buttons, patient rows, or badges were converted.

---

## 7. Browser baselines

The initial post-Phase-1 browser run produced five visual differences above the existing threshold.

They were inspected and confirmed as intentional foundation changes caused by:

- Public Sans text metrics.
- Folio root/boot canvas.
- Folio boot-card material.
- Warm sidebar coordination.
- The new sidebar system control.

Only these five baselines were regenerated:

1. `chromium-light/boot.spec.ts-boot-disclaimer.png`
2. `chromium-light/responsive.spec.ts-responsive-small-consultation.png`
3. `chromium-dark/boot.spec.ts-boot-disclaimer.png`
4. `webkit-light/boot.spec.ts-boot-disclaimer.png`
5. `webkit-dark/boot.spec.ts-boot-disclaimer.png`

No baseline was regenerated merely to make an unexpected regression pass.

---

## 8. Verification

| Gate | Result |
|---|---|
| `npm run lint` | Pass — 0 errors, 7 pre-existing warnings |
| `npm run typecheck` | Pass |
| `npx vitest run --coverage` | Pass — 59 files, 468 tests |
| `npm run build` | Pass |
| `npx vitest run src/utils/pdf/fillForm.invariance.spec.ts` | Pass |
| `npm run test:e2e` | Pass — 148 passed, 12 intentional responsive duplicates skipped |
| `cargo test --locked` | Pass — 35 tests |
| Direct `npx tauri dev` smoke | App launched and reached the passphrase gate; managed processes cleaned up |
| Production external font search | No `fonts.googleapis.com` or `fonts.gstatic.com` references |

Local Node is outside the project engine range, so the expected `EBADENGINE` warning remains. CI remains the authoritative Node 24 environment.

### Accessibility counts

Phase 1 preserves the Phase 0 axe baseline exactly:

| Project | Violation entries | Affected nodes |
|---|---:|---:|
| Chromium light | 43 | 164 |
| Chromium dark | 43 | 143 |
| WebKit light | 43 | 164 |
| WebKit dark | 43 | 143 |

No new violation type or increased count/severity was accepted.

### Generated PDF invariance

The focused generated-PDF invariance suite passes. The fixed template hash and repeated-fill equality contract remain unchanged.

No generated PDF font, black text, geometry, wrapping, checkbox behavior, or field layout was changed.

---

## 9. Explicit non-goals retained

Phase 1 did not broadly convert:

- Buttons.
- Inputs.
- Ordinary panels.
- Consultation note surfaces.
- Scribe visuals.
- Tool rail.
- Floating panels.
- Settings.
- Tables.
- Dialogs.
- PDF application surfaces.
- Icon families.
- Generated PDF output.

Legacy color and font consumers remain intentionally untouched until Phase 2 migrates them by meaning.

---

## 10. Phase 2 entry point

Phase 2 can begin with shared controls and the shell:

1. Shared button, input, dialog, popover, table, tab, and toast foundations.
2. Sidebar child controls and patient rows.
3. Root/shell typography cleanup.
4. Removal of hard-coded Roboto/Space Grotesk call sites as their surfaces convert.
5. Consumer-by-consumer migration from legacy aliases to canonical Folio roles.

Do not globally remap `surface`, top-level `accent`, or top-level `brand` until each consumer’s semantic meaning has been classified.

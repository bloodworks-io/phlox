import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Files whose shared styles were migrated to Folio in Phase 2 Slice 2.1.
// They must not reintroduce hard-coded Roboto or Space Grotesk families;
// the body role (Public Sans) is inherited instead.
const migratedSharedFiles = [
  "src/components/common/Toast.jsx",
  "src/components/common/Buttons.jsx",
  "src/components/common/ConfirmDialog.jsx",
  "src/components/common/ModelDownloadProgress.jsx",
  "src/components/common/ReEmbedProgress.jsx",
  "src/components/patient/PatientInfoBar.jsx",
  "src/components/patient/DemographicsForm.jsx",
  "src/components/patient/NewNoteStartCard.jsx",
  "src/components/modals/NewNoteModal.jsx",
  "src/components/patient/Summary.tsx",
  "src/components/patient/GroundedTextarea.tsx",
  "src/components/patient/AgentEditDiffMarker.tsx",
  "src/components/patient/UrSearchField.jsx",
  "src/theme/index.jsx",
  "src/theme/styles/input.jsx",
  "src/theme/styles/modal.jsx",
  "src/theme/styles/tab.jsx",
  "src/theme/styles/checkbox.jsx",
  "src/theme/styles/toggle.jsx",
  "src/theme/styles/modeSelector.jsx",
  "src/theme/styles/scrollbar.jsx",
  "src/theme/styles/patientInfo.jsx",
];

const here = path.dirname(fileURLToPath(import.meta.url));

describe("migrated shared styles", () => {
  it.each(migratedSharedFiles)("%s has no hard-coded legacy fonts", (rel) => {
    const source = readFileSync(path.resolve(here, "../..", rel), "utf8");
    expect(source).not.toMatch(/Roboto/);
    expect(source).not.toMatch(/Space Grotesk/);
  });

  it("keeps the Folio class styles inside the shared input files", () => {
    const inputStyles = readFileSync(
      path.resolve(here, "../../src/theme/styles/input.jsx"),
      "utf8",
    );
    for (const sharedClass of [
      ".textarea-style",
      ".chat-input",
      ".clinic-date-input",
      ".template-field-container",
      ".template-field-label",
      ".transcription-style",
      ".transcription-view",
    ]) {
      expect(inputStyles).toContain(sharedClass);
    }

    const patientStyles = readFileSync(
      path.resolve(here, "../../src/theme/styles/patientInfo.jsx"),
      "utf8",
    );
    expect(patientStyles).toContain(".input-style");
  });
});

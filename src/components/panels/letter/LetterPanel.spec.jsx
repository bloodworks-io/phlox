import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import LetterPanel from "./LetterPanel";
import DictationWidget from "./DictationWidget";
import { system } from "../../../theme";
import { emotionStylesFor, renderWithProviders } from "../../../test/utils";

const {
  transcribeDictation,
  generateLetter,
  recorderStart,
  recorderStop,
  toastCreate,
} = vi.hoisted(() => ({
  transcribeDictation: vi.fn(),
  generateLetter: vi.fn(),
  recorderStart: vi.fn(),
  recorderStop: vi.fn(),
  toastCreate: vi.fn(),
}));

vi.mock("../../../utils/api/transcriptionApi", () => ({
  transcriptionApi: { transcribeDictation },
}));
vi.mock("../../../utils/api/letterApi", () => ({
  letterApi: { generateLetter },
}));
vi.mock("../../../utils/audioRecorder", () => ({
  AudioRecorder: class {
    constructor() {
      this.start = recorderStart;
      this.stop = recorderStop;
    }
  },
}));
vi.mock("@/components/ui/toaster", () => ({
  toaster: { create: toastCreate },
}));

// Vitest runs without globals — register cleanup or renders leak.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete navigator.mediaDevices;
});

const ORIGINAL_MATCH_MEDIA = window.matchMedia.bind(window);

function stubReducedMotion(matches) {
  window.matchMedia = (query) => ({
    ...ORIGINAL_MATCH_MEDIA(query),
    matches:
      query === "(prefers-reduced-motion: reduce)" ? matches : false,
  });
}

const TEMPLATES = [
  { id: 11, name: "General Practice" },
  { id: 12, name: "Dictation" },
  { id: 13, name: "Specialist Referral" },
];

const PATIENT = {
  name: "Elena Vaughan",
  gender: "female",
  dob: "1980-01-01",
  template_data: { hx: "Persistent cough." },
};

function baseProps(props = {}) {
  return {
    patient: PATIENT,
    dimensions: { width: 480, height: 640 },
    resizerRef: React.createRef(),
    handleMouseDown: vi.fn(),
    finalCorrespondence: "Dear Dr Rao,",
    setFinalCorrespondence: vi.fn(),
    letterLoading: false,
    setLoading: vi.fn(),
    handleGenerateLetterClick: vi.fn(),
    handleSaveLetter: vi.fn(),
    setIsModified: vi.fn(),
    letterTemplates: TEMPLATES,
    selectedTemplate: TEMPLATES[0],
    selectTemplate: vi.fn(),
    additionalInstructions: "",
    setAdditionalInstructions: vi.fn(),
    refinementInput: "",
    setRefinementInput: vi.fn(),
    handleRefinement: vi.fn(),
    isRefining: false,
    setIsRefining: vi.fn(),
    textareaRef: React.createRef(),
    recentlyCopied: false,
    saveState: "idle",
    handleCopy: vi.fn(),
    ...props,
  };
}

const renderLetterPanel = (props = {}) =>
  renderWithProviders(<LetterPanel {...baseProps(props)} />);

const getModeSelect = () => document.querySelector("select");

describe("LetterPanel Folio shell", () => {
  it("keeps the panel geometry and the resize handle wired", () => {
    const handleMouseDown = vi.fn();
    const { container } = renderLetterPanel({ handleMouseDown });
    const root = Array.from(container.querySelectorAll("div")).find((el) =>
      emotionStylesFor(el).includes("width: 480px"),
    );
    expect(emotionStylesFor(root)).toContain("height: 640px");

    const resizer = Array.from(container.querySelectorAll("div")).find((el) =>
      emotionStylesFor(el).includes("nwse-resize"),
    );
    fireEvent.mouseDown(resizer);
    expect(handleMouseDown).toHaveBeenCalledTimes(1);
  });

  it("sets the header on paper with a hairline and accent envelope", () => {
    renderLetterPanel();
    const header = document.querySelector(".panel-header");
    const headerStyles = emotionStylesFor(header);
    expect(headerStyles).toContain("var(--chakra-colors-folio-paper)");
    expect(headerStyles).toContain("var(--chakra-colors-folio-ink)");
    expect(headerStyles).toContain("var(--chakra-colors-folio-line)");
    expect(emotionStylesFor(header.firstElementChild)).toContain(
      "var(--chakra-colors-folio-accent)",
    );
    expect(screen.getByText("Patient Letter")).toBeInTheDocument();
  });

  it("edits the letter on the canvas body of the folio panel", () => {
    const { container } = renderLetterPanel();
    const body = container.querySelector(".attached-panel-body");
    const bodyStyles = emotionStylesFor(body);
    expect(bodyStyles).toContain("var(--chakra-colors-folio-canvas)");
    expect(bodyStyles).toContain("var(--chakra-colors-folio-ink)");
    expect(bodyStyles).toContain("var(--chakra-radii-folio-panel)");

    const editor = screen.getByDisplayValue("Dear Dr Rao,");
    expect(editor).toBeEnabled();
  });

  it("falls back to the none-attached notice until a letter exists", () => {
    renderLetterPanel({ finalCorrespondence: "" });
    expect(
      screen.getByDisplayValue("No letter attached to encounter"),
    ).toBeInTheDocument();
  });
});

describe("LetterPanel mode switching", () => {
  it("offers draft and dictate modes and starts in draft", () => {
    renderLetterPanel();
    const select = getModeSelect();
    expect(select.value).toBe("draft");
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Dictate")).toBeInTheDocument();
    expect(document.querySelector(".dictation-fab")).toBeNull();
    expect(document.querySelector(".template-selector")).toBeTruthy();
  });

  it("swaps templates for the dictation microphone in dictate mode", () => {
    const { rerender } = renderLetterPanel();
    const select = getModeSelect();

    fireEvent.change(select, { target: { value: "dictate" } });
    expect(select.value).toBe("dictate");
    expect(document.querySelector(".template-selector")).toBeNull();
    expect(document.querySelector(".dictation-fab")).toBeTruthy();

    fireEvent.change(select, { target: { value: "draft" } });
    expect(document.querySelector(".dictation-fab")).toBeNull();
    expect(document.querySelector(".template-selector")).toBeTruthy();
    rerender(<LetterPanel {...baseProps()} />);
  });

  it("disables the dictation fab while the letter is loading", () => {
    renderLetterPanel({ letterLoading: true });
    fireEvent.change(getModeSelect(), { target: { value: "dictate" } });
    expect(document.querySelector(".dictation-fab")).toBeDisabled();
  });
});

describe("LetterPanel template selector", () => {
  it("lists templates beside custom, hiding the Dictation source", () => {
    const selectTemplate = vi.fn();
    renderLetterPanel({ selectTemplate });

    expect(
      screen.getByRole("button", { name: "General Practice" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Specialist Referral" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dictation")).toBeNull(); // option only
    expect(screen.getByRole("button", { name: "Custom" })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Specialist Referral" }),
    );
    expect(selectTemplate).toHaveBeenCalledWith(TEMPLATES[2]);
  });

  it("marks the selected template with the success role", () => {
    renderLetterPanel();
    const selected = screen.getByRole("button", { name: "General Practice" });
    expect(emotionStylesFor(selected)).toContain(
      "var(--chakra-colors-folio-success)",
    );
    expect(screen.getByRole("button", { name: "Custom" })).not.toEqual(
      selected,
    );
  });

  it("reveals custom instructions only for the custom template", () => {
    const setAdditionalInstructions = vi.fn();
    const { rerender } = renderLetterPanel({
      selectedTemplate: "custom",
      setAdditionalInstructions,
    });

    fireEvent.change(
      screen.getByPlaceholderText(
        "Enter custom instructions for letter generation...",
      ),
      { target: { value: "Mention the travel history." } },
    );
    expect(setAdditionalInstructions).toHaveBeenCalledWith(
      "Mention the travel history.",
    );

    rerender(<LetterPanel {...baseProps()} />);
    expect(
      screen.queryByPlaceholderText(
        "Enter custom instructions for letter generation...",
      ),
    ).toBeNull();
  });
});

describe("LetterEditor refinement flow", () => {
  it("opens the refinement overlay from the accent fab", () => {
    const setIsRefining = vi.fn();
    renderLetterPanel({ setIsRefining });

    const fab = screen.getByRole("button", { name: "Refine letter" });
    const fabStyles = emotionStylesFor(fab);
    expect(fabStyles).toContain("var(--chakra-colors-folio-accent)");
    expect(fabStyles).toContain("var(--chakra-colors-folio-accent-ink)");
    expect(fabStyles).toContain("width: 40px");
    expect(fabStyles).toContain("height: 40px");

    fireEvent.click(fab);
    expect(setIsRefining).toHaveBeenCalledWith(true);
    expect(document.querySelector(".floating-panel")).toBeNull();
  });

  it("centers the floating refinement panel over the letter", () => {
    renderLetterPanel({ isRefining: true });
    const panel = document.querySelector(".floating-panel");
    expect(panel).toBeTruthy();
    const panelStyles = emotionStylesFor(panel);
    expect(panelStyles).toContain("transform: translate(-50%, -50%)");
    expect(panelStyles).toContain("max-width: 500px");
    expect(screen.getByText("Refine Letter")).toBeInTheDocument();
  });

  it("fills the refinement draft from suggestion chips", () => {
    const setRefinementInput = vi.fn();
    renderLetterPanel({ isRefining: true, setRefinementInput });

    const chip = screen.getByRole("button", { name: "More formal" });
    expect(chip.className).toContain("refinement-suggestions");
    fireEvent.click(chip);
    expect(setRefinementInput).toHaveBeenCalledWith("More formal");

    fireEvent.change(
      screen.getByPlaceholderText("How would you like to improve the letter?"),
      { target: { value: "Sound less alarming." } },
    );
    expect(setRefinementInput).toHaveBeenCalledWith("Sound less alarming.");
  });

  it("submits and closes the refinement panel", () => {
    const handleRefinement = vi.fn();
    const setIsRefining = vi.fn();
    renderLetterPanel({
      isRefining: true,
      handleRefinement,
      setIsRefining,
    });

    fireEvent.click(screen.getByRole("button", { name: "Refine" }));
    expect(handleRefinement).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText("Close refinement"));
    expect(setIsRefining).toHaveBeenCalledWith(false);
  });

  it("maps the refinement close control to the quiet Folio secondary role", () => {
    renderLetterPanel({ isRefining: true });

    const close = screen.getByLabelText("Close refinement");
    const styles = emotionStylesFor(close);
    expect(styles).toContain("var(--chakra-colors-folio-muted)");
    expect(close.className).not.toContain("collapse-toggle");
  });

  it("scrimms the refinement panel while a refinement runs", () => {
    renderLetterPanel({ isRefining: true, letterLoading: true });
    const panel = document.querySelector(".floating-panel");
    expect(panel.querySelector(".chakra-spinner")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /refining/i }),
    ).toBeDisabled();
  });

  it("maps the suggestion chips to the quiet folio outline role", () => {
    const chip =
      system.getGlobalCss()["@layer base"]["&.refinement-suggestions"][
        ":root &, .light &"
      ];
    expect(chip.backgroundColor).toContain(
      "var(--chakra-colors-folio-paper-alt)",
    );
    expect(chip.borderColor).toContain("var(--chakra-colors-folio-line)");
    expect(chip.color).toContain("var(--chakra-colors-folio-muted)");
  });
});

describe("LetterEditor loading scrim", () => {
  it("veils the letter behind a canvas scrim with the brand spinner", () => {
    const { container } = renderLetterPanel({ letterLoading: true });
    const spinner = container.querySelector(".chakra-spinner");
    expect(spinner).toBeTruthy();
    expect(emotionStylesFor(spinner)).toContain(
      "var(--chakra-colors-folio-brand)",
    );

    const scrim = spinner.closest("div");
    const scrimStyles = emotionStylesFor(scrim);
    expect(scrimStyles).toContain("var(--chakra-colors-folio-canvas)");
    expect(scrimStyles).toContain("opacity: 0.78");
    expect(scrimStyles).toContain("z-index: 1");

    const editor = screen.getByDisplayValue("Dear Dr Rao,");
    expect(editor).toBeDisabled();
    expect(editor.style.color).toContain(
      "var(--chakra-colors-folio-faint)",
    );
    expect(screen.getByRole("button", { name: "Refine letter" })).toBeDisabled();
  });

  it("keeps the editor live when not loading", () => {
    const setFinalCorrespondence = vi.fn();
    const setIsModified = vi.fn();
    const { container } = renderLetterPanel({
      setFinalCorrespondence,
      setIsModified,
    });

    expect(container.querySelector(".chakra-spinner")).toBeNull();
    const editor = screen.getByDisplayValue("Dear Dr Rao,");
    expect(editor).toBeEnabled();

    fireEvent.change(editor, { target: { value: "Dear Dr Rao,\nThanks." } });
    expect(setFinalCorrespondence).toHaveBeenCalledWith(
      "Dear Dr Rao,\nThanks.",
    );
    expect(setIsModified).toHaveBeenCalledWith(true);
  });
});

describe("PanelFooterActions gates", () => {
  it("fires regenerate with instructions, copy, and save when idle", () => {
    const handleGenerateLetterClick = vi.fn();
    const handleCopy = vi.fn();
    const handleSaveLetter = vi.fn();
    renderLetterPanel({
      handleGenerateLetterClick,
      handleCopy,
      handleSaveLetter,
      additionalInstructions: "Keep it brief.",
    });

    const regenerate = screen.getByRole("button", {
      name: "Regenerate Letter",
    });
    const copy = screen.getByRole("button", { name: "Copy Letter" });
    const save = screen.getByRole("button", { name: "Save Letter" });
    for (const button of [regenerate, copy, save]) {
      expect(button).toBeEnabled();
    }
    expect(emotionStylesFor(save)).toContain(
      "var(--chakra-colors-folio-accent)",
    );

    fireEvent.click(regenerate);
    expect(handleGenerateLetterClick).toHaveBeenCalledWith("Keep it brief.");
    fireEvent.click(copy);
    expect(handleCopy).toHaveBeenCalledTimes(1);
    fireEvent.click(save);
    expect(handleSaveLetter).toHaveBeenCalledTimes(1);
  });

  it("locks every footer action while the letter is loading", () => {
    renderLetterPanel({ letterLoading: true });
    expect(
      screen.getByRole("button", { name: "Regenerate Letter" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy Letter" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save Letter" })).toBeDisabled();
  });

  it("shows the save pipeline as saving and locks regeneration", () => {
    renderLetterPanel({ saveState: "saving" });
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Regenerate Letter" }),
    ).toBeDisabled();
  });

  it("confirms saved state on the success role", () => {
    renderLetterPanel({ saveState: "saved" });
    const saved = screen.getByRole("button", { name: "Saved!" });
    expect(saved).toBeDisabled();
    expect(emotionStylesFor(saved)).toContain(
      "var(--chakra-colors-folio-success)",
    );
  });

  it("flips copy to the success role once copied", () => {
    renderLetterPanel({ recentlyCopied: true });
    const copied = screen.getByRole("button", { name: "Copied!" });
    expect(copied).toBeEnabled();
    expect(emotionStylesFor(copied)).toContain(
      "var(--chakra-colors-folio-success)",
    );
  });
});

describe("DictationWidget", () => {
  const renderWidget = (props = {}) =>
    renderWithProviders(
      <DictationWidget
        patient={PATIENT}
        setFinalCorrespondence={vi.fn()}
        letterTemplates={TEMPLATES}
        setLoading={vi.fn()}
        isDisabled={false}
        {...props}
      />,
    );

  beforeEach(() => {
    navigator.mediaDevices = {
      getUserMedia: vi.fn(async () => "stream"),
    };
    recorderStart.mockResolvedValue(undefined);
    recorderStop.mockResolvedValue(
      new Blob(["wav"], { type: "audio/wav" }),
    );
    transcribeDictation.mockResolvedValue({
      transcription: "Rough dictated letter.",
    });
    generateLetter.mockResolvedValue({ letter: "Polished letter." });
  });

  afterEach(() => {
    window.matchMedia = ORIGINAL_MATCH_MEDIA;
  });

  const startRecording = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    // start() resolves on a microtask; wait for the waveform to mount.
    await waitFor(() =>
      expect(document.querySelector(".anim-fade")).toBeTruthy(),
    );
  };

  const stopRecording = () =>
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));

  it("starts recording through the audio recorder", async () => {
    renderWidget();
    await startRecording();
    expect(recorderStart).toHaveBeenCalledTimes(1);

    const waveform = document.querySelector(".anim-fade");
    // Eight static bars plus the running timer.
    const bars = Array.from(waveform.children).filter(
      (el) => el.tagName === "DIV",
    );
    expect(bars).toHaveLength(8);
    expect(emotionStylesFor(bars[0])).toContain(
      "var(--chakra-colors-folio-danger)",
    );
    expect(screen.getByText("0:00")).toBeInTheDocument();

    const mic = screen.getByRole("button", { name: "Dictate" });
    expect(emotionStylesFor(mic)).toContain("var(--chakra-colors-folio-danger)");
  });

  it("dictates a letter end to end from the recording", async () => {
    const setFinalCorrespondence = vi.fn();
    const setLoading = vi.fn();
    renderWidget({ setFinalCorrespondence, setLoading });

    await startRecording();
    stopRecording();

    await waitFor(() =>
      expect(setFinalCorrespondence).toHaveBeenCalledWith(
        "Polished letter.",
      ),
    );
    expect(transcribeDictation).toHaveBeenCalledTimes(1);
    expect(generateLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        patientName: "Elena Vaughan",
        gender: "female",
        dob: "1980-01-01",
        template_data: {
          hx: "Persistent cough.",
          Dictation: "Rough dictated letter.",
        },
      }),
    );
    expect(toastCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Success",
        description: "Letter generated from dictation",
        type: "success",
      }),
    );
    expect(setLoading).toHaveBeenCalledWith(true);
    expect(setLoading).toHaveBeenCalledWith(false);

    // Recording wrapped up: the waveform is gone and the mic is armed again.
    expect(document.querySelector(".anim-fade")).toBeNull();
    const mic = screen.getByRole("button", { name: "Dictate" });
    expect(mic).toBeEnabled();
    expect(mic.querySelector(".chakra-spinner")).toBeNull();
  });

  it("uses the dictation template instructions when generating", async () => {
    renderWidget({
      letterTemplates: [
        { id: 12, name: "Dictation", instructions: "Keep my structure." },
      ],
    });
    await startRecording();
    stopRecording();

    await waitFor(() => expect(generateLetter).toHaveBeenCalled());
    expect(generateLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        additional_instruction: "Keep my structure.",
      }),
    );
  });

  it("shows the processing spinner and locks the fab mid-flight", async () => {
    let resolveTranscription;
    transcribeDictation.mockReturnValue(
      new Promise((resolve) => {
        resolveTranscription = resolve;
      }),
    );
    renderWidget();

    await startRecording();
    stopRecording();

    // The tooltip unmounts while processing, so re-query inside waitFor.
    await waitFor(() => {
      const busy = screen.getByRole("button", { name: "Dictate" });
      expect(busy.querySelector(".chakra-spinner")).toBeTruthy();
      expect(busy).toBeDisabled();
    });

    resolveTranscription({ transcription: "Rough dictated letter." });
    await waitFor(() => {
      const mic = screen.getByRole("button", { name: "Dictate" });
      expect(mic.querySelector(".chakra-spinner")).toBeNull();
    });
  });

  it("falls back to default instructions without a dictation template", async () => {
    renderWidget({ letterTemplates: [] });
    await startRecording();
    stopRecording();

    await waitFor(() => expect(generateLetter).toHaveBeenCalled());
    const call = generateLetter.mock.calls[0][0];
    expect(call.additional_instruction).toContain("polished letter");
  });

  it("toasts an error when dictation processing fails", async () => {
    const setFinalCorrespondence = vi.fn();
    const setLoading = vi.fn();
    transcribeDictation.mockRejectedValue(new Error("boom"));
    renderWidget({ setFinalCorrespondence, setLoading });

    await startRecording();
    stopRecording();

    await waitFor(() =>
      expect(toastCreate).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      ),
    );
    expect(setFinalCorrespondence).not.toHaveBeenCalled();
    expect(setLoading).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Dictate" })).toBeEnabled();
  });

  it("refuses to record without microphone support", async () => {
    delete navigator.mediaDevices;
    renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Dictate" }));
    await waitFor(() => expect(toastCreate).toHaveBeenCalled());
    expect(recorderStart).not.toHaveBeenCalled();
    expect(toastCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Error",
        description:
          "Audio recording is not supported in this browser.",
        type: "error",
      }),
    );
  });

  it("keeps the waveform static under reduced motion", async () => {
    stubReducedMotion(true);
    renderWidget();
    await startRecording();

    const waveform = document.querySelector(".anim-fade");
    expect(waveform).toBeTruthy();
    // Bars carry fixed heights and no keyframes of their own; the mount
    // fade is the only motion and the theme disables it.
    const bars = Array.from(waveform.children).filter(
      (el) => el.tagName === "DIV",
    );
    expect(bars).toHaveLength(8);
    for (const bar of bars) {
      expect(emotionStylesFor(bar)).not.toContain("animation:");
    }
    const reduced =
      system.getGlobalCss()["@layer base"][
        "@media (prefers-reduced-motion: reduce)"
      ];
    expect(reduced["&.anim-fade"]).toEqual({ animation: "none !important" });
  });

  it("anchors the microphone next to the refine fab", () => {
    renderWidget();
    const mic = screen.getByRole("button", { name: "Dictate" });
    const micStyles = emotionStylesFor(mic);
    expect(micStyles).toContain("width: 40px");
    expect(micStyles).toContain("height: 40px");
    expect(micStyles).toContain("right: 60px");
    expect(micStyles).toContain("bottom: var(--chakra-spacing-4)");
  });
});

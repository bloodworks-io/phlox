import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import Uploader from "./Uploader";
import { renderWithProviders } from "../../test/utils";
import { ragApi } from "../../utils/api/ragApi";
import { extractPdfMetadata } from "../../utils/helpers/pdfExtractHelpers";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";

vi.mock("../../utils/api/ragApi", () => ({
    ragApi: {
        commitDirect: vi.fn(),
        commitToDatabase: vi.fn(),
        fetchCollections: vi.fn(),
    },
}));
vi.mock("../../utils/helpers/pdfExtractHelpers", () => ({
    extractPdfMetadata: vi.fn(),
}));
vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

const file = new File(["bytes"], "flu-guide.pdf", { type: "application/pdf" });

// extractPdfMetadata is untyped JS whose inferred return misses optional
// branches (title/pdfBase64) — cast mock payloads to the real shape.
const extractResult = (value) =>
    value as Awaited<ReturnType<typeof extractPdfMetadata>>;

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ragApi.fetchCollections).mockResolvedValue({
        files: ["influenza"],
    });
});

afterEach(cleanup);

const renderUploader = (setCollections = vi.fn()) =>
    renderWithProviders(
        <Uploader isCollapsed={false} setIsCollapsed={() => {}} setCollections={setCollections} />,
    );

const pickFile = () =>
    fireEvent.change(document.getElementById("pdf-upload"), {
        target: { files: [file] },
    });

const extract = () =>
    fireEvent.click(
        screen.getByRole("button", { name: t("rag.extractPdfInfo") as string }),
    );

const commit = () =>
    fireEvent.click(
        screen.getByRole("button", { name: t("rag.commitToDatabase") as string }),
    );

describe("Uploader", () => {
    it("warns when extracting with no file selected", async () => {
        renderUploader();
        extract();

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "warning" }),
            );
        });
        expect(extractPdfMetadata).not.toHaveBeenCalled();
    });

    it("extracts metadata and populates the editable form", async () => {
        vi.mocked(extractPdfMetadata).mockResolvedValue(extractResult({
            disease_name: "influenza",
            document_source: "WHO",
            focus_area: "guidelines",
            title: "Flu Guide",
            extractedText: "some text",
            pdfBase64: "b64",
        }));
        renderUploader();
        pickFile();
        extract();

        await waitFor(() => {
            expect(
                screen.getByDisplayValue("influenza"),
            ).toBeInTheDocument();
        });
        expect(screen.getByDisplayValue("WHO")).toBeInTheDocument();
        expect(screen.getByDisplayValue("guidelines")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Flu Guide")).toBeInTheDocument();
    });

    it("renders no commit action until something is extracted", () => {
        renderUploader();
        expect(
            screen.queryByRole("button", {
                name: t("rag.commitToDatabase") as string,
            }),
        ).toBeNull();
        expect(ragApi.commitDirect).not.toHaveBeenCalled();
    });

    it("commits extracted text directly and refreshes collections", async () => {
        vi.mocked(extractPdfMetadata).mockResolvedValue(extractResult({
            disease_name: "influenza",
            document_source: "WHO",
            focus_area: "guidelines",
            title: "Flu Guide",
            extractedText: "some text",
            pdfBase64: "b64",
        }));
        vi.mocked(ragApi.commitDirect).mockResolvedValue({});
        const setCollections = vi.fn();
        renderUploader(setCollections);
        pickFile();
        extract();

        await waitFor(() => {
            expect(screen.getByDisplayValue("influenza")).toBeInTheDocument();
        });
        fireEvent.change(screen.getByDisplayValue("influenza"), {
            target: { value: "influenza-updated" },
        });
        commit();

        await waitFor(() => {
            expect(ragApi.commitDirect).toHaveBeenCalledWith(
                expect.objectContaining({
                    extracted_text: "some text",
                    disease_name: "influenza-updated",
                    document_source: "WHO",
                    focus_area: "guidelines",
                    filename: "flu-guide.pdf",
                    title: "Flu Guide",
                    pdf_base64: "b64",
                }),
            );
        });
        await waitFor(() => {
            expect(setCollections).toHaveBeenCalledWith([
                { name: "influenza", files: [], loaded: false },
            ]);
        });
        expect(toaster.create).toHaveBeenCalledWith(
            expect.objectContaining({ type: "success" }),
        );
        // Form resets after a successful commit.
        expect(screen.queryByDisplayValue("WHO")).toBeNull();
    });

    it("uses the textless commit when extraction had no text", async () => {
        vi.mocked(extractPdfMetadata).mockResolvedValue(extractResult({
            disease_name: "influenza",
            document_source: "WHO",
            focus_area: "guidelines",
            title: null,
            extractedText: "",
        }));
        vi.mocked(ragApi.commitToDatabase).mockResolvedValue({});
        renderUploader();
        pickFile();
        extract();

        await waitFor(() => {
            expect(screen.getByDisplayValue("influenza")).toBeInTheDocument();
        });
        commit();

        await waitFor(() => {
            expect(ragApi.commitToDatabase).toHaveBeenCalledWith(
                expect.objectContaining({
                    disease_name: "influenza",
                    filename: "flu-guide.pdf",
                    title: null,
                }),
            );
        });
        expect(ragApi.commitDirect).not.toHaveBeenCalled();
    });

    it("failed extraction shows an error toast", async () => {
        vi.mocked(extractPdfMetadata).mockRejectedValue(
            new Error("cannot read"),
        );
        renderUploader();
        pickFile();
        extract();

        await waitFor(() => {
            expect(toaster.create).toHaveBeenCalledWith(
                expect.objectContaining({ type: "error" }),
            );
        });
    });
});

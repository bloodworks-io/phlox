import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import ArtifactCard from "./ArtifactCard";
import {
    renderWithProviders,
    emotionStylesFor,
} from "../../test/utils";
import { t } from "@/i18n";

afterEach(cleanup);

const pdfArtifact = {
    filename: "clinic-report.pdf",
    mime_type: "application/pdf",
    size: 2048,
    url: "/files/clinic-report.pdf",
};

const cardFor = (name) => screen.getByText(name).closest(".anim-fade-scale");

describe("ArtifactCard", () => {
    it("describes the file with type and formatted size", () => {
        renderWithProviders(<ArtifactCard artifact={pdfArtifact} />);
        expect(
            screen.getByText("application/pdf · 2.0 KB"),
        ).toBeInTheDocument();
    });

    it("offers view and download actions for PDFs", () => {
        renderWithProviders(<ArtifactCard artifact={pdfArtifact} />);
        const view = screen
            .getByRole("button", { name: t("common.artifact.viewFile") })
            .closest("a");
        expect(view).toHaveAttribute("href", "/files/clinic-report.pdf");
        const download = screen
            .getByRole("button", { name: t("common.artifact.downloadFile") })
            .closest("a");
        expect(download).toHaveAttribute("href", "/files/clinic-report.pdf");
        expect(download).toHaveAttribute("download");
    });

    it("hides the view action for non-PDF artifacts", () => {
        renderWithProviders(
            <ArtifactCard
                artifact={{
                    ...pdfArtifact,
                    filename: "scan.png",
                    mime_type: "image/png",
                }}
            />,
        );
        expect(
            screen.queryByRole("button", {
                name: t("common.artifact.viewFile"),
            }),
        ).toBeNull();
        expect(
            screen.getByRole("button", {
                name: t("common.artifact.downloadFile"),
            }),
        ).toBeInTheDocument();
    });

    it("presents the card on Folio paper with a hairline border", () => {
        renderWithProviders(<ArtifactCard artifact={pdfArtifact} />);
        const styles = emotionStylesFor(cardFor("clinic-report.pdf"));
        expect(styles).toContain("var(--chakra-colors-folio-paper)");
        expect(styles).toContain("var(--chakra-colors-folio-line)");
        expect(styles).toContain("var(--chakra-colors-folio-accent)");
    });

    it("tints the file icon through its container instead of an icon color prop", () => {
        renderWithProviders(<ArtifactCard artifact={pdfArtifact} />);
        const svg = screen.getByText("clinic-report.pdf")
            .parentElement.querySelector("svg");
        expect(svg.getAttribute("color")).toBeNull();
        const holder = emotionStylesFor(svg.parentElement);
        expect(holder).toContain("var(--chakra-colors-folio-faint)");
    });
});

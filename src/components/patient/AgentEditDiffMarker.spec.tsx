import { describe, it, expect, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import AgentEditDiffMarker from "./AgentEditDiffMarker";
import { renderWithProviders } from "../../test/utils";
import { t } from "@/i18n";

const markerLabel = () => t("patient.agentEditedPersistentField") as string;

const renderMarker = (props: { before?: string; after: string }) =>
    renderWithProviders(
        <AgentEditDiffMarker fieldLabel="Past Medical History" {...props} />,
    );

afterEach(cleanup);

describe("AgentEditDiffMarker", () => {
    it("shows a colored line diff of the agent's change on click", async () => {
        renderMarker({ before: "• Hypertension", after: "• Hypertension\n• AF" });
        fireEvent.click(screen.getByLabelText(markerLabel()));

        // Chakra v3 Popover opens on click; content is lazily rendered.
        await screen.findByText("• Hypertension");
        const added = document.querySelector(".agent-diff-line--add");
        expect(added?.textContent).toContain("+ • AF");
        expect(document.querySelectorAll(".agent-diff-line--remove")).toHaveLength(0);
    });

    it("falls back to an unavailable note when no baseline exists", async () => {
        renderMarker({ after: "• Hypertension" });
        fireEvent.click(screen.getByLabelText(markerLabel()));
        expect(
            await screen.findByText(t("patient.agentDiffUnavailable") as string),
        ).toBeInTheDocument();
    });
});

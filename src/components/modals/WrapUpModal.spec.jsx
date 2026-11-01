import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import WrapUpModal from "./WrapUpModal";
import {
    renderWithProviders,
    emotionStylesFor,
} from "../../test/utils";
import { t } from "@/i18n";

// Controllable useSWRMutation stand-in: tests point `state` at the scenario.
const swr = vi.hoisted(() => ({
    state: { data: undefined, error: undefined, isMutating: false },
    trigger: vi.fn(),
}));

vi.mock("swr/mutation", () => ({
    default: () => ({ trigger: swr.trigger, ...swr.state }),
}));

vi.mock("../../utils/api/patientApi", () => ({
    patientApi: { extractJobs: vi.fn() },
}));

afterEach(() => {
    cleanup();
    swr.state = { data: undefined, error: undefined, isMutating: false };
    vi.clearAllMocks();
});

const renderModal = (props = {}) =>
    renderWithProviders(
        <WrapUpModal
            isOpen
            onClose={vi.fn()}
            onConfirm={vi.fn()}
            planText="Book labs and fax the note."
            {...props}
        />,
    );

describe("WrapUpModal curation", () => {
    it("lists staged voice jobs as editable, toggleable rows", () => {
        renderModal({
            stagedJobs: [
                { text: "Book labs", checked: true },
                { text: "Fax the note", checked: false },
            ],
        });

        expect(screen.getByDisplayValue("Book labs")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Fax the note")).toBeInTheDocument();

        fireEvent.change(screen.getByDisplayValue("Book labs"), {
            target: { value: "Book fasting labs",
            },
        });
        expect(
            screen.getByDisplayValue("Book fasting labs"),
        ).toBeInTheDocument();

        const checked = screen
            .getAllByRole("checkbox")
            .find((el) => el.checked);
        fireEvent.click(checked);
        expect(checked.checked).toBe(false);
    });

    it("sends only checked tasks, renumbered, on confirm", () => {
        const onConfirm = vi.fn();
        renderModal({
            stagedJobs: [
                { text: "Book labs", checked: true },
                { text: "Skip me", checked: false },
                { text: "Fax the note", checked: true },
            ],
            onConfirm,
        });

        fireEvent.click(
            screen.getByRole("button", {
                name: t("modal.wrapUp.confirmFinish"),
            }),
        );
        expect(onConfirm).toHaveBeenCalledWith([
            { id: 1, job: "Book labs", completed: false },
            { id: 2, job: "Fax the note", completed: false },
        ]);
    });

    it("removes a task from the list", () => {
        renderModal({
            stagedJobs: [{ text: "Book labs", checked: true }],
        });
        fireEvent.click(
            screen.getByRole("button", { name: t("modal.wrapUp.removeTask") }),
        );
        expect(screen.queryByDisplayValue("Book labs")).not.toBeInTheDocument();
    });

    it("adds tasks from the free-text field with Enter", () => {
        renderModal({ stagedJobs: [] });
        const input = screen.getByPlaceholderText(
            t("modal.wrapUp.addTaskPlaceholder"),
        );
        fireEvent.change(input, { target: { value: "Call patient" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(screen.getByDisplayValue("Call patient")).toBeInTheDocument();
        expect(input.value).toBe("");
    });

    it("promotes an excluded remark back into the task list", async () => {
        swr.state = {
            ...swr.state,
            data: {
                action_items: [{ text: "Book labs" }],
                excluded: [{ text: "Weather talk" }],
            },
        };
        renderModal();

        fireEvent.click(screen.getByText(t("modal.wrapUp.notTasks", { count: 1 })));
        fireEvent.click(
            await screen.findByRole("button", {
                name: t("modal.wrapUp.promoteToTask"),
            }),
        );
        expect(screen.getByDisplayValue("Weather talk")).toBeInTheDocument();
    });

    it("reports extracted jobs back to the live-agent session", () => {
        const onExtracted = vi.fn();
        swr.state = {
            ...swr.state,
            data: { action_items: [{ text: "Book labs" }, { text: "Fax" }] },
        };
        renderModal({ onExtracted });
        expect(onExtracted).toHaveBeenCalledWith([
            { text: "Book labs", checked: true },
            { text: "Fax", checked: true },
        ]);
    });
});

describe("WrapUpModal fallback states", () => {
    it("warns informationally when there is no plan text", () => {
        renderModal({ planText: "" });
        expect(screen.getByText(t("modal.wrapUp.noPlanText"))).toBeInTheDocument();
    });

    it("falls back to the heuristic extractor when extraction fails", () => {
        swr.state = { ...swr.state, error: new Error("network down") };
        renderModal();
        expect(
            screen.getByText(t("modal.wrapUp.heuristicFallback")),
        ).toBeInTheDocument();
    });

    it("blocks confirm while extraction is in flight", () => {
        swr.state = { ...swr.state, isMutating: true };
        renderModal();
        expect(
            screen.getByText(t("modal.wrapUp.extracting")),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", {
                name: t("modal.wrapUp.confirmFinish"),
            }),
        ).toBeDisabled();
    });
});

describe("WrapUpModal folio presentation", () => {
    it("renders the secondary cancel action on the Folio outline", () => {
        renderModal();
        const styles = emotionStylesFor(
            screen.getByRole("button", { name: t("action.cancel") }),
        );
        expect(styles).toContain("var(--chakra-colors-folio-line)");
        expect(styles).toContain("var(--chakra-colors-folio-muted)");
    });

    it("keeps curation hints on the muted Folio tier", () => {
        swr.state = { ...swr.state, isMutating: true };
        renderModal();
        const hint = screen.getByText(t("modal.wrapUp.extracting"));
        expect(emotionStylesFor(hint)).toContain(
            "var(--chakra-colors-folio-muted)",
        );
    });
});

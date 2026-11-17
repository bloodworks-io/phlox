import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import NewNoteStartCard from "./NewNoteStartCard";
import { emotionStylesFor, renderWithProviders } from "../../test/utils";
import { formatDate } from "../../utils/helpers/formatHelpers";
import { toaster } from "@/components/ui/toaster";
import { t } from "@/i18n";

vi.mock("@/components/ui/toaster", () => ({
    toaster: { create: vi.fn() },
}));

afterEach(cleanup);
beforeEach(() => {
    vi.clearAllMocks();
});

const candidates = [
    {
        id: 1,
        name: "Smith, John",
        gender: "M",
        dob: "1975-03-15",
        ur_number: "UR1",
        encounter_date: "2026-10-20",
    },
    { id: 2 },
];

const renderCard = (overrides = {}) =>
    renderWithProviders(
        <NewNoteStartCard
            onFind={vi.fn()}
            onNewPatient={vi.fn()}
            onConfirmCandidate={vi.fn()}
            {...overrides}
        />,
    );

const searchButton = () =>
    screen.getByRole("button", { name: t("patient.findExistingPatient") });
const searchInput = () =>
    screen.getByPlaceholderText(t("patient.urOrNamePlaceholder"));

const searchFor = async (query, onFind) => {
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    fireEvent.change(searchInput(), { target: { value: query } });
    fireEvent.submit(searchInput().closest("form"));
    await waitFor(() => expect(onFind).toHaveBeenCalledTimes(1));
};

describe("NewNoteStartCard choose view", () => {
    it("offers the new-patient and search paths", () => {
        renderCard();

        expect(
            screen.getByRole("heading", { name: t("patient.newEncounter") }),
        ).toBeInTheDocument();
        expect(screen.getByText(t("patient.chooseSubtitle"))).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /New patient/ }),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Search/ })).toBeInTheDocument();
    });

    it("delegates the new-patient path without changing the view", () => {
        const onNewPatient = vi.fn();
        renderCard({ onNewPatient });

        fireEvent.click(screen.getByRole("button", { name: /New patient/ }));
        expect(onNewPatient).toHaveBeenCalledTimes(1);
        expect(
            screen.getByText(t("patient.chooseSubtitle")),
        ).toBeInTheDocument();
    });

    it("uses the scoped Folio entry-path treatment", () => {
        renderCard();

        const newPatientButton = screen.getByRole("button", {
            name: /New patient/,
        });
        expect(newPatientButton).toHaveClass("entry-path");
        expect(emotionStylesFor(newPatientButton)).toContain(
            "var(--chakra-colors-folio-focus)",
        );
        expect(emotionStylesFor(newPatientButton)).toContain(
            "var(--chakra-colors-folio-hover)",
        );

        const tile = newPatientButton.querySelector(".path-icon-tile");
        expect(emotionStylesFor(tile)).toContain(
            "var(--chakra-colors-folio-accent-soft)",
        );
        expect(emotionStylesFor(tile)).toContain(
            "var(--chakra-colors-folio-line)",
        );

        const icon = tile.querySelector("svg");
        expect(emotionStylesFor(icon)).toContain(
            "var(--chakra-colors-folio-accent)",
        );
    });
});

describe("NewNoteStartCard search view", () => {
    it("transitions choose → search → choose through the back button", () => {
        renderCard();

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));
        expect(screen.getByText(t("patient.searchSubtitle"))).toBeInTheDocument();
        expect(searchInput()).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: t("patient.back") }));
        expect(screen.getByText(t("patient.chooseSubtitle"))).toBeInTheDocument();
    });

    it("warns and skips the search when the query is blank", () => {
        const onFind = vi.fn();
        renderCard({ onFind });

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));
        fireEvent.submit(searchInput().closest("form"));

        expect(toaster.create).toHaveBeenCalledTimes(1);
        expect(toaster.create).toHaveBeenCalledWith({
            title: t("patient.enterUrOrName"),
            description: t("patient.enterUrOrNameHint"),
            type: "warning",
            duration: 3000,
        });
        expect(onFind).not.toHaveBeenCalled();
        expect(
            screen.getByText(t("patient.searchSubtitle")),
        ).toBeInTheDocument();
    });

    it("disables the search button while a search is loading", () => {
        renderCard({ isSearchLoading: true });

        fireEvent.click(screen.getByRole("button", { name: /Search/ }));
        expect(searchButton()).toBeDisabled();
        expect(searchButton()).toHaveAttribute("data-loading");
    });
});

describe("NewNoteStartCard results view", () => {
    it("shows matching candidates with their demographics", async () => {
        const onFind = vi.fn().mockResolvedValue(candidates);
        renderCard({ onFind });

        await searchFor("  Smith  ", onFind);

        // The query is trimmed before it reaches the caller.
        expect(onFind).toHaveBeenCalledWith("Smith");
        expect(
            await screen.findByText(t("patient.resultsSubtitle")),
        ).toBeInTheDocument();

        const named = candidates[0];
        expect(screen.getByText(named.name)).toBeInTheDocument();
        const meta = screen.getByText(named.dob, { exact: false });
        expect(meta.textContent).toBe(
            [
                named.gender,
                named.dob,
                t("patient.urBadge", { ur: named.ur_number }),
            ].join("  ·  "),
        );
        expect(
            screen.getByText(
                t("patient.lastSeen", {
                    date: formatDate(named.encounter_date),
                }),
            ),
        ).toBeInTheDocument();

        // A candidate without any demographics falls back to placeholders.
        expect(screen.getByText(t("patient.unnamedPatient"))).toBeInTheDocument();
        expect(
            screen.getByText(t("patient.noDemographicsOnFile")),
        ).toBeInTheDocument();
    });

    it("toasts and stays in search when no patient matches", async () => {
        const onFind = vi.fn().mockResolvedValue([]);
        renderCard({ onFind });

        await searchFor("Nobody", onFind);

        await waitFor(() => expect(toaster.create).toHaveBeenCalledTimes(1));
        expect(toaster.create).toHaveBeenCalledWith({
            title: t("patient.noPatientFound"),
            description: t("patient.noPatientMatch", { query: "Nobody" }),
            type: "info",
            duration: 3000,
        });
        expect(
            screen.getByText(t("patient.searchSubtitle")),
        ).toBeInTheDocument();
    });

    it("returns from results to search with the query preserved, then back to choose", async () => {
        const onFind = vi.fn().mockResolvedValue(candidates);
        renderCard({ onFind });

        await searchFor("Smith", onFind);
        await screen.findByText(t("patient.resultsSubtitle"));
        fireEvent.click(screen.getByRole("button", { name: t("patient.back") }));

        expect(
            await screen.findByPlaceholderText(
                t("patient.urOrNamePlaceholder"),
            ),
        ).toHaveValue("Smith");

        fireEvent.click(screen.getByRole("button", { name: t("patient.back") }));
        expect(
            await screen.findByText(t("patient.chooseSubtitle")),
        ).toBeInTheDocument();
    });
});

describe("NewNoteStartCard candidate confirmation", () => {
    const renderWithResults = async (onConfirmCandidate) => {
        const onFind = vi.fn().mockResolvedValue(candidates);
        renderCard({ onFind, onConfirmCandidate });
        await searchFor("Smith", onFind);
        return screen.findAllByRole("button", {
            name: t("patient.startVisit"),
        });
    };

    it("confirms the chosen candidate through the callback", async () => {
        const onConfirmCandidate = vi.fn().mockResolvedValue();
        const buttons = await renderWithResults(onConfirmCandidate);

        fireEvent.click(buttons[0]);

        await waitFor(() =>
            expect(onConfirmCandidate).toHaveBeenCalledWith(candidates[0]),
        );
        // Once confirmed, every row returns to its resting state.
        await waitFor(() => {
            const buttons = screen.getAllByRole("button", {
                name: t("patient.startVisit"),
            });
            expect(buttons).toHaveLength(2);
            for (const button of buttons) {
                expect(button).toBeEnabled();
            }
        });
    });

    it("marks the confirming row as loading and disables its siblings", async () => {
        let resolveConfirm;
        const onConfirmCandidate = vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveConfirm = resolve;
                }),
        );
        const buttons = await renderWithResults(onConfirmCandidate);

        fireEvent.click(buttons[0]);

        expect(buttons[0]).toHaveAttribute("data-loading");
        expect(buttons[0]).toBeDisabled();
        expect(buttons[1]).toBeDisabled();

        await act(async () => {
            resolveConfirm();
        });

        expect(buttons[0]).not.toHaveAttribute("data-loading");
        expect(buttons[0]).toBeEnabled();
        expect(buttons[1]).toBeEnabled();
    });
});

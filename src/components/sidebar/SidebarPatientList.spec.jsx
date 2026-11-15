import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, waitFor } from "@testing-library/react";
import SidebarPatientList from "./SidebarPatientList";
import { renderWithProviders } from "../../test/utils";

const api = vi.hoisted(() => ({
    fetchStatus: vi.fn(async () => ({ enabled: false })),
}));
const flags = vi.hoisted(() => ({ isCompanionEnabled: vi.fn() }));
const env = vi.hoisted(() => ({ isTauri: vi.fn() }));

vi.mock("../../utils/api/companionApi", () => ({
    companionApi: api,
}));
vi.mock("../../utils/helpers/featureFlags", () => ({
    isCompanionEnabled: flags.isCompanionEnabled,
}));
vi.mock("../../utils/helpers/apiConfig", async (importOriginal) => ({
    ...(await importOriginal()),
    isTauri: env.isTauri,
}));

const renderList = () =>
    renderWithProviders(
        <SidebarPatientList
            patients={[]}
            onSelectPatient={vi.fn()}
            onDeletePatient={vi.fn()}
            isCollapsed={false}
            selectedPatientId={null}
            selectedDate={null}
            setSelectedDate={vi.fn()}
            onShowSummary={vi.fn()}
            onOpenCompanionImport={vi.fn()}
            isAdmin={false}
            patientScope="mine"
            onTogglePatientScope={vi.fn()}
        />,
    );

beforeEach(() => {
    vi.clearAllMocks();
    env.isTauri.mockReturnValue(true);
    flags.isCompanionEnabled.mockReturnValue(true);
});
afterEach(cleanup);

describe("SidebarPatientList companion status poll", () => {
    it("does not poll companion status when the companion flag is off", async () => {
        flags.isCompanionEnabled.mockReturnValue(false);
        renderList();

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(api.fetchStatus).not.toHaveBeenCalled();
    });

    it("does not poll companion status in the browser build", async () => {
        env.isTauri.mockReturnValue(false);
        renderList();

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
        });

        expect(api.fetchStatus).not.toHaveBeenCalled();
    });

    it("polls companion status on desktop when the companion flag is on", async () => {
        renderList();

        await waitFor(() => expect(api.fetchStatus).toHaveBeenCalled());
    });
});

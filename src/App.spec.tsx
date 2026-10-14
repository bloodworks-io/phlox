import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, cleanup, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { useAppInit } from "@/utils/context/appInit";
import { renderWithProviders } from "@/test/utils";

// App is a thin composition layer over tested hooks; this suite pins the
// wiring: bootstrap branches, the /note/:id load effect, sidebar/route/modal
// prop plumbing, and SWR sidebar cache invalidation.

const h = vi.hoisted(() => {
    return {
        // swr
        mutate: vi.fn(),
        // patientHandlers / errorHandlers
        handleLoadPatientDetails: vi.fn(),
        handleError: vi.fn(),
        // templateApi (keeps the real TemplateProvider quiet on mount)
        fetchTemplates: vi.fn(),
        getDefaultTemplate: vi.fn(),
        // navigation guard
        guardedNavigate: vi.fn(),
        guardedAction: vi.fn(),
        cancelNavigation: vi.fn(),
        confirmNavigation: vi.fn(),
        // new-note flow
        openNewNoteModal: vi.fn(),
        closeNewNoteModal: vi.fn(),
        completeNewNote: vi.fn(),
        setResetLetter: vi.fn(),
        // sidebar / session / scope
        toggleSidebar: vi.fn(),
        setPatient: vi.fn(),
        setSelectedDate: vi.fn(),
        createNewPatient: vi.fn(),
        findPatients: vi.fn(),
        loadSelectedPatient: vi.fn(),
        setPatientScope: vi.fn(),
        // mutable hook return values, reset in beforeEach
        bootstrap: {
            gate: null as ReactNode,
            isInitializing: false,
        },
        session: {
            patient: null as { id: string } | null,
        },
        nav: {
            isLeaveOpen: false,
        },
        flow: {
            isNewNoteOpen: false,
            newNoteKey: 0,
        },
    };
});

let layoutProps: any;
let routesProps: any;
let modalProps: any;
let dialogProps: any;

vi.mock("@/utils/hooks/useAppBootstrap", () => ({
    useAppBootstrap: () => h.bootstrap,
}));
vi.mock("@/utils/hooks/usePatientSession", () => ({
    usePatientSession: () => ({
        patient: h.session.patient,
        setPatient: h.setPatient,
        selectedDate: null,
        setSelectedDate: h.setSelectedDate,
        createNewPatient: h.createNewPatient,
        findPatients: h.findPatients,
        loadSelectedPatient: h.loadSelectedPatient,
    }),
}));
vi.mock("@/utils/hooks/useNavigationGuard", () => ({
    useNavigationGuard: () => ({
        guardedAction: h.guardedAction,
        guardedNavigate: h.guardedNavigate,
        confirmNavigation: h.confirmNavigation,
        cancelNavigation: h.cancelNavigation,
        isLeaveOpen: h.nav.isLeaveOpen,
    }),
}));
vi.mock("@/utils/hooks/useNewNoteFlow", () => ({
    useNewNoteFlow: () => ({
        openNewNoteModal: h.openNewNoteModal,
        closeNewNoteModal: h.closeNewNoteModal,
        completeNewNote: h.completeNewNote,
        setResetLetter: h.setResetLetter,
        isNewNoteOpen: h.flow.isNewNoteOpen,
        newNoteKey: h.flow.newNoteKey,
    }),
}));
vi.mock("@/utils/hooks/useSidebarState", () => ({
    useSidebarState: () => ({
        isSidebarCollapsed: true,
        toggleSidebar: h.toggleSidebar,
        isSmallScreen: false,
    }),
}));
vi.mock("@/utils/hooks/usePatientScope", () => ({
    usePatientScope: () => ({
        isAdmin: true,
        patientScope: "all",
        setPatientScope: h.setPatientScope,
    }),
}));
vi.mock("@/utils/patient/patientHandlers", () => ({
    handleLoadPatientDetails: h.handleLoadPatientDetails,
}));
vi.mock("@/utils/helpers/errorHandlers", () => ({
    handleError: h.handleError,
}));
vi.mock("@/utils/api/templateApi", () => ({
    templateApi: {
        fetchTemplates: h.fetchTemplates,
        getDefaultTemplate: h.getDefaultTemplate,
    },
}));
vi.mock("swr", async (importOriginal) => ({
    ...(await importOriginal()),
    mutate: h.mutate,
}));

vi.mock("@/components/layout/AppLayout", () => ({
    default: (props: any) => {
        layoutProps = props;
        return <div data-testid="app-layout">{props.children}</div>;
    },
}));

const InitProbe = () => {
    const { isInitializing } = useAppInit();
    return (
        <div data-testid="init-probe" data-initializing={String(isInitializing)} />
    );
};

vi.mock("@/components/layout/AppRoutes", () => ({
    default: (props: any) => {
        routesProps = props;
        return (
            <div>
                <div data-testid="app-routes" />
                <InitProbe />
            </div>
        );
    },
}));

vi.mock("@/components/modals/NewNoteModal", () => ({
    default: (props: any) => {
        modalProps = props;
        return props.isOpen ? <div data-testid="new-note-modal" /> : null;
    },
}));

vi.mock("@/components/common/ConfirmDialog", () => ({
    default: (props: any) => {
        dialogProps = props;
        return props.isOpen ? (
            <div data-testid="confirm-dialog">
                <div data-testid="dialog-title">{props.title}</div>
                <div data-testid="dialog-body">{props.body}</div>
                <div data-testid="dialog-confirm">{props.confirmLabel}</div>
            </div>
        ) : null;
    },
}));

import App from "./App";

// Vitest runs without globals — register cleanup or renders leak.
afterEach(cleanup);

const renderApp = (initialEntries: string[] = ["/"]) =>
    renderWithProviders(
        <MemoryRouter initialEntries={initialEntries}>
            <App />
        </MemoryRouter>,
    );

beforeEach(() => {
    vi.resetAllMocks();
    h.bootstrap.gate = null;
    h.bootstrap.isInitializing = false;
    h.session.patient = null;
    h.nav.isLeaveOpen = false;
    h.flow.isNewNoteOpen = false;
    h.flow.newNoteKey = 0;
    layoutProps = undefined;
    routesProps = undefined;
    modalProps = undefined;
    dialogProps = undefined;
    h.handleLoadPatientDetails.mockResolvedValue(undefined);
    h.fetchTemplates.mockResolvedValue([]);
    h.getDefaultTemplate.mockResolvedValue({ template_key: null });
});

describe("App", () => {
    it("renders the app shell once bootstrap completes", () => {
        renderApp();

        expect(screen.getByTestId("app-layout")).toBeInTheDocument();
        expect(screen.getByTestId("app-routes")).toBeInTheDocument();

        expect(layoutProps.isCollapsed).toBe(true);
        expect(layoutProps.isSmallScreen).toBe(false);
        expect(layoutProps.toggleSidebar).toBe(h.toggleSidebar);
        expect(typeof layoutProps.sidebarProps.colorMode).toBe("string");
        expect(typeof layoutProps.sidebarProps.toggleColorMode).toBe("function");

        expect(routesProps.setPatient).toBe(h.setPatient);
        expect(routesProps.refreshSidebar).toEqual(expect.any(Function));
        expect(routesProps.onResetLetter).toBe(h.setResetLetter);
        expect(routesProps.onOpenNewNoteModal).toBe(h.openNewNoteModal);
        expect(routesProps.handleSelectPatient).toEqual(expect.any(Function));
    });

    it("renders the bootstrap gate instead of the app shell", () => {
        h.bootstrap.gate = <div data-testid="gate-marker" />;

        renderApp();

        expect(screen.getByTestId("gate-marker")).toBeInTheDocument();
        expect(screen.queryByTestId("app-layout")).not.toBeInTheDocument();
        expect(screen.queryByTestId("app-routes")).not.toBeInTheDocument();
    });

    it("renders a splash screen while initializing", () => {
        h.bootstrap.isInitializing = true;

        const { container } = renderApp();

        expect(container.querySelector(".splash-bg")).not.toBeNull();
        expect(screen.queryByTestId("app-layout")).not.toBeInTheDocument();
        expect(screen.queryByTestId("init-probe")).not.toBeInTheDocument();
    });

    it("publishes the bootstrap init state via AppInitContext", () => {
        renderApp();

        // App mounts with isInitializing=true, then syncs to bootstrap(false).
        expect(screen.getByTestId("init-probe")).toHaveAttribute(
            "data-initializing",
            "false",
        );
    });

    it("loads patient details when deep-linking to /note/:id", () => {
        renderApp(["/note/note-123"]);

        expect(h.handleLoadPatientDetails).toHaveBeenCalledWith(
            "note-123",
            expect.objectContaining({
                setPatient: h.setPatient,
                setSelectedDate: h.setSelectedDate,
                isFromOutstandingJobs: false,
                setIsFromOutstandingJobs: expect.any(Function),
            }),
        );
    });

    it("routes patient load errors to handleError", async () => {
        h.handleLoadPatientDetails.mockRejectedValueOnce(new Error("boom"));

        renderApp(["/note/note-x"]);

        await waitFor(() =>
            expect(h.handleError).toHaveBeenCalledWith(
                expect.objectContaining({ message: "boom" }),
            ),
        );
    });

    it("does not load patient details outside /note routes", () => {
        renderApp(["/"]);

        expect(h.handleLoadPatientDetails).not.toHaveBeenCalled();
    });

    it("guards navigation when selecting a patient", () => {
        renderApp(["/"]);

        act(() => {
            layoutProps.sidebarProps.onSelectPatient({ id: "p1" }, true);
        });

        expect(h.guardedNavigate).toHaveBeenCalledWith("/note/p1");
    });

    it("guards the new-patient action", () => {
        renderApp(["/"]);

        act(() => {
            layoutProps.sidebarProps.onNewPatient();
        });

        expect(h.guardedAction).toHaveBeenCalledWith(h.openNewNoteModal);
    });

    it("flags the selected patient only on note routes", () => {
        h.session.patient = { id: "p9" };

        renderApp(["/note/abc"]);
        expect(layoutProps.sidebarProps.selectedPatientId).toBe("p9");

        cleanup();
        renderApp(["/"]);
        expect(layoutProps.sidebarProps.selectedPatientId).toBeUndefined();
    });

    it("refreshSidebar invalidates only the SWR sidebar caches", () => {
        renderApp(["/"]);

        act(() => {
            routesProps.refreshSidebar();
        });

        expect(h.mutate).toHaveBeenCalledTimes(1);
        const filter = h.mutate.mock.calls[0][0];
        expect(filter(["noteList", {}])).toBe(true);
        expect(filter(["incompleteJobsCount"])).toBe(true);
        expect(filter(["patientList"])).toBe(false);
        expect(filter("noteList")).toBe(false);
    });

    it("wires the new-note modal to the flow", () => {
        h.flow.isNewNoteOpen = true;

        renderApp(["/"]);

        expect(screen.getByTestId("new-note-modal")).toBeInTheDocument();
        expect(modalProps.isOpen).toBe(true);
        expect(modalProps.onClose).toBe(h.closeNewNoteModal);
        expect(modalProps.onComplete).toBe(h.completeNewNote);
        expect(modalProps.setPatient).toBe(h.setPatient);
        expect(modalProps.createNewPatient).toBe(h.createNewPatient);
        expect(modalProps.findPatients).toBe(h.findPatients);
        expect(modalProps.loadSelectedPatient).toBe(h.loadSelectedPatient);
    });

    it("keeps the new-note modal closed by default", () => {
        renderApp(["/"]);

        expect(screen.queryByTestId("new-note-modal")).not.toBeInTheDocument();
        expect(modalProps.isOpen).toBe(false);
    });

    it("wires the unsaved-changes confirm dialog", () => {
        h.nav.isLeaveOpen = true;

        renderApp(["/"]);

        expect(screen.getByTestId("dialog-title")).toHaveTextContent(
            "Confirm Navigation",
        );
        expect(screen.getByTestId("dialog-body")).toHaveTextContent(
            "Are you sure you want to leave this page?",
        );
        expect(screen.getByTestId("dialog-confirm")).toHaveTextContent("Leave");
        expect(dialogProps.onConfirm).toBe(h.confirmNavigation);
        expect(dialogProps.onClose).toBe(h.cancelNavigation);
    });
});

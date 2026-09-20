import { useState, useEffect, useCallback } from "react";
import { authApi } from "../api/authApi";
import { isTauri } from "../helpers/apiConfig";

const STORAGE_KEY = "phlox-patient-scope";

// Admin "all vs mine" patient scope, persisted across sessions.
// Desktop (Tauri) is always single-admin, so the toggle is hidden, the
// identity fetch is skipped entirely, and the scope is pinned to "all".
export const usePatientScope = () => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [patientScope, setPatientScopeState] = useState(() =>
        isTauri() ? "all" : localStorage.getItem(STORAGE_KEY) || "mine",
    );

    useEffect(() => {
        if (isTauri()) {
            return;
        }
        authApi
            .fetchMe()
            .then((me) => setIsAdmin(me?.role === "admin"))
            .catch(() => setIsAdmin(false)); // fail-closed
    }, []);

    const setPatientScope = useCallback((scope) => {
        if (!isTauri()) {
            localStorage.setItem(STORAGE_KEY, scope);
        }
        setPatientScopeState(scope);
    }, []);

    return { isAdmin, patientScope, setPatientScope };
};

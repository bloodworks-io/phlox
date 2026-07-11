import { useState, useEffect, useCallback } from "react";
import { toaster } from "@/components/ui/toaster";
import { invoke } from "@tauri-apps/api/core";
import SplashScreen from "../../components/common/SplashScreen";
import EncryptionSetup from "../../components/setup/EncryptionSetup";
import EncryptionUnlock from "../../components/setup/EncryptionUnlock";
import ServerStartupLoader from "../../components/setup/ServerStartupLoader";
import { settingsService } from "../../utils/settings/settingsUtils";
import { isTauri } from "../../utils/helpers/apiConfig";
import { setEmbeddingReady } from "../../utils/helpers/featureFlags";
import { encryptionApi } from "../../utils/api/encryptionApi";

export const useAppBootstrap = () => {
    const [showSplashScreen, setShowSplashScreen] = useState(undefined);
    const [isLoadingSplashCheck, setIsLoadingSplashCheck] = useState(true);
    const [, setEncryptionStatus] = useState(null);
    const [showEncryptionSetup, setShowEncryptionSetup] = useState(false);
    const [showEncryptionUnlock, setShowEncryptionUnlock] = useState(false);
    const [, setIsLoadingEncryptionCheck] = useState(true);
    const [showServerStartupLoader, setShowServerStartupLoader] =
        useState(false);
    const [isInGracePeriod, setIsInGracePeriod] = useState(true);

    // App initialization state - true when server is not ready yet.
    const isInitializing =
        showEncryptionSetup ||
        showEncryptionUnlock ||
        showServerStartupLoader ||
        isInGracePeriod;

    const checkSplashStatus = useCallback(async (options = {}) => {
        const { maxRetries = 5, retryDelay = 500 } = options;
        let lastError;
        let success = false;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await settingsService.fetchUserSettings((userData) => {
                    if (
                        userData &&
                        typeof userData.has_completed_splash_screen ===
                            "boolean"
                    ) {
                        setShowSplashScreen(
                            !userData.has_completed_splash_screen,
                        );
                    } else {
                        setShowSplashScreen(true); // Default to showing splash if flag is missing/invalid
                    }
                });
                // Success - exit the retry loop
                success = true;
                break;
            } catch (error) {
                console.warn(
                    `Error checking splash screen status (attempt ${attempt + 1}/${maxRetries}):`,
                    error,
                );
                lastError = error;
                // Wait before retrying (except on the last attempt)
                if (attempt < maxRetries - 1) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, retryDelay),
                    );
                }
            }
        }

        if (!success) {
            // All retries failed
            console.error(
                "Error checking splash screen status after retries:",
                lastError,
            );
            setShowSplashScreen(true); // Default to showing splash on error
        }

        setIsLoadingSplashCheck(false);
    }, []);

    // Only check splash status on mount if NOT in Tauri
    // In Tauri, we wait until after encryption unlock is complete
    useEffect(() => {
        if (!isTauri()) {
            checkSplashStatus();
        } else {
            setIsLoadingSplashCheck(false);
        }
    }, [checkSplashStatus]);

    // In non-Tauri environments, disable grace period immediately since the server is already running
    useEffect(() => {
        if (!isTauri()) {
            console.log("Non-Tauri environment detected");
            setIsInGracePeriod(false);
        }
    }, []);

    const handleSplashComplete = () => {
        setShowSplashScreen(false);
    };

    useEffect(() => {
        if (!isTauri()) {
            setIsLoadingEncryptionCheck(false);
            return;
        }

        const checkEncryptionStatus = async () => {
            try {
                const status = await encryptionApi.getStatus();
                setEncryptionStatus(status);

                if (!status.has_setup && !status.has_database) {
                    setShowEncryptionSetup(true);
                } else if (status.has_setup && !status.has_keychain) {
                    try {
                        await invoke("start_server_command");
                        console.log(
                            "Server started in warm mode, waiting for passphrase",
                        );
                    } catch (e) {
                        console.warn("Failed to warm start server:", e);
                    }
                    setShowEncryptionUnlock(true);
                }
            } catch (error) {
                console.error("Error checking encryption status:", error);
            } finally {
                setIsLoadingEncryptionCheck(false);
            }
        };

        checkEncryptionStatus();
    }, []);

    const handleEncryptionSetupComplete = () => {
        setShowEncryptionSetup(false);
        setShowServerStartupLoader(true);
    };

    const handleEncryptionUnlockComplete = () => {
        setShowEncryptionUnlock(false);
        setShowServerStartupLoader(true);
    };

    const handleServerReady = () => {
        setShowServerStartupLoader(false);
        checkSplashStatus({ maxRetries: 3, retryDelay: 300 });

        // Sync embedding model status for RAG feature flag (Tauri only)
        if (isTauri()) {
            import("../../utils/api/localModelApi").then(({ localModelApi }) => {
                localModelApi.fetchDownloadedEmbeddingModels()
                    .then((res) => {
                        const has = (res?.models || []).some(
                            (m) => m.id === "granite-embedding",
                        );
                        setEmbeddingReady(has);
                    })
                    .catch(() => {});
            });
        }

        setTimeout(() => {
            setIsInGracePeriod(false);
        }, 2000); // 2 second grace period
    };

    const handleServerError = (error) => {
        console.error("Server startup error:", error);
        setShowServerStartupLoader(false);
        // Show error toast
        toaster.create({
            title: "Server Error",
            description: error.message || "Failed to start the server",
            type: "error",
            duration: 5000,
        });
        // Go back to unlock screen
        setShowEncryptionUnlock(true);
    };

    let gate = null;
    if (isLoadingSplashCheck) {
        gate = null;
    } else if (showEncryptionSetup) {
        gate = <EncryptionSetup onComplete={handleEncryptionSetupComplete} />;
    } else if (showEncryptionUnlock) {
        gate = <EncryptionUnlock onComplete={handleEncryptionUnlockComplete} />;
    } else if (showServerStartupLoader) {
        gate = (
            <ServerStartupLoader
                onReady={handleServerReady}
                onError={handleServerError}
            />
        );
    } else if (showSplashScreen) {
        gate = <SplashScreen onComplete={handleSplashComplete} />;
    }

    return { isInitializing, gate };
};

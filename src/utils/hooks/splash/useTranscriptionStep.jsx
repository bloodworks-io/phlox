import { useState, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
import { toaster } from "@/components/ui/toaster";
import { SPLASH_STEPS } from "../../../components/common/splash/constants";
import { validateTranscriptionStep } from "../../../utils/splash/validators";
import { settingsService } from "../../../utils/settings/settingsUtils";
import { localModelApi } from "../../api/localModelApi";
import { downloadWhisperModel as downloadWhisperService } from "../../services/localModelService";
import { useDebounce } from "../useDebounce";
import { KEYS } from "../../cache/keys";

export const useTranscriptionStep = (currentStep, inferenceMode = "remote") => {

    // Remote mode state
    const [whisperBaseUrl, setWhisperBaseUrl] = useState(
        import.meta.env.VITE_WHISPER_BASE_URL || "http://localhost:8080",
    );
    const [whisperModel, setWhisperModel] = useState("");

    const debouncedWhisperBaseUrl = useDebounce(whisperBaseUrl, 500);

    const shouldFetchRemote =
        currentStep === SPLASH_STEPS.AI_MODELS &&
        inferenceMode === "remote" &&
        !!debouncedWhisperBaseUrl;

    const {
        data: whisperData,
        isValidating: isFetchingWhisperModels,
        mutate: mutateWhisperModels,
        error: whisperError,
    } = useSWR(
        shouldFetchRemote
            ? KEYS.whisperModels(inferenceMode, debouncedWhisperBaseUrl)
            : null,
        () =>
            new Promise((resolve) => {
                let models = [];
                let listAvailable = false;
                settingsService
                    .fetchWhisperModels(
                        debouncedWhisperBaseUrl,
                        (fetchedModels) => {
                            models = fetchedModels;
                        },
                        (isListAvailable) => {
                            listAvailable = isListAvailable;
                        },
                    )
                    .then(() => resolve({ models, listAvailable }))
                    .catch(() => resolve({ models: [], listAvailable: false }));
            }),
    );

    const availableWhisperModels = useMemo(
        () => whisperData?.models || [],
        [whisperData],
    );
    const whisperModelListAvailable = whisperData?.listAvailable || false;

    // Manual refetch hook for consumers
    const fetchWhisperModels = useCallback(() => {
        mutateWhisperModels();
    }, [mutateWhisperModels]);

    useEffect(() => {
        if (whisperError) {
            toaster.create({
                title: "Error fetching Whisper models",
                description:
                    whisperError.message ||
                    "Could not connect or provider returned an error.",
                type: "error",
                duration: 3000,
            });
        }
    }, [whisperError]);

    // Local mode state
    const [localWhisperModels, setLocalWhisperModels] = useState([]);
    const [downloadedWhisperModels, setDownloadedWhisperModels] = useState([]);
    const [localWhisperModel, setLocalWhisperModel] = useState(
        "omi-med-stt-v1-q8_0",
    );
    const [isDownloadingWhisper, setIsDownloadingWhisper] = useState(false);
    const [downloadingWhisperModelId, setDownloadingWhisperModelId] =
        useState(null);
    const [whisperDownloadProgress, setWhisperDownloadProgress] = useState(0);

    // Fetch local Whisper models
    const fetchLocalWhisperModels = useCallback(async () => {
        // Only fetch local models if in local mode
        if (inferenceMode === "remote") return;

        try {
            // Fetch available Whisper models
            const availableResponse =
                await localModelApi.fetchAvailableWhisperModels();
            setLocalWhisperModels(availableResponse.models || []);

            // Fetch downloaded Whisper models
            const downloadedResponse =
                await localModelApi.fetchDownloadedWhisperModels();
            setDownloadedWhisperModels(downloadedResponse.models || []);
        } catch (error) {
            console.error("Error fetching local Whisper models:", error);
            toaster.create({
                title: "Error fetching local Whisper models",
                description:
                    error.message ||
                    "Could not retrieve local Whisper model list.",
                type: "error",
                duration: 3000,
            });
        }
    }, [inferenceMode]);

    // Download local Whisper model
    const downloadWhisperModel = useCallback(
        async (modelId) => {
            setIsDownloadingWhisper(true);
            setDownloadingWhisperModelId(modelId);
            setWhisperDownloadProgress(0);

            try {
                await downloadWhisperService(modelId, {
                    onProgress: (progress) => {
                        if (progress.percentage !== undefined) {
                            setWhisperDownloadProgress(progress.percentage);
                        }
                    },
                });

                // Refresh downloaded models after completion
                await fetchLocalWhisperModels();
            } finally {
                setIsDownloadingWhisper(false);
                setDownloadingWhisperModelId(null);
                setWhisperDownloadProgress(0);
            }
        },
        [fetchLocalWhisperModels],
    );

    // Check if a Whisper model is downloaded
    const isWhisperModelDownloaded = useCallback(
        (modelId) => {
            return downloadedWhisperModels.some(
                (m) => m.id === modelId || m.name === modelId,
            );
        },
        [downloadedWhisperModels],
    );

    // Validate based on current mode
    const validate = useCallback(() => {
        if (inferenceMode === "local") {
            // Hard gate: the STT model must be downloaded before proceeding.
            return isWhisperModelDownloaded(localWhisperModel);
        } else {
            // For remote mode, use existing validation
            return validateTranscriptionStep(
                whisperBaseUrl,
                whisperModelListAvailable,
                availableWhisperModels,
                whisperModel,
            );
        }
    }, [
        inferenceMode,
        localWhisperModel,
        isWhisperModelDownloaded,
        whisperBaseUrl,
        whisperModelListAvailable,
        availableWhisperModels,
        whisperModel,
    ]);

    // Get data based on current mode
    const getData = useCallback(() => {
        if (inferenceMode === "local") {
            return {
                whisperBaseUrl: "", // Empty for local
                whisperModel: localWhisperModel,
            };
        } else {
            return {
                whisperBaseUrl,
                whisperModel,
            };
        }
    }, [inferenceMode, localWhisperModel, whisperBaseUrl, whisperModel]);

    // Local-mode fetch on step/mode change (remote is handled by useSWR)
    useEffect(() => {
        if (
            currentStep === SPLASH_STEPS.AI_MODELS &&
            inferenceMode === "local"
        ) {
            fetchLocalWhisperModels();
        }
    }, [fetchLocalWhisperModels, currentStep, inferenceMode]);

    return {
        // Remote mode
        whisperBaseUrl,
        setWhisperBaseUrl,
        whisperModel,
        setWhisperModel,
        availableWhisperModels,
        whisperModelListAvailable,
        isFetchingWhisperModels,
        fetchWhisperModels,

        // Local mode
        localWhisperModels,
        downloadedWhisperModels,
        localWhisperModel,
        setLocalWhisperModel,
        isDownloadingWhisper,
        downloadingWhisperModelId,
        whisperDownloadProgress,
        downloadWhisperModel,
        isWhisperModelDownloaded,

        // Shared
        validate,
        getData,
    };
};

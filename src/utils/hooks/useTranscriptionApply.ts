import { useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { handleProcessingComplete } from "../helpers/processingHelpers";
import type { Patient, TranscriptionResult } from "../patient/types";

interface UseTranscriptionApplyArgs {
    patient: Patient | null;
    setPatient: Dispatch<SetStateAction<Patient | null>>;
    hasTranscriptionOccurred: boolean;
    captureTranscription: (fields: Record<string, string>) => void;
    setIsSummaryModified: (value: boolean) => void;
    setLoading: (value: boolean) => void;
    setIsSummaryCollapsed: (collapsed: boolean) => void;
    summaryRef: RefObject<unknown>;
}

export const useTranscriptionApply = ({
    patient,
    setPatient,
    hasTranscriptionOccurred,
    captureTranscription,
    setIsSummaryModified,
    setLoading,
    setIsSummaryCollapsed,
    summaryRef,
}: UseTranscriptionApplyArgs) => {
    // Shadow copy of the pre-transcription raw text.
    const previousTranscriptionRef = useRef<string | null>(null);

    const handleTranscriptionComplete = (
        data: TranscriptionResult,
        triggerResize = false,
    ) => {
        const isRestoration = data.isRestoration === true;
        previousTranscriptionRef.current = patient?.raw_transcription ?? null;

        if (
            !hasTranscriptionOccurred &&
            data.fields &&
            Object.keys(data.fields).length > 0 &&
            !isRestoration
        ) {
            captureTranscription(data.fields);
        }

        if (!isRestoration) {
            setIsSummaryModified(true);
        }

        handleProcessingComplete(data, {
            setLoading,
            setters: {
                template_data: (_value) => {
                    setPatient((prev) => ({
                        ...prev,
                        template_data: {
                            ...prev.template_data,
                            ...data.fields,
                        },
                    }));
                },
                rawTranscription: (_value) =>
                    setPatient((prev) => ({
                        ...prev,
                        raw_transcription: data.rawTranscription,
                    })),
                transcriptionDuration: (_value) =>
                    setPatient((prev) => ({
                        ...prev,
                        transcription_duration: data.transcriptionDuration,
                    })),
                processDuration: (_value) =>
                    setPatient((prev) => ({
                        ...prev,
                        process_duration: data.processDuration,
                    })),
            },
            setIsSourceCollapsed: () => {},
            setIsSummaryCollapsed: () => setIsSummaryCollapsed(false),
            triggerResize,
            summaryRef,
        });
    };

    return { handleTranscriptionComplete };
};

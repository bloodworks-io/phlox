import { useCallback } from "react";
import { useDisclosure } from "@chakra-ui/react";
import useSWR from "swr";
import { toaster } from "@/components/ui/toaster";
import { patientApi } from "../api/patientApi";
import { DEFAULT_TOAST_CONFIG } from "../constants";
import { KEYS } from "../cache/keys";

const EMPTY_CONSENT = {
    scribe_consent_at: null,
    scribe_consent_declined_at: null,
};

export const useScribeConsent = ({
    urNumber,
    isAmbient,
    requiresConsentConfig,
    requiredDemographicsMet,
    startRecording,
    onRequireDemographics,
}) => {
    const { data: scribeConsent = EMPTY_CONSENT, mutate: mutateConsent } =
        useSWR(
            urNumber ? KEYS.scribeConsent(urNumber) : null,
            () => patientApi.fetchScribeConsent(urNumber),
        );
    const {
        open: isConsentOpen,
        onOpen: onOpenConsent,
        onClose: onCloseConsent,
    } = useDisclosure();

    const hasConsented = Boolean(scribeConsent?.scribe_consent_at);
    const hasDeclined =
        Boolean(scribeConsent?.scribe_consent_declined_at) && !hasConsented;
    const requireConsent = isAmbient && requiresConsentConfig;
    const canRecord =
        requiredDemographicsMet && !(requireConsent && !hasConsented);

    const handleBlockedRecord = useCallback(() => {
        if (!requiredDemographicsMet) {
            onRequireDemographics?.();
            return;
        }
        onOpenConsent();
    }, [requiredDemographicsMet, onRequireDemographics, onOpenConsent]);

    const handleConsentGranted = useCallback(async () => {
        if (!urNumber) return;
        try {
            const data = await patientApi.saveScribeConsent(urNumber, true);
            mutateConsent(data, { revalidate: false });
            onCloseConsent();
            await startRecording();
        } catch (error) {
            toaster.create({
                title: "Could not record consent",
                description: error.message,
                type: "error",
                ...DEFAULT_TOAST_CONFIG,
            });
        }
    }, [urNumber, onCloseConsent, startRecording, mutateConsent]);

    const handleConsentDeclined = useCallback(async () => {
        if (!urNumber) return;
        try {
            const data = await patientApi.saveScribeConsent(urNumber, false);
            mutateConsent(data, { revalidate: false });
            onCloseConsent();
        } catch (error) {
            toaster.create({
                title: "Could not record decision",
                description: error.message,
                type: "error",
                ...DEFAULT_TOAST_CONFIG,
            });
        }
    }, [urNumber, onCloseConsent, mutateConsent]);

    return {
        consent: scribeConsent,
        hasConsented,
        hasDeclined,
        canRecord,
        isConsentOpen,
        onCloseConsent,
        handleBlockedRecord,
        handleConsentGranted,
        handleConsentDeclined,
    };
};

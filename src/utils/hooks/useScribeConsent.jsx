import { useState, useEffect, useCallback } from "react";
import { useDisclosure } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { patientApi } from "../api/patientApi";
import { DEFAULT_TOAST_CONFIG } from "../constants";

export const useScribeConsent = ({
    urNumber,
    isAmbient,
    requiresConsentConfig,
    requiredDemographicsMet,
    startRecording,
    onRequireDemographics,
}) => {
    const [scribeConsent, setScribeConsent] = useState({
        scribe_consent_at: null,
        scribe_consent_declined_at: null,
    });
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

    // Fetch consent whenever ur_number changes
    useEffect(() => {
        if (!urNumber) {
            setScribeConsent({
                scribe_consent_at: null,
                scribe_consent_declined_at: null,
            });
            return;
        }
        let active = true;
        setScribeConsent({
            scribe_consent_at: null,
            scribe_consent_declined_at: null,
        });
        patientApi
            .fetchScribeConsent(urNumber)
            .then((data) => {
                if (active) setScribeConsent(data);
            })
            .catch((error) =>
                console.error("Error fetching scribe consent:", error),
            );
        return () => {
            active = false;
        };
    }, [urNumber]);

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
            setScribeConsent(data);
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
    }, [urNumber, onCloseConsent, startRecording]);

    const handleConsentDeclined = useCallback(async () => {
        if (!urNumber) return;
        try {
            const data = await patientApi.saveScribeConsent(urNumber, false);
            setScribeConsent(data);
            onCloseConsent();
        } catch (error) {
            toaster.create({
                title: "Could not record decision",
                description: error.message,
                type: "error",
                ...DEFAULT_TOAST_CONFIG,
            });
        }
    }, [urNumber, onCloseConsent]);

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

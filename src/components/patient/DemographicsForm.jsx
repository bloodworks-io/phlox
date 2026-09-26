import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HStack, VStack, Box, Text, Input, NativeSelect, Button, Icon, Spinner } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { FaFileUpload } from "react-icons/fa";
import { transcriptionApi } from "../../utils/api/transcriptionApi";
import { extractFromFile } from "../../utils/helpers/documentExtraction";
import { areRequiredDemographicsMet } from "../../utils/helpers/validationHelpers";

const Field = ({ label, required, children }) => (
    <Box flex={1} minW="0">
        <Text fontSize="sm" fontWeight="bold" mb={1}>
            {label}
            {required && (
                <Text as="span" color="dangerButton" ml={1}>
                    *
                </Text>
            )}
        </Text>
        {children}
    </Box>
);

const DemographicsForm = ({
    patient,
    setPatient,
    onSave,
    onSaved,
    onCancel,
    saveLabel,
    cancelLabel,
    cancelIcon = null,
}) => {
    const { t } = useTranslation();
    const [form, setForm] = useState(() => patient
        ? {
            first_name: patient.first_name || "",
            last_name: patient.last_name || "",
            dob: patient.dob || "",
            gender: patient.gender || "",
            ur_number: patient.ur_number || "",
            address: patient.address || "",
            phone: patient.phone || "",
        }
        : {});
    const [isDragOver, setIsDragOver] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractError, setExtractError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    // Keys auto-filled by document extraction — flashed briefly so the
    // user can see which fields the AI populated.
    const [flashedKeys, setFlashedKeys] = useState(() => new Set());
    const flashTimer = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => () => clearTimeout(flashTimer.current), []);

    const inputClass = (key) =>
        `input-style${flashedKeys.has(key) ? " live-field-updated" : ""}`;

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const handleFile = async (file) => {
        if (!file) return;
        setIsExtracting(true);
        setExtractError(null);
        try {
            const data = await extractFromFile(
                file,
                {
                    fromText: transcriptionApi.extractDemographicsFromText,
                    visual: transcriptionApi.extractDemographicsVisual,
                    legacyFile: (formData) =>
                        transcriptionApi.extractDemographics(formData),
                },
                {},
            );
            // Merge only the fields the model returned (others left untouched).
            if (data && typeof data === "object") {
                const keys = new Set(Object.keys(data));
                setForm((prev) => ({ ...prev, ...data }));
                setFlashedKeys(keys);
                clearTimeout(flashTimer.current);
                flashTimer.current = setTimeout(
                    () => setFlashedKeys(new Set()),
                    1800,
                );
            }
        } catch (error) {
            setExtractError(
                error?.message ||
                    t("patient.extractDemographicsFailed"),
            );
        } finally {
            setIsExtracting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
    };
    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const requiredMet = areRequiredDemographicsMet(form);

    const handleSave = async () => {
        const first = (form.first_name || "").trim();
        const last = (form.last_name || "").trim();
        const name = last && first ? `${last}, ${first}` : last || first;
        const updated = {
            ...patient,
            first_name: first,
            last_name: last,
            name,
            dob: form.dob || "",
            gender: form.gender || "",
            ur_number: form.ur_number || "",
            address: form.address || "",
            phone: form.phone || "",
        };
        setPatient(updated);
        if (onSave) {
            setIsSaving(true);
            try {
                await onSave(updated);
            } catch {
                toaster.create({
                    title: t("patient.saveDemographicsFailed"),
                    description: t("patient.tryAgain"),
                    type: "error",
                    duration: 3000,
                });
                setIsSaving(false);
                return;
            }
            setIsSaving(false);
        }
        if (onSaved) onSaved(updated);
    };

    const btnSx = {
        fontFamily: '"Space Grotesk", sans-serif',
        fontWeight: "600",
    };

    return (
        <VStack gap={4} align="stretch">
            {/* Document drop zone — auto-fills fields from a referral/ID/etc. */}
            <Box
                position="relative"
                borderRadius="md"
                border="2px dashed"
                borderColor={isDragOver ? "accent" : "surface"}
                bg={isDragOver ? "rgba(66, 153, 225, 0.15)" : "transparent"}
                p={3}
                textAlign="center"
                cursor="pointer"
                transition="all 0.15s"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <Input
                    type="file"
                    ref={fileInputRef}
                    accept=".pdf,.txt,image/*"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                    display="none"
                />
                <HStack
                    gap={2}
                    justify="center"
                    color={"textSecondary"}
                    fontSize="sm"
                >
                    <Icon asChild><FaFileUpload /></Icon>
                    <Text>
                        {isExtracting
                            ? t("patient.readingDocument")
                            : t("patient.dropDocumentHint")}
                    </Text>
                    {isExtracting && <Spinner size="xs" />}
                </HStack>
                {extractError && (
                    <Text
                        fontSize="xs"
                        color="dangerButton"
                        mt={1}
                        className="anim-fade-slide-up"
                        css={{ animationDuration: "0.15s" }}
                    >
                        {extractError}
                    </Text>
                )}
            </Box>
            <HStack gap={3} align="flex-start">
                <Field label={t("patient.firstName")} required>
                    <Input
                        className={inputClass("first_name")}
                        size="sm"
                        placeholder={t("patient.firstName")}
                        autoFocus
                        value={form.first_name || ""}
                        onChange={(e) => set("first_name", e.target.value)}
                    />
                </Field>
                <Field label={t("patient.lastName")} required>
                    <Input
                        className={inputClass("last_name")}
                        size="sm"
                        placeholder={t("patient.lastName")}
                        value={form.last_name || ""}
                        onChange={(e) => set("last_name", e.target.value)}
                    />
                </Field>
            </HStack>
            <HStack gap={3} align="flex-start">
                <Field label={t("patient.dateOfBirth")} required>
                    <Input
                        type="date"
                        className={inputClass("dob")}
                        size="sm"
                        value={form.dob || ""}
                        onChange={(e) => set("dob", e.target.value)}
                    />
                </Field>
                <Field label={t("patient.gender")}>
                    <NativeSelect.Root>
                        <NativeSelect.Field
                            className={inputClass("gender")}
                            size="sm"
                            value={form.gender || ""}
                            onChange={(e) => set("gender", e.target.value)}>
                            <option value="">M/F</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>
                </Field>
            </HStack>
            <HStack gap={3} align="flex-start">
                <Field label={t("patient.urNumber")} required>
                    <Input
                        className={inputClass("ur_number")}
                        size="sm"
                        placeholder={t("patient.urNumber")}
                        value={form.ur_number || ""}
                        onChange={(e) => set("ur_number", e.target.value)}
                    />
                </Field>
                <Field label={t("patient.phone")}>
                    <Input
                        className={inputClass("phone")}
                        size="sm"
                        placeholder={t("patient.phone")}
                        value={form.phone || ""}
                        onChange={(e) => set("phone", e.target.value)}
                    />
                </Field>
            </HStack>
            <Field label={t("patient.address")}>
                <Input
                    className={inputClass("address")}
                    size="sm"
                    placeholder={t("patient.address")}
                    value={form.address || ""}
                    onChange={(e) => set("address", e.target.value)}
                />
            </Field>
            <HStack justify="space-between" width="100%" mt={2}>
                {onCancel && (
                    <Button
                        onClick={onCancel}
                        size="md"
                        borderRadius="2xl"
                        className="switch-mode"
                        css={btnSx}>{cancelIcon || undefined}{cancelLabel ?? t("action.cancel")}</Button>
                )}
                <Button
                    onClick={handleSave}
                    disabled={!requiredMet}
                    loading={isSaving}
                    size="md"
                    borderRadius="2xl"
                    className="green-button"
                    css={btnSx}
                >
                    {saveLabel ?? t("action.save")}
                </Button>
            </HStack>
        </VStack>
    );
};

export default DemographicsForm;

import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, Flex, Text, Collapsible, HStack, NativeSelect, VStack, Center, Spinner, IconButton } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from '@/components/ui/tooltip';
import {
  EditIcon,
  CopyIcon,
  CheckIcon,
} from "../common/icons";
import { FaSave, FaFileAlt, FaThumbtack, FaCheckDouble, FaEnvelopeOpenText, FaExclamationCircle } from "react-icons/fa";
import { GreenButton, GreyButton } from "../common/Buttons";
import { useTemplateSelection } from "../../utils/templates/templateContext";
import { useTemplateChange } from "../../utils/hooks/useTemplateChange";
import ConfirmDialog from "../common/ConfirmDialog";
import AgentEditDiffMarker from "./AgentEditDiffMarker";
import GroundedTextarea from "./GroundedTextarea";
import { citationKey } from "../../utils/patient/citations";
import { isFullyUnverified, matchCitationsToLines } from "../../utils/patient/citationMatching";
import type { Patient } from "../../utils/patient/types";

interface SummaryProps {
  isSummaryCollapsed: boolean;
  patient: Patient;
  setPatient: Dispatch<SetStateAction<Patient | null>>;
  handleGenerateLetterClick: (letterTemplateKey: string | null) => void;
  handleSavePatientData: (event?: React.FormEvent) => void | Promise<void>;
  saveLoading?: boolean;
  onWrapUp: () => void;
  wrapUpLoading?: boolean;
  setIsModified: (value: boolean) => void;
  onCopy: () => void;
  recentlyCopied?: boolean;
  isNewPatient?: boolean;
  isUngeneratedNote?: boolean;
  onGenerateNote?: () => void | Promise<void>;
  generateLoading?: boolean;
  selectTemplate: (templateKey: string) => void;
  isSearchedPatient?: boolean;
  isEncounterSaved?: boolean;
  liveUpdatedFields?: Record<string, number>;
  agentEdits?: Record<string, string>;
  agentBaselines?: Record<string, string>;
  onCiteLine?: (lineIndex: number) => void;
}

export interface SummaryHandle {
  resizeTextarea: () => void;
}

const Summary = forwardRef<SummaryHandle, SummaryProps>(
  (
    {
      isSummaryCollapsed,
      patient,
      setPatient,
      handleGenerateLetterClick,
      handleSavePatientData,
      saveLoading,
      onWrapUp,
      wrapUpLoading,
      setIsModified,
      onCopy,
      recentlyCopied,
      isNewPatient,
      isUngeneratedNote = false,
      onGenerateNote,
      generateLoading = false,
      selectTemplate,
      isSearchedPatient,
      isEncounterSaved = false,
      liveUpdatedFields = {},
      agentEdits = {},
      agentBaselines = {},
      onCiteLine,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const {
      currentTemplate,
      templates,
      status: templateStatus,
    } = useTemplateSelection();

    const textareasRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
    // Fields edited locally since mount — clears the agent-edit review marker.
    const [clinicianEdited, setClinicianEdited] = useState<Set<string>>(
      new Set(),
    );

    const {
        isChangeModalOpen: isTemplateChangeModalOpen,
        requestTemplateChange,
        cancelTemplateChange,
        confirmTemplateChange,
    } = useTemplateChange({ patient, setPatient, selectTemplate });

    const handleTemplateChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newTemplateKey = e.target.value;

      if (!isNewPatient && !isSearchedPatient && !isUngeneratedNote) {
        toaster.create({
          title: t("patient.templateLocked"),
          description: t("patient.templateLockedDescription"),
          type: "warning",
          duration: 3000,
        });
        return;
      }

      requestTemplateChange(newTemplateKey);
    };

    const handleTemplateDataChange = (fieldKey: string, value: string) => {
      setPatient((prev) => ({
        ...prev,
        template_data: {
          ...prev.template_data,
          [fieldKey]: value,
        },
      }));
      setIsModified(true);
      setClinicianEdited((prev) => {
        if (prev.has(fieldKey)) return prev;
        const next = new Set(prev);
        next.add(fieldKey);
        return next;
      });
    };

    const handleDismissCitation = (fieldKey: string, lineIndex: number) => {
      setPatient((prev) => {
        const citations = prev?.note_citations;
        if (!citations) return prev;
        const key = citationKey(fieldKey, lineIndex);
        if (citations.resolved.includes(key)) return prev;
        return {
          ...prev,
          note_citations: {
            ...citations,
            resolved: [...citations.resolved, key],
          },
        };
      });
    };

    const rawText = patient.raw_transcription ?? "";
    const citationsActive =
      patient.note_citations != null &&
      patient.note_citations.transcript_line_count === rawText.split("\n").length;

    const renderField = (field) => {
      const fieldValue = patient.template_data?.[field.field_key] || "";
      const fieldCitations = citationsActive
        ? patient.note_citations?.fields?.[field.field_key]
        : undefined;
      const fieldFullyUnverified = fieldCitations
        ? isFullyUnverified(matchCitationsToLines(fieldValue, fieldCitations))
        : false;
      const unverifiedMarker = fieldFullyUnverified ? (
        <Tooltip
          content={t("patient.fieldUnverifiedBanner")}
          showArrow
          positioning={{
            placement: "right"
          }}
        >
          <Box
            as="span"
            className="cohesive-agent-edit-marker"
            aria-label={t("patient.fieldUnverifiedBanner")}
          >
            <FaExclamationCircle />
          </Box>
        </Tooltip>
      ) : null;

      const persistentMarker = field.persistent ? (
        <Tooltip
          content={t("patient.persistsBetweenEncounters")}
          showArrow
          positioning={{
            placement: "right"
          }}
        >
          <Box as="span" className="cohesive-persistent-marker">
            <FaThumbtack />
          </Box>
        </Tooltip>
      ) : null;

      // Persistent field last written by the live agent and not re-edited
      // locally — flag it so the howler is reviewed before it persists
      // into future encounters.
      const agentEdited =
        field.persistent &&
        agentEdits[field.field_key] === "agent" &&
        !clinicianEdited.has(field.field_key);
      const agentEditMarker = agentEdited ? (
        <AgentEditDiffMarker
          fieldLabel={field.field_name}
          before={agentBaselines[field.field_key]}
          after={fieldValue}
        />
      ) : null;

      // Live agent update flash: re-mounts on each new timestamp so the
      // one-shot animation replays when the agent edits the field.
      const liveFlash = liveUpdatedFields[field.field_key];

      return (
        <Box
          key={`${field.field_key}-${liveFlash || "static"}`}
          className={`cohesive-field${liveFlash ? " live-field-updated" : ""}`}
        >
          <Text className="cohesive-field-label">
            {field.field_name}:{persistentMarker}{agentEditMarker}{unverifiedMarker}
          </Text>
          <GroundedTextarea
            placeholder={t("patient.enterTextPlaceholder")}
            value={fieldValue}
            onChange={(e) => {
              handleTemplateDataChange(field.field_key, e.target.value);
            }}
            className="cohesive-textarea"
            textareaRef={(el) => {
              textareasRefs.current[field.field_key] = el;
            }}
            fieldKey={field.field_key}
            citations={fieldCitations && !fieldFullyUnverified ? fieldCitations : undefined}
            rawTranscription={patient.raw_transcription}
            resolved={patient.note_citations?.resolved}
            onDismiss={handleDismissCitation}
            onCiteLine={onCiteLine}
          />
        </Box>
      );
    };

    useImperativeHandle(ref, () => ({
      resizeTextarea: () => {
        Object.values(textareasRefs.current).forEach((textarea) => {
          if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
          }
        });
      },
    }));

    if (templateStatus === "loading") {
      return (
        <Box p="4" borderRadius="sm" className="panels-bg">
          <Center mt={4}>
            <Spinner size="sm" animationDuration="0.65s" />
            <Text ml={2}>{t("patient.loadingTemplate")}</Text>
          </Center>
        </Box>
      );
    }

    return (
      <>
        <Box p={[2, 3, 4]} borderRadius="sm" className="panels-bg">
          <Flex align="center" justify="space-between">
            <Flex align="center">
              <HStack gap={2}>
                <EditIcon size="1.2em" />
                <Text as="h3">{t("patient.noteHeading")}</Text>
              </HStack>
            </Flex>
            <Tooltip
              content={
                isNewPatient
                  ? t("patient.selectTemplate")
                  : t("patient.templateLockedDescription")
              }
              aria-label={t("patient.templateSelectorLabel")}
            >
              <Box>
                <Flex alignItems="center">
                  <FaFileAlt
                    style={{ marginRight: "8px" }}
                    className="pill-box-icons"
                  />
                  <NativeSelect.Root
                    size="sm"
                    disabled={!(isNewPatient || isUngeneratedNote)}
                  >
                    <NativeSelect.Field
                      placeholder={t("patient.selectTemplate")}
                      value={
                        currentTemplate?.template_key ||
                        patient?.template_key ||
                        ""
                      }
                      onChange={handleTemplateChange}
                      width={["100px", "150px", "200px"]}
                      className="input-style">
                      {/* Show "Historical Template" only for viewing historical encounters */}
                      {!isNewPatient &&
                        !isSearchedPatient &&
                        patient?.template_key &&
                        !templates?.some(
                          (tpl) => tpl.template_key === patient.template_key,
                        ) && (
                          <option value={patient.template_key}>
                            {t("patient.historicalTemplate")}
                          </option>
                        )}
                      {templates?.map((tpl) => (
                        <option key={tpl.template_key} value={tpl.template_key}>
                          {tpl.template_name}
                        </option>
                      ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  {isUngeneratedNote && onGenerateNote && (
                    <Button
                      size="sm"
                      className="green-button"
                      loading={generateLoading}
                      onClick={onGenerateNote}
                      ml={2}
                    >
                      {t("patient.generateNote")}
                    </Button>
                  )}
                </Flex>
              </Box>
            </Tooltip>
          </Flex>

          <Collapsible.Root open={!isSummaryCollapsed}>
            <Collapsible.Content>
              <Box mt="4" className="cohesive-fields-container">
                <VStack gap="0" align="stretch">
                  {currentTemplate?.fields?.map(renderField)}
                </VStack>
              </Box>
              <Flex mt="4" justifyContent="space-between" align="center">
                <Flex gap={2}>
                  <Tooltip
                    content={t("patient.copyNoteTooltip")}
                    positioning={{ placement: "top" }}
                  >
                    <Box>
                      <IconButton
                        onClick={onCopy}
                        aria-label={t("patient.copyNoteLabel")}
                        variant="outline"
                        borderColor="surface"
                        bg="transparent"
                        color="fg.muted"
                        borderRadius="full"
                        css={{
                          width: "35px !important",
                          height: "35px !important",
                          minWidth: "35px !important",
                          padding: "0 !important",
                        }}
                        _hover={{ bg: "surface", color: "fg" }}
                      >
                        {recentlyCopied ? (
                          <CheckIcon
                            className="anim-fade-scale"
                            css={{ animationDuration: "0.2s" }}
                          />
                        ) : (
                          <CopyIcon />
                        )}
                      </IconButton>
                    </Box>
                  </Tooltip>
                  <Tooltip
                    content={
                      isEncounterSaved
                        ? t("patient.generateLetterTooltip")
                        : t("patient.saveFirstLetterTooltip")
                    }
                    positioning={{ placement: "top" }}
                  >
                    <Box>
                      <IconButton
                        onClick={() => handleGenerateLetterClick(null)}
                        aria-label={t("patient.generateLetterLabel")}
                        variant="outline"
                        borderColor="surface"
                        bg="transparent"
                        color="fg.muted"
                        borderRadius="full"
                        css={{
                          width: "35px !important",
                          height: "35px !important",
                          minWidth: "35px !important",
                          padding: "0 !important",
                        }}
                        disabled={saveLoading || !isEncounterSaved}
                        _hover={{ bg: "surface", color: "fg" }}
                      >
                        <FaEnvelopeOpenText />
                      </IconButton>
                    </Box>
                  </Tooltip>
                </Flex>
                <Flex align="center">
                  <Tooltip
                    content={t("patient.saveEncounterTooltip")}
                    positioning={{ placement: "top" }}
                  >
                    <Box>
                      <GreyButton
                        onClick={handleSavePatientData}
                        loading={saveLoading}
                        loadingText={t("patient.saving")}
                        mr="2"
                        leftIcon={saveLoading ? null : <FaSave />}
                      >
                        {saveLoading ? t("patient.savingOngoing") : t("action.save")}
                      </GreyButton>
                    </Box>
                  </Tooltip>
                  <Tooltip
                    content={t("patient.wrapUpTooltip")}
                    positioning={{ placement: "top" }}
                  >
                    <Box>
                      <GreenButton
                        onClick={onWrapUp}
                        loading={wrapUpLoading}
                        loadingText={t("patient.wrapping")}
                        ml="2"
                        leftIcon={wrapUpLoading ? null : <FaCheckDouble />}
                        disabled={saveLoading}
                      >
                        {wrapUpLoading ? t("patient.wrappingOngoing") : t("patient.wrapUp")}
                      </GreenButton>
                    </Box>
                  </Tooltip>
                </Flex>
              </Flex>
            </Collapsible.Content>
          </Collapsible.Root>
        </Box>
        <ConfirmDialog
          isOpen={isTemplateChangeModalOpen}
          onClose={cancelTemplateChange}
          onConfirm={confirmTemplateChange}
          title={t("patient.templateChangeTitle")}
          body={t("patient.templateChangeBody")}
          confirmLabel={t("patient.templateChangeConfirm")}
          cancelLabel={t("action.cancel")}
        />
      </>
    );
  },
);

export default Summary;

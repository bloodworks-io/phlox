import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useTranslation } from "react-i18next";
import TextareaAutosize from "react-textarea-autosize";
import { Box, Flex, Text, Collapsible, HStack, NativeSelect, VStack, Center, Spinner, IconButton } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { Tooltip } from '@/components/ui/tooltip';
import {
  EditIcon,
  CopyIcon,
  CheckIcon,
} from "../common/icons";
import { FaSave, FaFileAlt, FaThumbtack, FaCheckDouble, FaEnvelopeOpenText } from "react-icons/fa";
import { GreenButton, GreyButton } from "../common/Buttons";
import { useTemplateSelection } from "../../utils/templates/templateContext";
import { getTemplateFamilyBase } from "../../utils/templates/templateService";
import { patientApi } from "../../utils/api/patientApi";
import ConfirmDialog from "../common/ConfirmDialog";

const Summary = forwardRef(
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
      selectTemplate,
      isSearchedPatient,
      isEncounterSaved = false,
      liveUpdatedFields = {},
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const {
      currentTemplate,
      templates,
      status: templateStatus,
    } = useTemplateSelection();

    const textareasRefs = useRef({});
    const [isTemplateChangeModalOpen, setIsTemplateChangeModalOpen] =
      useState(false);
    const [pendingTemplateKey, setPendingTemplateKey] = useState(null);

    const handleTemplateChange = async (e) => {
      const newTemplateKey = e.target.value;

      if (!isNewPatient && !isSearchedPatient) {
        toaster.create({
          title: t("patient.templateLocked"),
          description: t("patient.templateLockedDescription"),
          type: "warning",
          duration: 3000,
        });
        return;
      }

      setPendingTemplateKey(newTemplateKey);
      setIsTemplateChangeModalOpen(true);
    };

    const confirmTemplateChange = async () => {
      console.log("confirmTemplateChange called", {
        ur_number: patient?.ur_number,
        pendingTemplateKey,
      });

      // If patient has a UR number, fetch persistent fields for the new template type
      if (patient?.ur_number) {
        try {

          const baseTemplateKey = getTemplateFamilyBase(pendingTemplateKey);
          console.log("Fetching history for template:", baseTemplateKey);

          const history = await patientApi.fetchPatientHistoryByTemplate(
            patient.ur_number,
            baseTemplateKey,
          );

          console.log("History result:", history);

          if (history && history.length > 0) {
            // Merge persistent fields from most recent note of this type
            const mostRecent = history[0];
            setPatient((prev) => ({
              ...prev,
              template_key: pendingTemplateKey,
              template_data: {
                ...mostRecent.template_data,
              },
            }));
            setIsTemplateChangeModalOpen(false);
            await selectTemplate(pendingTemplateKey);
            return;
          }
        } catch (error) {
          console.error("Error fetching history for template:", error);
        }
      }

      // Fallback: just change template without pre-filling
      console.log("Falling back to simple template change");
      selectTemplate(pendingTemplateKey);
      setIsTemplateChangeModalOpen(false);
    };

    const handleTemplateDataChange = (fieldKey, value) => {
      setPatient((prev) => ({
        ...prev,
        template_data: {
          ...prev.template_data,
          [fieldKey]: value,
        },
      }));
      setIsModified(true);
    };

    const renderField = (field) => {
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

      // Live agent update flash: re-mounts on each new timestamp so the
      // one-shot animation replays when the agent edits the field.
      const liveFlash = liveUpdatedFields[field.field_key];

      return (
        <Box
          key={`${field.field_key}-${liveFlash || "static"}`}
          className={`cohesive-field${liveFlash ? " live-field-updated" : ""}`}
        >
          <Text className="cohesive-field-label">
            {field.field_name}:{persistentMarker}
          </Text>
          <TextareaAutosize
            placeholder={t("patient.enterTextPlaceholder")}
            value={patient.template_data?.[field.field_key] || ""}
            onChange={(e) => {
              handleTemplateDataChange(field.field_key, e.target.value);
            }}
            className="cohesive-textarea"
            ref={(el) => (textareasRefs.current[field.field_key] = el)}
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
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      placeholder={t("patient.selectTemplate")}
                      value={
                        currentTemplate?.template_key ||
                        patient?.template_key ||
                        ""
                      }
                      onChange={handleTemplateChange}
                      size="sm"
                      width={["100px", "150px", "200px"]}
                      className="input-style"
                      disabled={!isNewPatient}>
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
          onClose={() => setIsTemplateChangeModalOpen(false)}
          onConfirm={confirmTemplateChange}
          title={t("navigation.confirmTitle")}
          body={t("navigation.leaveWarning")}
          confirmLabel={t("navigation.leave")}
        />
      </>
    );
  },
);

export default Summary;

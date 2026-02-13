import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import TextareaAutosize from "react-textarea-autosize";
import {
  Box,
  Flex,
  Text,
  Collapse,
  HStack,
  Select,
  VStack,
  Tooltip,
  Center,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import {
  EditIcon,
  CopyIcon,
  CheckIcon,
  AttachmentIcon,
} from "@chakra-ui/icons";
import { FaSave, FaFileAlt, FaThumbtack } from "react-icons/fa";
import { GreenButton, GreyButton } from "../common/Buttons";
import { useTemplateSelection } from "../../utils/templates/templateContext";
import ConfirmLeaveModal from "../modals/ConfirmLeaveModal";

const Summary = forwardRef(
  (
    {
      isSummaryCollapsed,
      toggleSummaryCollapse,
      patient,
      setPatient,
      handleGenerateLetterClick,
      handleSavePatientData,
      setParentIsModified,
      saveLoading,
      setIsModified,
      onCopy,
      recentlyCopied,
      isNewPatient,
      selectTemplate,
      isSearchedPatient,
    },
    ref,
  ) => {
    const {
      currentTemplate,
      templates,
      status: templateStatus,
    } = useTemplateSelection();

    const textareasRefs = useRef({});
    const [isTemplateChangeModalOpen, setIsTemplateChangeModalOpen] =
      useState(false);
    const [pendingTemplateKey, setPendingTemplateKey] = useState(null);
    const toast = useToast();

    const handleTemplateChange = async (e) => {
      const newTemplateKey = e.target.value;

      if (!isNewPatient && !isSearchedPatient) {
        toast({
          title: "Template Locked",
          description: "Template cannot be changed for historical encounters",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (
        patient.template_data &&
        Object.keys(patient.template_data).length > 0
      ) {
        setPendingTemplateKey(newTemplateKey);
        setIsTemplateChangeModalOpen(true);
      } else {
        // Update patient state immediately
        setPatient((prev) => ({
          ...prev,
          template_key: newTemplateKey,
        }));
        await selectTemplate(newTemplateKey);
      }
    };

    const confirmTemplateChange = () => {
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
      const hasContent = patient.template_data?.[field.field_key]?.trim();
      const persistentMarker = field.persistent ? (
        <Tooltip
          label="Persists between encounters."
          hasArrow
          placement="right"
        >
          <Box as="span" className="cohesive-persistent-marker">
            <FaThumbtack />
          </Box>
        </Tooltip>
      ) : null;

      return (
        <Box key={field.field_key} className="cohesive-field">
          <Text className="cohesive-field-label">
            {field.field_name}:{persistentMarker}
          </Text>
          <TextareaAutosize
            placeholder="Enter text..."
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
            <Spinner size="sm" speed="0.65s" />
            <Text ml={2}>Loading template...</Text>
          </Center>
        </Box>
      );
    }

    return (
      <>
        <Box p={[2, 3, 4]} borderRadius="sm" className="panels-bg">
          <Flex align="center" justify="space-between">
            <Flex align="center">
              <HStack spacing={2}>
                <EditIcon size="1.2em" />
                <Text as="h3">Note</Text>
              </HStack>
            </Flex>
            <Tooltip
              label={
                isNewPatient
                  ? "Select Template"
                  : "Template cannot be changed for historical encounters"
              }
              aria-label="Template Selector Tooltip"
            >
              <Box>
                <Flex alignItems="center">
                  <FaFileAlt
                    style={{ marginRight: "8px" }}
                    className="pill-box-icons"
                  />
                  <Select
                    placeholder="Select Template"
                    value={
                      currentTemplate?.template_key ||
                      patient?.template_key ||
                      ""
                    }
                    onChange={handleTemplateChange}
                    size="sm"
                    width={["100px", "150px", "200px"]}
                    className="input-style"
                    isDisabled={!isNewPatient}
                  >
                    {/* Show "Historical Template" only for viewing historical encounters */}
                    {!isNewPatient &&
                      !isSearchedPatient &&
                      patient?.template_key &&
                      !templates?.some(
                        (t) => t.template_key === patient.template_key,
                      ) && (
                        <option value={patient.template_key}>
                          Historical Template
                        </option>
                      )}

                    {templates?.map((t) => (
                      <option key={t.template_key} value={t.template_key}>
                        {t.template_name}
                      </option>
                    ))}
                  </Select>
                </Flex>
              </Box>
            </Tooltip>
          </Flex>

          <Collapse in={!isSummaryCollapsed} animateOpacity>
            <Box mt="4" className="cohesive-fields-container">
              <VStack spacing="0" align="stretch">
                {currentTemplate?.fields?.map(renderField)}
              </VStack>
            </Box>
            <Flex mt="4" justifyContent="space-between">
              <Flex>
                <GreyButton
                  onClick={() => handleGenerateLetterClick(null)}
                  leftIcon={<EditIcon />}
                  mr="2"
                  isDisabled={saveLoading}
                >
                  Generate Letter
                </GreyButton>
              </Flex>
              <Flex>
                <GreyButton
                  onClick={onCopy}
                  width="190px"
                  leftIcon={recentlyCopied ? <CheckIcon /> : <CopyIcon />}
                  mr="2"
                >
                  {recentlyCopied ? "Copied!" : "Copy to Clipboard"}
                </GreyButton>
                <GreenButton
                  onClick={handleSavePatientData}
                  isLoading={saveLoading}
                  loadingText="Saving"
                  width="190px"
                  leftIcon={saveLoading ? null : <FaSave />}
                >
                  {saveLoading ? "Saving..." : "Save Encounter"}
                </GreenButton>
              </Flex>
            </Flex>
          </Collapse>
        </Box>
        <ConfirmLeaveModal
          isOpen={isTemplateChangeModalOpen}
          onClose={() => setIsTemplateChangeModalOpen(false)}
          confirmNavigation={confirmTemplateChange}
        />
      </>
    );
  },
);

export default Summary;

import {
  Box,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  Icon,
  Tooltip,
  Button,
  IconButton,
  Checkbox,
  VStack,
  useColorMode,
  useTheme,
  Grid,
  Wrap,
  WrapItem,
  useToast,
  Spinner,
} from "@chakra-ui/react";
import { useState } from "react";
import { FaUser, FaCalendarAlt, FaIdBadge } from "react-icons/fa";
import {
  FaFileAlt,
  FaSitemap,
  FaVial,
  FaBrain,
  FaArrowRight,
} from "react-icons/fa";
import { RepeatIcon } from "@chakra-ui/icons";
import {
  toggleJobsItem,
  resetJobsItems,
} from "../../utils/patient/patientHandlers";
import { motion, AnimatePresence } from "framer-motion";
import { colors } from "../../theme/colors";
import { FaAtom, FaSync } from "react-icons/fa";
import { patientApi } from "../../utils/api/patientApi";

const PatientTable = ({
  patients,
  handleSelectPatient,
  setPatients,
  refreshSidebar,
  title,
  groupByDate = false,
}) => {
  const { colorMode } = useColorMode();
  const theme = useTheme();
  const toast = useToast();
  const [loadingStates, setLoadingStates] = useState({});

  const formatName = (name) => {
    const nameParts = name.split(", ");
    const firstNameInitial = nameParts[1] ? nameParts[1][0] : "";
    const lastName = nameParts[0];
    return `${firstNameInitial}. ${lastName}`;
  };

  const getRowBackgroundColor = (index) => {
    return colorMode === "light"
      ? index % 2 === 0
        ? theme.colors.light.secondary
        : theme.colors.light.tertiary
      : index % 2 === 0
        ? theme.colors.dark.secondary
        : theme.colors.dark.tertiary;
  };

  const PatientDetails = ({ patient }) => (
    <Box>
      <HStack spacing="2">
        <Icon as={FaUser} />
        <Text fontWeight="bold">{formatName(patient.name)}</Text>
      </HStack>
      <HStack spacing="2">
        <Icon as={FaCalendarAlt} />
        <Text>{patient.dob}</Text>
      </HStack>
      <HStack spacing="2">
        <Icon as={FaIdBadge} />
        <Text>{patient.ur_number}</Text>
      </HStack>
    </Box>
  );

  const getTagColorScheme = (section) => {
    switch (section) {
      case "differentials":
        return {
          bg: colors.light.primaryButton,
          color: colors.light.invertedText,
        };
      case "investigations":
        return {
          bg: colors.light.successButton,
          color: colors.light.invertedText,
        };
      case "considerations":
        return {
          bg: colors.light.secondaryButton,
          color: colors.light.invertedText,
        };
      case "thinking":
        return {
          bg: colors.light.neutralButton,
          color: colors.light.invertedText,
        };
      default:
        return {
          bg: colors.light.surface,
          color: colors.light.textPrimary,
        };
    }
  };

  const handleGenerateReasoning = async (patientId) => {
    try {
      setLoadingStates((prev) => ({ ...prev, [patientId]: true }));
      const res = await patientApi.generateReasoning(patientId, toast);
      const updatedPatients = patients.map((patient) =>
        patient.id === patientId
          ? { ...patient, reasoning: res, activeSection: "summary" }
          : patient,
      );
      setPatients(updatedPatients);
    } catch (error) {
      console.error("Error generating reasoning:", error);
      toast({
        title: "Error generating reasoning",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoadingStates((prev) => ({ ...prev, [patientId]: false }));
    }
  };

  const sfxVolume = 0.3;
  const SFX = {
    tick: "/sfx/tick.mp3",
    complete: "/sfx/complete.mp3",
    reset: "/sfx/reset.mp3",
  };
  const play = (url) => {
    try {
      const a = new Audio(url);
      a.volume = sfxVolume;
      a.play().catch(() => {});
    } catch {}
  };

  const renderPatientRow = (patient, index) => (
    <Tr key={patient.id} backgroundColor={getRowBackgroundColor(index)}>
      <Td width="25%">
        <VStack align="stretch" spacing={2}>
          <Tooltip
            label={`${patient.name}, DOB: ${patient.dob}, UR Number: ${patient.ur_number}`}
            aria-label="Patient Details"
          >
            <PatientDetails patient={patient} />
          </Tooltip>
          <Button
            className="grey-button"
            size="sm"
            onClick={() => handleSelectPatient(patient)}
            maxW="150px"
          >
            Go to Encounter
          </Button>
        </VStack>
      </Td>

      <Td width="45%" position="relative">
        <Box>
          <Grid templateColumns="40px 1fr" gap={0} h="120px">
            <VStack align="flex-start" spacing={0} w="30px">
              {[
                {
                  section: "summary",
                  icon: FaFileAlt,
                  tooltip: "Summary",
                },
                {
                  section: "differentials",
                  icon: FaSitemap,
                  tooltip: "Differentials",
                },
                {
                  section: "investigations",
                  icon: FaVial,
                  tooltip: "Investigations",
                },
                {
                  section: "considerations",
                  icon: FaBrain,
                  tooltip: "Clinical Considerations",
                },
              ].map(({ section, icon, tooltip }) => (
                <Tooltip
                  key={section}
                  label={tooltip}
                  placement="right"
                  hasArrow
                >
                  <Button
                    key={section}
                    className={`reason-button ${
                      (!patient.reasoning && section === "summary") ||
                      patient.activeSection === section
                        ? "reason-button-active-patient-table"
                        : ""
                    }`}
                    onClick={() => {
                      if (patient.reasoning || section === "summary") {
                        const updatedPatients = patients.map((p) =>
                          p.id === patient.id
                            ? {
                                ...p,
                                activeSection: section,
                              }
                            : p,
                        );
                        setPatients(updatedPatients);
                      }
                    }}
                    justifyContent="center"
                    width="100%"
                    height="28px"
                    fontSize="xs"
                    isDisabled={!patient.reasoning && section !== "summary"}
                    opacity={
                      !patient.reasoning && section !== "summary" ? 0.5 : 1
                    }
                    leftIcon={<Icon as={icon} />}
                    p={1}
                  />
                </Tooltip>
              ))}
            </VStack>

            <Box
              overflowY="auto"
              className="scroll-container"
              p={3}
              bg={
                colorMode === "light" ? colors.light.crust : colors.dark.crust
              }
              borderRadius="lg"
              h="100%"
              position="relative"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={patient.reasoning ? patient.activeSection : "summary"}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  {patient.reasoning ? (
                    <>
                      {patient.activeSection === "summary" && (
                        <Text fontSize="sm">{patient.reasoning.summary}</Text>
                      )}
                      {(patient.activeSection === "differentials" ||
                        patient.activeSection === "investigations" ||
                        patient.activeSection === "considerations") && (
                        <Wrap spacing={1}>
                          {patient.reasoning[
                            patient.activeSection === "considerations"
                              ? "clinical_considerations"
                              : patient.activeSection
                          ]?.map((item, i) => (
                            <WrapItem key={i}>
                              <Box
                                px={2}
                                py={0.5}
                                borderRadius="sm"
                                fontSize="sm"
                                {...getTagColorScheme(patient.activeSection)}
                              >
                                {typeof item === "string"
                                  ? item
                                  : item.suggestion}
                              </Box>
                            </WrapItem>
                          ))}
                        </Wrap>
                      )}
                    </>
                  ) : (
                    <Text fontSize="sm">{patient.encounter_summary}</Text>
                  )}
                </motion.div>
              </AnimatePresence>
            </Box>
          </Grid>
        </Box>
      </Td>

      <Td width="30%" verticalAlign="top">
        <HStack spacing={2} alignItems="flex-start">
          <Tooltip label="Reset jobs" aria-label="Reset jobs">
            <IconButton
              icon={<RepeatIcon />}
              size="sm"
              variant="ghost"
              onClick={() => {
                play(SFX.reset);
                resetJobsItems(
                  patient.id,
                  patients,
                  setPatients,
                  refreshSidebar,
                );
              }}
            />
          </Tooltip>
          <VStack align="start" spacing={1}>
            {patient.jobs_list?.map((item, index) => (
              <Checkbox
                key={index}
                className="checkbox task-checkbox"
                isChecked={item.completed}
                onChange={(e) => {
                  const nextChecked = e.target.checked;

                  if (nextChecked) {
                    play(SFX.tick); // Always play tick on check

                    const willBeCompletedList = (patient.jobs_list || []).map(
                      (it, i) => (i === index ? true : !!it.completed),
                    );
                    const allCompleteAfter =
                      willBeCompletedList.length > 0 &&
                      willBeCompletedList.every(Boolean);

                    if (allCompleteAfter) {
                      setTimeout(() => {
                        play(SFX.complete);
                      }, 300); // Delay before playing 'complete' sound
                    }
                  }

                  toggleJobsItem(patient.id, index, patients, refreshSidebar);
                }}
                alignItems="flex-start"
                sx={{
                  ".chakra-checkbox__label": {
                    display: "block",
                    whiteSpace: "normal",
                    paddingTop: 0,
                  },
                  ".chakra-checkbox__control": {
                    marginTop: "3px",
                  },
                }}
              >
                {item.job}
              </Checkbox>
            ))}
          </VStack>
        </HStack>
      </Td>
    </Tr>
  );

  return (
    <Box p="5" borderRadius="sm" w="100%">
      <Text as="h2">{title}</Text>
      {groupByDate ? (
        Object.entries(
          patients.reduce((acc, patient) => {
            const date = patient.encounter_date;
            if (!acc[date]) acc[date] = [];
            acc[date].push(patient);
            return acc;
          }, {}),
        )
          .sort((a, b) => new Date(b[0]) - new Date(a[0]))
          .map(([date, patients]) => (
            <Box key={date} mb={8}>
              <Text as="h3" mb={2}>
                {new Date(date).toLocaleDateString()}
              </Text>
              <Box overflowX="auto">
                <Table variant="simple">
                  <Thead>
                    <Tr>
                      <Th width="25%">Patient Details</Th>
                      <Th width="45%">Reasoning / Encounter Summary</Th>
                      <Th width="30%">Plan</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {patients
                      .sort((a, b) => a.id - b.id)
                      .map((patient, index) =>
                        renderPatientRow(patient, index),
                      )}
                  </Tbody>
                </Table>
              </Box>
            </Box>
          ))
      ) : (
        <Box overflowX="auto">
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th width="25%">Patient Details</Th>
                <Th width="45%">Reasoning / Encounter Summary</Th>
                <Th width="30%">Plan</Th>
              </Tr>
            </Thead>
            <Tbody>
              {patients
                .slice()
                .sort((a, b) => a.id - b.id)
                .map((patient, index) => renderPatientRow(patient, index))}
            </Tbody>
          </Table>
        </Box>
      )}
    </Box>
  );
};

export default PatientTable;

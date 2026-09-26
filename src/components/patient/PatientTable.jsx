import {
    Box,
    Text,
    Table,
    HStack,
    Icon,
    Button,
    IconButton,
    Checkbox,
    VStack,
    Grid,
    Wrap,
    WrapItem,
    Skeleton,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { useRef, useEffect } from "react";
import { FaUser, FaCalendarAlt, FaIdBadge } from "react-icons/fa";
import {
    FaFileAlt,
    FaSitemap,
    FaVial,
    FaBrain,
    FaArrowRight,
} from "react-icons/fa";
import { RepeatIcon } from "../common/icons";
import { useColorMode } from "../ui/color-mode";
import { colors } from "../../theme/colors";
import { getLocale } from "../../utils/helpers/formatHelpers";
import {
    resetJobsItems,
    debouncedUpdateJobsList,
    flushPendingJobsUpdate,
} from "../../utils/patient/patientHandlers";

const PatientTable = ({
    patients,
    handleSelectPatient,
    setPatients,
    refreshSidebar,
    title,
    groupByDate = false,
    summaryOnly = false,
    isLoading = false,
}) => {
    const { t } = useTranslation();
    const pendingJobsUpdates = useRef(new Map());
    const { colorMode } = useColorMode();

    useEffect(() => {
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount cleanup: must read ref at cleanup time to flush latest pending jobs
            pendingJobsUpdates.current.forEach((_, noteId) => {
                flushPendingJobsUpdate(noteId);
            });
        };
    }, []);

    const formatName = (name) => {
        const nameParts = name.split(", ");
        const firstNameInitial = nameParts[1] ? nameParts[1][0] : "";
        const lastName = nameParts[0];
        return `${firstNameInitial}. ${lastName}`;
    };

    const getRowBackgroundColor = (index) =>
        index % 2 === 0 ? "secondary" : "crust";

    const PatientDetails = ({ patient }) => (
        <Box>
            <HStack gap="2">
                <Icon asChild>
                    <FaUser />
                </Icon>
                <Text fontWeight="bold">{formatName(patient.name)}</Text>
            </HStack>
            <HStack gap="2">
                <Icon asChild>
                    <FaCalendarAlt />
                </Icon>
                <Text>{patient.dob}</Text>
            </HStack>
            <HStack gap="2">
                <Icon asChild>
                    <FaIdBadge />
                </Icon>
                <Text>{patient.ur_number}</Text>
            </HStack>
        </Box>
    );

    const getTagStyle = (section) => {
        const token =
            section === "differentials"
                ? "primaryButton"
                : section === "investigations"
                  ? "successButton"
                  : section === "considerations"
                    ? "secondaryButton"
                    : section === "thinking"
                      ? "neutralButton"
                      : null;
        if (!token) return { bg: "surface", color: "textPrimary" };
        const hex = colors[colorMode]?.[token] ?? colors.dark.surface2;
        return {
            bg: `${hex}1f`,
            color: hex,
            border: "1px solid",
            borderColor: `${hex}40`,
        };
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
        <Table.Row
            key={patient.id}
            backgroundColor={getRowBackgroundColor(index)}
            transition="background-color 0.15s ease, opacity 0.2s ease"
            _hover={{ backgroundColor: "surfaceQuartile" }}
            opacity={
                summaryOnly &&
                (patient.jobs_list?.length || 0) > 0 &&
                patient.jobs_list.every((j) => j.completed)
                    ? 0.5
                    : 1
            }
        >
            <Table.Cell width="25%" verticalAlign="top">
                {summaryOnly ? (
                    <Box>
                        <HStack gap="2">
                            <Icon asChild>
                                <FaUser />
                            </Icon>
                            <Text fontWeight="bold">
                                {formatName(patient.name)}
                            </Text>
                            <Tooltip
                                content={t("patient.goToEncounter")}
                                showArrow
                                positioning={{
                                    placement: "right",
                                }}
                            >
                                <IconButton
                                    size="xs"
                                    variant="ghost"
                                    aria-label={t("patient.goToEncounter")}
                                    onClick={() => handleSelectPatient(patient)}
                                >
                                    <Icon asChild>
                                        <FaArrowRight />
                                    </Icon>
                                </IconButton>
                            </Tooltip>
                        </HStack>
                        <HStack gap="2">
                            <Icon asChild>
                                <FaCalendarAlt />
                            </Icon>
                            <Text>{patient.dob}</Text>
                        </HStack>
                        <HStack gap="2">
                            <Icon asChild>
                                <FaIdBadge />
                            </Icon>
                            <Text>{patient.ur_number}</Text>
                        </HStack>
                    </Box>
                ) : (
                    <VStack align="stretch" gap={2}>
                        <Tooltip
                            content={t("patient.detailsHover", {
                                name: patient.name,
                                dob: patient.dob,
                                urNumber: patient.ur_number,
                            })}
                            aria-label={t("patient.patientDetails")}
                        >
                            <PatientDetails patient={patient} />
                        </Tooltip>
                        <Button
                            className="grey-button"
                            size="sm"
                            onClick={() => handleSelectPatient(patient)}
                            maxW="150px"
                        >
                            {t("patient.goToEncounter")}
                        </Button>
                    </VStack>
                )}
            </Table.Cell>

            <Table.Cell width="45%" position="relative" verticalAlign="top">
                {summaryOnly ? (
                    <Box
                        p={2}
                        borderRadius="lg"
                        bg="surface"
                    >
                        <Text fontSize="sm">
                            {patient.reasoning?.summary ??
                                patient.encounter_summary}
                        </Text>
                    </Box>
                ) : (
                    <Box>
                        <Grid templateColumns="40px 1fr" gap={0} h="120px">
                            <VStack align="flex-start" gap={0} w="30px">
                                {[
                                    {
                                        section: "summary",
                                        icon: FaFileAlt,
                                        tooltip: t("patient.sectionSummary"),
                                    },
                                    {
                                        section: "differentials",
                                        icon: FaSitemap,
                                        tooltip: t("patient.sectionDifferentials"),
                                    },
                                    {
                                        section: "investigations",
                                        icon: FaVial,
                                        tooltip: t("patient.sectionInvestigations"),
                                    },
                                    {
                                        section: "considerations",
                                        icon: FaBrain,
                                        tooltip: t("patient.sectionConsiderations"),
                                    },
                                ].map(({ section, icon: ReasonIcon, tooltip }) => (
                                    <Tooltip
                                        key={section}
                                        content={tooltip}
                                        showArrow
                                        positioning={{
                                            placement: "right",
                                        }}
                                    >
                                        <Button
                                            key={section}
                                            className={`reason-button ${
                                                (!patient.reasoning &&
                                                    section === "summary") ||
                                                patient.activeSection ===
                                                    section
                                                    ? "reason-button-active-patient-table"
                                                    : ""
                                            }`}
                                            onClick={() => {
                                                if (
                                                    patient.reasoning ||
                                                    section === "summary"
                                                ) {
                                                    const updatedPatients =
                                                        patients.map((p) =>
                                                            p.id === patient.id
                                                                ? {
                                                                      ...p,
                                                                      activeSection:
                                                                          section,
                                                                  }
                                                                : p,
                                                        );
                                                    setPatients(
                                                        updatedPatients,
                                                    );
                                                }
                                            }}
                                            justifyContent="center"
                                            width="100%"
                                            height="28px"
                                            fontSize="xs"
                                            disabled={
                                                !patient.reasoning &&
                                                section !== "summary"
                                            }
                                            opacity={
                                                !patient.reasoning &&
                                                section !== "summary"
                                                    ? 0.5
                                                    : 1
                                            }
                                            p={1}
                                        >
                                            <Icon asChild>
                                                <ReasonIcon />
                                            </Icon>
                                        </Button>
                                    </Tooltip>
                                ))}
                            </VStack>

                            <Box
                            overflowY="auto"
                            className="scroll-container"
                            p={3}
                            bg="surface"
                                borderRadius="lg"
                                h="100%"
                                position="relative"
                            >
                                <Box
                                    key={
                                        patient.reasoning
                                            ? patient.activeSection
                                            : "summary"
                                    }
                                    className="anim-fade-slide-up"
                                    css={{ animationDuration: "0.15s" }}
                                >
                                        {patient.reasoning ? (
                                            <>
                                                {patient.activeSection ===
                                                    "summary" && (
                                                    <Text fontSize="sm">
                                                        {
                                                            patient.reasoning
                                                                .summary
                                                        }
                                                    </Text>
                                                )}
                                                {(patient.activeSection ===
                                                    "differentials" ||
                                                    patient.activeSection ===
                                                        "investigations" ||
                                                    patient.activeSection ===
                                                        "considerations") && (
                                                    <Wrap gap={1}>
                                                        {patient.reasoning[
                                                            patient.activeSection ===
                                                            "considerations"
                                                                ? "clinical_considerations"
                                                                : patient.activeSection
                                                        ]?.map((item, i) => (
                                                            <WrapItem key={i}>
                                                                <Box
                                                                    px={2}
                                                                    py={0.5}
                                                                    borderRadius="full"
                                                                    fontSize="sm"
                                                                    {...getTagStyle(
                                                                        patient.activeSection,
                                                                    )}
                                                                >
                                                                    {typeof item ===
                                                                    "string"
                                                                        ? item
                                                                        : item.suggestion}
                                                                </Box>
                                                            </WrapItem>
                                                        ))}
                                                    </Wrap>
                                                )}
                                            </>
                                        ) : (
                                            <Text fontSize="sm">
                                                {patient.encounter_summary}
                                            </Text>
                                        )}
                                    </Box>
                            </Box>
                        </Grid>
                    </Box>
                )}
            </Table.Cell>

            <Table.Cell width="30%" verticalAlign="top">
                <HStack gap={2} alignItems="flex-start">
                    <Tooltip content={t("patient.resetJobs")} aria-label={t("patient.resetJobs")}>
                        <IconButton
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
                        >
                            <RepeatIcon />
                        </IconButton>
                    </Tooltip>
                    <VStack align="start" gap={1}>
                        {patient.jobs_list?.length ? (
                            patient.jobs_list.map((item, index) => (
                                <Checkbox.Root
                                    key={index}
                                    className="checkbox task-checkbox"
                                    onCheckedChange={(e) => {
                                        const nextChecked = e.checked;

                                        if (nextChecked) {
                                            play(SFX.tick); // Always play tick on check

                                            const willBeCompletedList = (
                                                patient.jobs_list || []
                                            ).map((it, i) =>
                                                i === index
                                                    ? true
                                                    : !!it.completed,
                                            );
                                            const allCompleteAfter =
                                                willBeCompletedList.length >
                                                    0 &&
                                                willBeCompletedList.every(
                                                    Boolean,
                                                );

                                            if (allCompleteAfter) {
                                                setTimeout(() => {
                                                    play(SFX.complete);
                                                }, 300); // Delay before playing 'complete' sound
                                            }
                                        }

                                        const updatedJobsList =
                                            patient.jobs_list.map((j, i) =>
                                                i === index
                                                    ? {
                                                          ...j,
                                                          completed:
                                                              nextChecked,
                                                      }
                                                    : j,
                                            );

                                        setPatients((prevPatients) =>
                                            prevPatients.map((p) =>
                                                p.id === patient.id
                                                    ? {
                                                          ...p,
                                                          jobs_list:
                                                              updatedJobsList,
                                                      }
                                                    : p,
                                            ),
                                        );

                                        pendingJobsUpdates.current.set(
                                            patient.id,
                                            updatedJobsList,
                                        );

                                        debouncedUpdateJobsList(
                                            patient.id,
                                            updatedJobsList,
                                            refreshSidebar,
                                        );
                                    }}
                                    alignItems="flex-start"
                                    css={{
                                        "& .chakra-checkbox__label": {
                                            display: "block",
                                            whiteSpace: "normal",
                                            paddingTop: 0,
                                            transition:
                                                "opacity 0.2s ease, text-decoration-color 0.2s ease",
                                            textDecorationColor:
                                                "currentColor",
                                            ...(item.completed
                                                ? {
                                                      textDecoration:
                                                          "line-through",
                                                      opacity: 0.5,
                                                  }
                                                : {}),
                                        },

                                        "& .chakra-checkbox__control": {
                                            marginTop: "3px",
                                        },
                                    }}
                                    checked={item.completed}
                                >
                                    <Checkbox.HiddenInput />
                                    <Checkbox.Control>
                                        <Checkbox.Indicator />
                                    </Checkbox.Control>
                                    <Checkbox.Label>{item.job}</Checkbox.Label>
                                </Checkbox.Root>
                            ))
                        ) : (
                            <Text
                                fontSize="sm"
                                fontStyle="italic"
                                opacity={0.6}
                            >
                                {t("patient.noTasks")}
                            </Text>
                        )}
                    </VStack>
                </HStack>
            </Table.Cell>
        </Table.Row>
    );

    // Placeholder rows while SWR loads, so the table doesn't flash empty.
    const renderSkeletonRows = (count = 3) =>
        Array.from({ length: count }, (_, i) => (
            <Table.Row key={`skeleton-${i}`}>
                <Table.Cell>
                    <VStack align="stretch" gap={2} py={1}>
                        <Skeleton height="16px" width="70%" />
                        <Skeleton height="14px" width="50%" />
                    </VStack>
                </Table.Cell>
                <Table.Cell>
                    <Skeleton height="14px" width="90%" my={1} />
                    <Skeleton height="14px" width="60%" />
                </Table.Cell>
                <Table.Cell>
                    <Skeleton height="14px" width="80%" />
                </Table.Cell>
            </Table.Row>
        ));

    return (
        <Box
            p="5"
            borderRadius="xl"
            w="100%"
            className="anim-fade-slide-up"
            css={{ animationDuration: "0.25s" }}
        >
            <Text as="h2">{title}</Text>
            {groupByDate && !isLoading ? (
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
                        <Box
                            key={date}
                            mb={8}
                            className="anim-fade-slide-up"
                            css={{ animationDuration: "0.25s" }}
                        >
                            <Text as="h3" mb={2}>
                                {new Date(date).toLocaleDateString(getLocale())}
                            </Text>
                            <Box
                                overflowX="auto"
                                border="1px solid"
                                borderColor="surface"
                                borderRadius="xl"
                            >
                                <Table.Root
                                    variant="simple"
                                    borderRadius="lg"
                                    overflow="hidden"
                                    css={{
                                        borderCollapse: "separate",
                                        borderSpacing: 0,
                                    }}
                                >
                                    <Table.Header
                                        bg="surface"
                                    >
                                        <Table.Row>
                                            <Table.ColumnHeader width="25%">
                                                {t("patient.patientDetails")}
                                            </Table.ColumnHeader>
                                            <Table.ColumnHeader width="45%">
                                                {t("patient.reasoningEncounterSummary")}
                                            </Table.ColumnHeader>
                                            <Table.ColumnHeader width="30%">
                                                {t("patient.jobs")}
                                            </Table.ColumnHeader>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body
                                        className="anim-stagger"
                                        css={{
                                            "& > *": {
                                                animationDuration: "0.15s",
                                            },
                                        }}
                                    >
                                        {isLoading
                                            ? renderSkeletonRows()
                                            : patients
                                                  .sort((a, b) => a.id - b.id)
                                                  .map((patient, index) =>
                                                      renderPatientRow(
                                                          patient,
                                                          index,
                                                      ),
                                                  )}
                                    </Table.Body>
                                </Table.Root>
                            </Box>
                        </Box>
                    ))
            ) : (
                <Box
                    overflowX="auto"
                    border="1px solid"
                    borderColor="surface"
                    borderRadius="xl"
                >
                    <Table.Root
                        variant="simple"
                        borderRadius="lg"
                        overflow="hidden"
                        css={{
                            borderCollapse: "separate",
                            borderSpacing: 0,
                        }}
                    >
                        <Table.Header
                            bg="surface"
                        >
                            <Table.Row>
                                <Table.ColumnHeader width="25%">
                                    {t("patient.patientDetails")}
                                </Table.ColumnHeader>
                                <Table.ColumnHeader width="45%">
                                    {t("patient.reasoningEncounterSummary")}
                                </Table.ColumnHeader>
                                <Table.ColumnHeader width="30%">
                                    {t("patient.jobs")}
                                </Table.ColumnHeader>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body
                            className="anim-stagger"
                            css={{
                                "& > *": {
                                    animationDuration: "0.15s",
                                },
                            }}
                        >
                            {isLoading
                                ? renderSkeletonRows(4)
                                : patients
                                      .slice()
                                      .sort((a, b) => a.id - b.id)
                                      .map((patient, index) =>
                                          renderPatientRow(patient, index),
                                      )}
                        </Table.Body>
                    </Table.Root>
                </Box>
            )}
        </Box>
    );
};

export default PatientTable;

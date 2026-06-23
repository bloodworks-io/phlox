import { useEffect, useRef, useState } from "react";
import { useColorMode } from "../ui/color-mode";
import {
    Steps,
    HStack,
    VStack,
    Box,
    Text,
    Input,
    Button,
    Checkbox,
    IconButton,
    Spinner,
    Center,
    Collapsible,
    Alert,
    Dialog,
    Portal,
} from "@chakra-ui/react";
import { FaCheckDouble, FaPlus, FaTimes } from "react-icons/fa";
import { patientApi } from "../../utils/api/patientApi";
import { GreenButton } from "../common/Buttons";
import { colors } from "../../theme/colors";

const Section = ({ title, children }) => (
    <Box>
        <Text fontSize="sm" fontWeight="600" mb={2}>
            {title}
        </Text>
        {children}
    </Box>
);

const WrapUpModal = ({ isOpen, onClose, onConfirm, planText, submitting }) => {
    const { colorMode } = useColorMode();
    const currentColors = colors[colorMode];

    const [extracting, setExtracting] = useState(false);
    const [actionItems, setActionItems] = useState([]); // { text, checked }
    const [excluded, setExcluded] = useState([]); // { text }
    const [fallback, setFallback] = useState(null); // null | "empty" | "heuristic"
    const [newTaskText, setNewTaskText] = useState("");
    const [showExcluded, setShowExcluded] = useState(false);

    // Guards against out-of-order responses if the modal is reopened quickly.
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!isOpen) return;

        setActionItems([]);
        setExcluded([]);
        setFallback(null);
        setNewTaskText("");
        setShowExcluded(false);

        const plan = (planText || "").trim();
        if (!plan) {
            setFallback("empty");
            return;
        }

        const myRequestId = ++requestIdRef.current;
        setExtracting(true);
        patientApi
            .extractJobs(plan)
            .then((data) => {
                if (myRequestId !== requestIdRef.current) return; // stale
                setActionItems(
                    (data.action_items || []).map((j) => ({
                        text: j.text,
                        checked: true,
                    })),
                );
                setExcluded(
                    (data.excluded || []).map((j) => ({ text: j.text })),
                );
                setFallback(data.fallback || null);
            })
            .catch((err) => {
                if (myRequestId !== requestIdRef.current) return;
                console.error("Job extraction failed:", err);
                setFallback("heuristic");
                setActionItems([]);
            })
            .finally(() => {
                if (myRequestId === requestIdRef.current) setExtracting(false);
            });
    }, [isOpen, planText]);

    const toggleItem = (idx) =>
        setActionItems((items) =>
            items.map((it, i) =>
                i === idx ? { ...it, checked: !it.checked } : it,
            ),
        );

    const editItemText = (idx, text) =>
        setActionItems((items) =>
            items.map((it, i) => (i === idx ? { ...it, text } : it)),
        );

    const removeItem = (idx) =>
        setActionItems((items) => items.filter((_, i) !== idx));

    const addTask = () => {
        const text = newTaskText.trim();
        if (!text) return;
        setActionItems((items) => [...items, { text, checked: true }]);
        setNewTaskText("");
    };

    const promoteExcluded = (idx) => {
        const item = excluded[idx];
        if (!item) return;
        setExcluded((items) => items.filter((_, i) => i !== idx));
        setActionItems((items) => [
            ...items,
            { text: item.text, checked: true },
        ]);
    };

    const canConfirm = !extracting && !submitting;

    const handleConfirm = () => {
        const curatedJobs = actionItems
            .filter((it) => it.checked)
            .map((it, i) => ({
                id: i + 1,
                job: it.text.trim(),
                completed: false,
            }));
        onConfirm(curatedJobs);
    };

    return (
        <Dialog.Root
            open={isOpen}
            size='lg'
            closeOnInteractOutside={false}
            onOpenChange={e => {
                if (!e.open) {
                    onClose();
                }
            }}
        >
            <Portal>

                <Dialog.Backdrop />
                <Dialog.Positioner>
                    <Dialog.Content className="modal-style">
                        <Dialog.Header>
                            <HStack>
                                <FaCheckDouble />
                                <Text>Wrap Up</Text>
                            </HStack>
                        </Dialog.Header>
                        <Dialog.CloseTrigger />
                        <Dialog.Body
                            maxH="55vh"
                            overflowY="auto"
                            className="custom-scrollbar"
                        >
                            <VStack align="stretch" gap={4}>
                                <Section title="Jobs to action">
                                    {extracting ? (
                                        <Center py={6}>
                                            <Spinner size="sm" />
                                            <Text
                                                ml={2}
                                                fontSize="sm"
                                                color={currentColors.textSecondary}
                                            >
                                                Extracting tasks from the plan...
                                            </Text>
                                        </Center>
                                    ) : actionItems.length === 0 &&
                                      fallback !== "empty" ? (
                                        <Text
                                            fontSize="sm"
                                            color={currentColors.textSecondary}
                                        >
                                            No tasks extracted — add any below.
                                        </Text>
                                    ) : null}

                                    <VStack align="stretch" gap={1}>
                                        {actionItems.map((item, idx) => (
                                            <HStack
                                                key={idx}
                                                align="flex-start"
                                                gap={2}
                                                w="100%"
                                            >
                                                <Checkbox.Root
                                                    className="checkbox task-checkbox"
                                                    onCheckedChange={() => toggleItem(idx)}
                                                    alignItems="flex-start"
                                                    css={{
                                                        '& .chakra-checkbox__control': {
                                                            marginTop: "3px",
                                                        }
                                                    }}
                                                    checked={item.checked}><Checkbox.HiddenInput /><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control></Checkbox.Root>
                                                <Input
                                                    value={item.text}
                                                    onValueChange={(e) =>
                                                        editItemText(
                                                            idx,
                                                            e.target.value,
                                                        )
                                                    }
                                                    variant="unstyled"
                                                    size="sm"
                                                    flex="1"
                                                    color={currentColors.textPrimary}
                                                    css={{
                                                        padding: 0,
                                                        height: "auto",
                                                        lineHeight: "1.4"
                                                    }}
                                                />
                                                <IconButton
                                                    aria-label="Remove task"
                                                    size="xs"
                                                    variant="ghost"
                                                    onClick={() => removeItem(idx)}><FaTimes /></IconButton>
                                            </HStack>
                                        ))}
                                    </VStack>

                                    <HStack mt={2}>
                                        <Input
                                            placeholder="Add a task..."
                                            value={newTaskText}
                                            onValueChange={(e) =>
                                                setNewTaskText(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addTask();
                                                }
                                            }}
                                            size="sm"
                                            className="input-style"
                                        />
                                        <IconButton aria-label="Add task" size="sm" onClick={addTask}><FaPlus /></IconButton>
                                    </HStack>
                                </Section>

                                {excluded.length > 0 && (
                                    <Box>
                                        <Text
                                            fontSize="sm"
                                            fontWeight="600"
                                            color={currentColors.textPrimary}
                                            cursor="pointer"
                                            userSelect="none"
                                            onClick={() => setShowExcluded((s) => !s)}
                                        >
                                            {showExcluded ? "▾" : "▸"} Not tasks
                                            (review/follow-up) — {excluded.length}
                                        </Text>
                                        <Collapsible.Root open={showExcluded}>
                                            <Collapsible.Content>
                                                <VStack
                                                    align="stretch"
                                                    gap={1}
                                                    mt={2}
                                                    pl={2}
                                                >
                                                    {excluded.map((item, idx) => (
                                                        <HStack
                                                            key={idx}
                                                            justify="space-between"
                                                        >
                                                            <Text
                                                                fontSize="sm"
                                                                color={
                                                                    currentColors.textSecondary
                                                                }
                                                            >
                                                                {item.text}
                                                            </Text>
                                                            <IconButton
                                                                aria-label="Promote to task"
                                                                size="xs"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    promoteExcluded(idx)
                                                                }><FaPlus /></IconButton>
                                                        </HStack>
                                                    ))}
                                                </VStack>
                                            </Collapsible.Content>
                                        </Collapsible.Root>
                                    </Box>
                                )}

                                {fallback === "empty" && (
                                    <Alert.Root status="info" borderRadius="md">
                                        <Alert.Indicator />
                                        No plan text to extract tasks from. Add any
                                        tasks above.
                                    </Alert.Root>
                                )}
                                {fallback === "heuristic" && (
                                    <Alert.Root status="warning" borderRadius="md">
                                        <Alert.Indicator />
                                        Smart extraction unavailable — showing basic
                                        tasks. Edit freely.
                                    </Alert.Root>
                                )}

                                {/* TODO: billing suggestions section */}
                            </VStack>
                        </Dialog.Body>
                        <Dialog.Footer>
                            <HStack justify="flex-end" width="100%">
                                <Button
                                    onClick={onClose}
                                    size="md"
                                    borderRadius="2xl !important"
                                    className="switch-mode"
                                    css={{
                                        fontFamily: '"Space Grotesk", sans-serif',
                                        fontWeight: "600"
                                    }}
                                    mr={3}
                                    disabled={submitting}
                                >
                                    Cancel
                                </Button>
                                <GreenButton
                                    onClick={handleConfirm}
                                    isLoading={submitting}
                                    loadingText="Saving"
                                    isDisabled={!canConfirm}
                                >
                                    Confirm &amp; Finish
                                </GreenButton>
                            </HStack>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Positioner>

            </Portal>
        </Dialog.Root>
    );
};

export default WrapUpModal;

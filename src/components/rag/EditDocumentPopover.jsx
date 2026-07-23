import { useState } from "react";
import {
    Box,
    Text,
    Flex,
    IconButton,
    Popover,
    Input,
    VStack,
    Button,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import { EditIcon } from "../common/icons";
import { FaTimes } from "react-icons/fa";
import { ragApi } from "../../utils/api/ragApi";

const FOCUS_AREA_OPTIONS = [
    "guidelines",
    "diagnosis",
    "treatment",
    "epidemiology",
    "pathophysiology",
    "prognosis",
    "clinical_features",
    "prevention",
    "miscellaneous",
];

export const EditDocumentPopover = ({ collectionName, file, onSaved }) => {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(file.title || "");
    const [source, setSource] = useState(file.source || "");
    const [focusArea, setFocusArea] = useState(file.focus_area || "");
    const [saving, setSaving] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await ragApi.updateDocumentMetadata({
                collection_name: collectionName,
                filename: file.filename,
                title: title || null,
                source: source || null,
                focus_area: focusArea || null,
            });
            onSaved({ ...file, title, source, focus_area: focusArea });
            setOpen(false);
        } catch {
            toaster.create({
                title: "Error",
                description: "Failed to update document",
                type: "error",
                duration: 3000,
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Popover.Root
            open={open}
            onOpenChange={(d) => setOpen(d.open)}
            positioning={{ placement: "left" }}
            lazyRender
        >
            <Popover.Trigger asChild>
                <IconButton
                    aria-label="Edit document"
                    size="xs"
                    variant="ghost"
                    colorPalette="blue"
                    mr="1"
                >
                    <EditIcon />
                </IconButton>
            </Popover.Trigger>
            <Popover.Positioner>
                <Popover.Content w="340px" position="relative">
                    <Popover.Arrow>
                        <Popover.ArrowTip />
                    </Popover.Arrow>
                    <Popover.Header
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={2}
                    >
                        <Text
                            as="span"
                            fontSize="sm"
                            fontWeight="600"
                            color="textPrimary"
                            lineHeight="1.2"
                            flex="1"
                        >
                            Edit document
                        </Text>
                        <Box
                            as="button"
                            onClick={() => setOpen(false)}
                            background="none"
                            border="none"
                            cursor="pointer"
                            padding="2px"
                            color="textSecondary"
                            opacity={0.6}
                            _hover={{ opacity: 1 }}
                            aria-label="Close"
                            flexShrink={0}
                            display="flex"
                            alignItems="center"
                            lineHeight="1"
                        >
                            <FaTimes size={12} />
                        </Box>
                    </Popover.Header>
                    <Popover.Body>
                        <VStack gap={2} align="stretch">
                            <Box>
                                <Text
                                    fontSize="xs"
                                    mb={1}
                                    color="textSecondary"
                                >
                                    Title
                                </Text>
                                <Input
                                    size="sm"
                                    className="input-style"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Document title"
                                />
                            </Box>
                            <Box>
                                <Text
                                    fontSize="xs"
                                    mb={1}
                                    color="textSecondary"
                                >
                                    Source
                                </Text>
                                <Input
                                    size="sm"
                                    className="input-style"
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                    placeholder="Publishing source"
                                />
                            </Box>
                            <Box>
                                <Text
                                    fontSize="xs"
                                    mb={1}
                                    color="textSecondary"
                                >
                                    Focus area
                                </Text>
                                <Input
                                    size="sm"
                                    className="input-style"
                                    value={focusArea}
                                    onChange={(e) =>
                                        setFocusArea(e.target.value)
                                    }
                                    placeholder="Focus area"
                                    list="focus-area-options"
                                />
                                <datalist id="focus-area-options">
                                    {FOCUS_AREA_OPTIONS.map((o) => (
                                        <option key={o} value={o} />
                                    ))}
                                </datalist>
                            </Box>
                        </VStack>
                    </Popover.Body>
                    <Flex
                        justify="flex-end"
                        p={2}
                        gap={2}
                        borderTop="1px solid"
                        borderColor="surface"
                    >
                        <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="xs"
                            className="green-button"
                            loading={saving}
                            onClick={handleSave}
                        >
                            Save
                        </Button>
                    </Flex>
                </Popover.Content>
            </Popover.Positioner>
        </Popover.Root>
    );
};

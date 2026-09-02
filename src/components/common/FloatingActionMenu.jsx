import { IconButton } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { FaEnvelope, FaFileUpload } from "react-icons/fa";
import PillBox from "./PillBox";

const FloatingActionMenu = ({
    onOpenLetter,
    onOpenDocument,
    isLetterOpen,
    isDocumentOpen,
    isEncounterSaved = false,
}) => {
    const surfaceBg = "surface";

    return (
        <PillBox
            className="floating-action-menu"
            right="50px"
            top="50%"
            transform="translateY(-50%)"
            zIndex="1040"
            flexDirection="column"
            gap={2}
            px={1.5}
            py={2}
        >
            {/* Document Upload button */}
            <Tooltip
                content="Upload Document"
                positioning={{
                    placement: "left",
                }}
            >
                <IconButton
                    id="fab-document"
                    onClick={onOpenDocument}
                    aria-label="Open Document Upload"
                    size="xs"
                    borderRadius="full"
                    variant="ghost"
                    m={0}
                    bg={isDocumentOpen ? surfaceBg : "transparent"}
                    _hover={{ bg: surfaceBg }}
                    className="pill-box-icons"
                >
                    <FaFileUpload />
                </IconButton>
            </Tooltip>
            {/* Letter button */}
            <Tooltip
                content={
                    isEncounterSaved
                        ? "Patient Letter"
                        : "Save encounter to access Letter"
                }
                positioning={{
                    placement: "left",
                }}
            >
                <IconButton
                    id="fab-letter"
                    onClick={onOpenLetter}
                    aria-label="Open Letter"
                    size="sm"
                    borderRadius="full"
                    m={0}
                    variant="ghost"
                    bg={isLetterOpen ? surfaceBg : "transparent"}
                    _hover={{ bg: surfaceBg }}
                    className="pill-box-icons"
                    disabled={!isEncounterSaved}
                    opacity={!isEncounterSaved ? 0.4 : 1}
                    cursor={!isEncounterSaved ? "not-allowed" : "pointer"}
                >
                    <FaEnvelope />
                </IconButton>
            </Tooltip>
        </PillBox>
    );
};

export default FloatingActionMenu;

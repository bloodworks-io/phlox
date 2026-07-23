import { Box, Text } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { FaThumbtack } from "react-icons/fa";

// Preview component that mimics Summary.jsx field rendering
export const FieldPreview = ({ field }) => {
    const content = field.style_example || "";

    return (
        <Box className="cohesive-field">
            <Text className="cohesive-field-label">
                {field.field_name || "Unnamed Field"}
                {field.persistent && (
                    <Tooltip
                        content="Persists between encounters."
                        showArrow
                        positioning={{
                            placement: "right"
                        }}
                    >
                        <Box as="span" className="cohesive-persistent-marker">
                            <FaThumbtack />
                        </Box>
                    </Tooltip>
                )}
            </Text>
            <Box
                className="cohesive-textarea"
                minH="60px"
                p="2"
                borderRadius="sm"
                whiteSpace="pre-wrap"
                fontSize="sm"
                color="textTertiary"
            >
                {content || (
                    <Text
                        color="textSecondary"
                        asChild
                    ><i>
                            {field.persistent
                                ? "Persistent field content carries over..."
                                : "This field will be generated from the transcript..."}
                        </i></Text>
                )}
            </Box>
        </Box>
    );
};

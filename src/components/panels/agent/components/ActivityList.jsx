import React from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { FaInfoCircle, FaPen, FaCheck, FaFileAlt } from "react-icons/fa";

const ACTIVITY_ICONS = {
    info: FaInfoCircle,
    edit: FaPen,
    command: FaCheck,
    artifact: FaFileAlt,
};

const ACTIVITY_ICON_COLORS = {
    info: "overlay0",
    edit: "accent",
    command: "successButton",
    artifact: "secondaryButton",
};

export const ActivityList = ({ statuses }) => (
    <Box
        className="slim-scrollbar"
        maxHeight="132px"
        overflowY="auto"
        pr={1}
        css={{
            maskImage: "linear-gradient(to bottom, transparent 0, black 16px)",
            WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0, black 16px)",
        }}
    >
        {statuses.map((item) => {
            const Icon = ACTIVITY_ICONS[item.kind] || FaInfoCircle;
            return (
                <HStack key={item.id} gap={2} alignItems="flex-start" mb={1.5}>
                    <Box
                        as="span"
                        mt="3px"
                        color={ACTIVITY_ICON_COLORS[item.kind] || "overlay0"}
                        flexShrink={0}
                        display="flex"
                        alignItems="center"
                    >
                        <Icon size="10px" />
                    </Box>
                    <Text fontSize="xs" color="fg.subtle">
                        {item.content}
                    </Text>
                </HStack>
            );
        })}
    </Box>
);

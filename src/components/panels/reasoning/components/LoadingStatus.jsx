import React from "react";
import { Flex, Spinner, Text, VStack } from "@chakra-ui/react";
import {
    LuBookOpen,
    LuBriefcaseMedical,
    LuCog,
    LuDatabase,
    LuHistory,
} from "react-icons/lu";

const getStatusIcon = (status) => {
    const lower = status.toLowerCase();
    if (lower.includes("wikipedia") || lower.includes("wiki"))
        return LuBookOpen;
    if (lower.includes("pubmed") || lower.includes("literature"))
        return LuBriefcaseMedical;
    if (lower.includes("encounter"))
        return LuHistory;
    if (lower.includes("guideline"))
        return LuDatabase;
    return LuCog; // Default / general
};

export const LoadingStatus = ({ status }) => {
    if (!status) return null;

    const icon = getStatusIcon(status);

    return (
        <Flex
            position="absolute"
            top="64px"
            left={0}
            right={0}
            bottom={0}
            justify="center"
            align="center"
            zIndex={2}
            bg="folio.paper/90"
            flexDirection="column"
            gap={4}
            className="anim-fade-scale"
            css={{ animationDuration: "0.2s" }}
        >
            <VStack gap={4}>
                <Spinner size="lg" color="folio.accent" borderWidth="3px" />
                <Flex align="center" gap={3}>
                    {React.createElement(icon, {
                        size: "1.2em",
                        color: "var(--chakra-colors-folio-faint)",
                    })}
                    <Text
                        fontSize="sm"
                        fontWeight="medium"
                        color="folio.ink"
                    >
                        {status}
                    </Text>
                </Flex>
            </VStack>
        </Flex>
    );
};

export const LoadingOverlay = () => {
    return (
        <Flex
            position="absolute"
            top="64px"
            left={0}
            right={0}
            bottom={0}
            justify="center"
            align="center"
            zIndex={2}
            bg="folio.paper/70"
        >
            <Spinner size="lg" color="folio.accent" borderWidth="3px" />
        </Flex>
    );
};

import React from "react";
import { Box, Text, HStack } from "@chakra-ui/react";
import { LuCheck, LuFileText, LuInfo, LuPencil } from "react-icons/lu";

const ACTIVITY_ICONS = {
    info: LuInfo,
    edit: LuPencil,
    command: LuCheck,
    artifact: LuFileText,
};

const ACTIVITY_ICON_COLORS = {
    info: "folio.muted",
    edit: "folio.info",
    command: "folio.success",
    artifact: "folio.warning",
};

export const ActivityList = ({ statuses }) => (
    <Box
        className="slim-scrollbar"
        maxHeight="132px"
        overflowY="auto"
        pr={1}
        css={{
            maskImage:
                "linear-gradient(to bottom, black calc(100% - 16px), transparent 100%)",
            WebkitMaskImage:
                "linear-gradient(to bottom, black calc(100% - 16px), transparent 100%)",
        }}
    >
        {statuses.map((item) => {
            const Icon = ACTIVITY_ICONS[item.kind] || LuInfo;
            return (
                <HStack
                    key={item.id}
                    gap={2}
                    alignItems="flex-start"
                    mb={1.5}
                    className="anim-fade-slide-right"
                    css={{ animationDuration: "0.2s" }}
                >
                    <Box
                        as="span"
                        mt="3px"
                        color={
                            ACTIVITY_ICON_COLORS[item.kind] || "folio.muted"
                        }
                        flexShrink={0}
                        display="flex"
                        alignItems="center"
                    >
                        <Icon size="10px" />
                    </Box>
                    <Text fontSize="xs" color="folio.muted">
                        {item.content}
                    </Text>
                </HStack>
            );
        })}
    </Box>
);

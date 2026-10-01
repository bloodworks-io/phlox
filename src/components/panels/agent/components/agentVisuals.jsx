import React from "react";
import { Box } from "@chakra-ui/react";
import { FaWaveSquare } from "react-icons/fa";

export const StatusDot = ({ color, pulse }) => (
    <Box
        w="7px"
        h="7px"
        borderRadius="full"
        bg={color}
        flexShrink={0}
        className={pulse ? "live-bolt-pulse" : undefined}
    />
);

export const AgentSymbol = ({
    pulse,
    boxSize = "30px",
    iconSize = "13px",
    radius = "9px",
}) => (
    <Box
        w={boxSize}
        h={boxSize}
        borderRadius={radius}
        bg="primaryButtonFaint"
        color="accent"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        className={pulse ? "live-bolt-pulse" : undefined}
    >
        <FaWaveSquare size={iconSize} />
    </Box>
);

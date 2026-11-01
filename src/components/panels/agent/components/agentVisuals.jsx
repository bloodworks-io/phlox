import React from "react";
import { Box } from "@chakra-ui/react";
import { FaWaveSquare } from "react-icons/fa";

// Decorative pulse loop: static under prefers-reduced-motion.
// Inline (unlayered) emotion rules win over the layered global class, so
// the media query here reliably flattens `.live-bolt-pulse`.
const pulseCss = {
    animation: "phloxBoltPulse 1.6s ease-in-out infinite",
    _motionReduce: { animation: "none" },
};

export const StatusDot = ({ color, pulse }) => (
    <Box
        data-testid="agent-status-dot"
        w="7px"
        h="7px"
        borderRadius="full"
        bg={color}
        flexShrink={0}
        className={pulse ? "live-bolt-pulse" : undefined}
        css={pulse ? pulseCss : undefined}
    />
);

export const AgentSymbol = ({
    pulse,
    boxSize = "30px",
    iconSize = "13px",
    radius = "9px",
}) => (
    <Box
        data-testid="agent-symbol"
        w={boxSize}
        h={boxSize}
        borderRadius={radius}
        bg="folio.infoSoft"
        color="folio.info"
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        className={pulse ? "live-bolt-pulse" : undefined}
        css={pulse ? pulseCss : undefined}
    >
        <FaWaveSquare size={iconSize} />
    </Box>
);

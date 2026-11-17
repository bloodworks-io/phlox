import { Box } from "@chakra-ui/react";

export const InternalGlow = ({ tone = "danger" }) => (
    <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        borderRadius="full"
        overflow="hidden"
        pointerEvents="none"
    >
        <Box
            position="absolute"
            top="8%"
            left="8%"
            right="8%"
            bottom="8%"
            borderRadius="full"
            border="2px solid"
            borderColor={`folio.${tone}`}
            opacity={0.38}
            pointerEvents="none"
        />
    </Box>
);

export const LoadingOrb = ({ size = 46, tone = "brand", label = "Processing" }) => {
    const toneColor =
        tone === "muted" ? "folio.sidebarMuted" : "folio.brand";
    return (
        <Box
            position="relative"
            display="flex"
            alignItems="center"
            justifyContent="center"
            w={`${size}px`}
            h={`${size}px`}
            borderRadius="full"
            border="2px solid"
            borderColor={tone === "muted" ? "folio.line" : "folio.accentSoft"}
            backgroundColor="folio.sidebarAlt"
            overflow="hidden"
            role="status"
            aria-label={label}
        >
            <Box
                w={`${size * 0.28}px`}
                h={`${size * 0.28}px`}
                borderRadius="full"
                backgroundColor={toneColor}
            />
            <Box
                position="absolute"
                top="16%"
                left="16%"
                right="16%"
                bottom="16%"
                borderRadius="full"
                border="1px solid"
                borderColor={toneColor}
                opacity={0.35}
            />
        </Box>
    );
};

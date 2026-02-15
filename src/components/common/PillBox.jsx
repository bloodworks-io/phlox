import React from "react";
import { Box, Flex, useColorMode } from "@chakra-ui/react";

/**
 * Shared PillBox container component with consistent styling
 * Used by both ScribePillBox and FloatingActionMenu
 */
const PillBox = ({
  children,
  className,
  position = "fixed",
  bottom,
  right,
  left,
  top,
  transform,
  flexDirection = "row",
  gap = 3,
  zIndex = "1050",
  px = 4,
  py = 3,
}) => {
  const { colorMode } = useColorMode();

  return (
    <Box
      className={className}
      position={position}
      bottom={bottom}
      right={right}
      left={left}
      top={top}
      transform={transform}
      zIndex={zIndex}
      backdropFilter="blur(10px)"
      borderRadius="full"
      px={px}
      py={py}
    >
      <Flex align="center" gap={gap} flexDirection={flexDirection}>
        {children}
      </Flex>
    </Box>
  );
};

export default PillBox;

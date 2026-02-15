import React, { forwardRef } from "react";
import { Box, IconButton, Tooltip } from "@chakra-ui/react";
import { FaEnvelope } from "react-icons/fa";

const FloatingLetterButton = forwardRef(({ onClick, isActive }, ref) => {
    return (
        <Box
            position="fixed"
            bottom="20px"
            right="90px"
            zIndex="1000"
            className="hover-letter-box"
            ref={ref}
        >
            <Tooltip
                label={
                    isActive ? "Close Patient Letter" : "Open Patient Letter"
                }
                placement="top"
            >
                <IconButton
                    icon={<FaEnvelope boxSize="1.5em" />}
                    colorScheme="teal"
                    onClick={onClick}
                    aria-label={isActive ? "Close Letter" : "Open Letter"}
                    borderRadius="full"
                    size="lg"
                    bg={isActive ? "#6aafa7" : "#81c8be"} // Darker when active
                    className={`letter-icon ${isActive ? "letter-icon-active" : ""}`}
                    boxShadow={
                        isActive ? "0 0 10px rgba(129, 200, 190, 0.6)" : "md"
                    }
                    width="3em"
                    height="3em"
                    fontSize="2xl"
                    _hover={{
                        bg: isActive ? "#5a9e97" : "#6aafa7",
                        transform: "scale(1.05)",
                    }}
                    transition="all 0.2s ease-in-out"
                />
            </Tooltip>
        </Box>
    );
});

export default FloatingLetterButton;

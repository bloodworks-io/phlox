import React from "react";
import { Flex, Button, Spinner } from "@chakra-ui/react";
import { RepeatIcon, CopyIcon, CheckIcon } from "@chakra-ui/icons";
import { FaSave } from "react-icons/fa";

const PanelFooterActions = ({
    handleGenerateLetter,
    handleCopy,
    handleSave,
    recentlyCopied,
    saveState,
    letterLoading,
    additionalInstructions,
}) => {
    const getSaveButtonProps = () => {
        switch (saveState) {
            case "saving":
                return {
                    leftIcon: <Spinner size="sm" />,
                    children: "Saving...",
                };
            case "saved":
                return {
                    leftIcon: <CheckIcon />,
                    children: "Saved!",
                };
            default:
                return {
                    leftIcon: <FaSave />,
                    children: "Save Letter",
                };
        }
    };

    return (
        <Flex width="100%" justifyContent="space-between">
            <Button
                onClick={() => handleGenerateLetter(additionalInstructions)}
                className="red-button"
                leftIcon={<RepeatIcon />}
                isDisabled={letterLoading || saveState !== "idle"}
            >
                Regenerate Letter
            </Button>
            <Flex>
                <Button
                    onClick={handleCopy}
                    className="grey-button"
                    leftIcon={recentlyCopied ? <CheckIcon /> : <CopyIcon />}
                    mr="2"
                    isDisabled={letterLoading}
                >
                    {recentlyCopied ? "Copied!" : "Copy Letter"}
                </Button>
                <Button
                    onClick={handleSave}
                    className="green-button"
                    isDisabled={letterLoading || saveState !== "idle"}
                    {...getSaveButtonProps()}
                />
            </Flex>
        </Flex>
    );
};

export default PanelFooterActions;

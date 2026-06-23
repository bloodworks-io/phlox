import React from "react";
import { Steps, Flex, Button, Spinner } from "@chakra-ui/react";
import { RepeatIcon, CopyIcon, CheckIcon } from "../../common/icons";
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
                disabled={letterLoading || saveState !== "idle"}><RepeatIcon />Regenerate Letter
                            </Button>
            <Flex>
                <Button
                    onClick={handleCopy}
                    className="grey-button"
                    mr="2"
                    disabled={letterLoading}>{recentlyCopied ? <CheckIcon /> : <CopyIcon />}{recentlyCopied ? "Copied!" : "Copy Letter"}</Button>
                <Button
                    onClick={handleSave}
                    className="green-button"
                    disabled={letterLoading || saveState !== "idle"}
                    {...getSaveButtonProps()}
                />
            </Flex>
        </Flex>
    );
};

export default PanelFooterActions;

import React from "react";
import { useTranslation } from "react-i18next";
import { Flex, Button, Spinner } from "@chakra-ui/react";
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
    const { t } = useTranslation();
    const getSaveButtonProps = () => {
        switch (saveState) {
            case "saving":
                return {
                    leftIcon: <Spinner size="sm" />,
                    children: t("patient.savingOngoing"),
                };
            case "saved":
                return {
                    leftIcon: (
                        <CheckIcon
                            className="anim-fade-scale"
                            css={{ animationDuration: "0.2s" }}
                        />
                    ),
                    children: t("letter.saved"),
                };
            default:
                return {
                    leftIcon: <FaSave />,
                    children: t("letter.save"),
                };
        }
    };

    return (
        <Flex width="100%" justifyContent="space-between">
            <Button
                onClick={() => handleGenerateLetter(additionalInstructions)}
                className="red-button"
                disabled={letterLoading || saveState !== "idle"}><RepeatIcon />{t("letter.regenerate")}
                            </Button>
            <Flex>
                <Button
                    onClick={handleCopy}
                    className="grey-button"
                    mr="2"
                    disabled={letterLoading}>{
                        recentlyCopied ? (
                            <CheckIcon
                                className="anim-fade-scale"
                                css={{ animationDuration: "0.2s" }}
                            />
                        ) : (
                            <CopyIcon />
                        )
                    }{recentlyCopied ? t("letter.copied") : t("letter.copy")}</Button>
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

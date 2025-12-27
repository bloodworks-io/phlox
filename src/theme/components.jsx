// Custom component styles for the Chakra UI theme.
import { colors } from "./colors";

export const components = {
    Alert: {
        baseStyle: (props) => ({
            container: {
                backgroundColor:
                    props.colorMode === "light"
                        ? colors.light.base
                        : colors.dark.crust,
                color:
                    props.colorMode === "light"
                        ? `${colors.light.textSecondary} !important`
                        : `${colors.dark.textSecondary} !important`,
                fontWeight: "normal",
                border:
                    props.colorMode === "light"
                        ? `1px solid ${colors.light.surface} !important`
                        : `1px solid ${colors.dark.surface} !important`,
            },
            title: {
                color:
                    props.colorMode === "light"
                        ? colors.light.textPrimary
                        : colors.dark.textPrimary,
                fontWeight: "600",
            },
            description: {
                color:
                    props.colorMode === "light"
                        ? colors.light.textSecondary
                        : colors.dark.textSecondary,
            },
        }),
        defaultProps: {
            variant: "solid",
        },
    },
    Button: {
        variants: {
            primary: (props) => ({
                backgroundColor:
                    props.colorMode === "light"
                        ? colors.light.primaryButton
                        : colors.dark.primaryButton,
                color:
                    props.colorMode === "light"
                        ? colors.light.invertedText
                        : colors.dark.invertedText,
                _hover: {
                    backgroundColor:
                        props.colorMode === "light"
                            ? colors.light.buttonHover.primary
                            : colors.dark.buttonHover.primary,
                },
                _active: {
                    backgroundColor:
                        props.colorMode === "light"
                            ? colors.light.primaryButton
                            : colors.dark.primaryButton,
                },
            }),
            secondary: (props) => ({
                backgroundColor:
                    props.colorMode === "light"
                        ? colors.light.secondaryButton
                        : colors.dark.secondaryButton,
                color:
                    props.colorMode === "light"
                        ? colors.light.invertedText
                        : colors.dark.invertedText,
                _hover: {
                    backgroundColor:
                        props.colorMode === "light"
                            ? colors.light.buttonHover.secondary
                            : colors.dark.buttonHover.secondary,
                },
                _active: {
                    backgroundColor:
                        props.colorMode === "light"
                            ? colors.light.secondaryButton
                            : colors.dark.secondaryButton,
                },
            }),
            icon: (props) => ({
                backgroundColor:
                    props.colorMode === "light"
                        ? colors.light.neutralButton
                        : colors.dark.neutralButton,
                color:
                    props.colorMode === "light"
                        ? colors.light.invertedText
                        : colors.dark.invertedText,
                _hover: {
                    backgroundColor:
                        props.colorMode === "light"
                            ? colors.light.buttonHover.neutral
                            : colors.dark.buttonHover.neutral,
                },
                _active: {
                    backgroundColor:
                        props.colorMode === "light"
                            ? colors.light.neutralButton
                            : colors.dark.neutralButton,
                },
            }),
        },
    },
};

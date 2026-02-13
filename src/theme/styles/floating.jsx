// Styles for the chat interface.
import { colors } from "../colors";

export const floatingStyles = (props) => ({
  ".chat-icon": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.chatIcon} !important`
        : `${colors.dark.chatIcon} !important`,
    color:
      props.colorMode === "light"
        ? `${colors.light.invertedText} !important`
        : `${colors.dark.invertedText} !important`,
  },
  ".floating-panel": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.secondary} !important`
        : `${colors.dark.secondary} !important`,
    border:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface} !important`
        : `1px solid ${colors.dark.surface} !important`,
    color:
      props.colorMode === "light"
        ? `${colors.light.textSecondary} !important`
        : `${colors.dark.textSecondary} !important`,
    fontSize: "1rem !important",
    fontWeight: "700",
  },
  ".floating-main": {
    backgroundColor:
      props.colorMode === "light" ? colors.light.base : colors.dark.crust,
    color:
      props.colorMode === "light"
        ? `${colors.light.textSecondary} !important`
        : `${colors.dark.textSecondary} !important`,
    fontWeight: "normal",
    borderRadius: "lg !important",
    fontSize: "0.7rem !important",
  },
  ".chat-suggestions": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.crust} !important`
        : `${colors.dark.overlay0} !important`,
    borderRadius: "xl !important",
    border:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface} !important`
        : "none !important",
    color:
      props.colorMode === "light"
        ? `${colors.light.textSecondary} !important`
        : `${colors.dark.textTertiary} !important`,
  },
  ".quick-chat-buttons-collapsed": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.crust} !important`
        : `${colors.dark.overlay0} !important`,
    borderRadius: "lg !important",
    border:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface} !important`
        : "none !important",
    color:
      props.colorMode === "light"
        ? `${colors.light.textSecondary} !important`
        : `${colors.dark.textTertiary} !important`,
    justifyContent: "flex-start !important",
    padding: "0 8px !important",
    height: "32px !important",
  },

  ".quick-chat-buttons-text": {
    maxWidth: "calc(100% - 24px) !important",
    whiteSpace: "nowrap !important",
    overflow: "hidden !important",
    textOverflow: "ellipsis !important",
    textAlign: "left !important",
    display: "block !important",
  },
  ".message-box": {
    padding: "10px",
    borderRadius: "8px",
    wordBreak: "break-word",
  },
  ".message-box.assistant": {
    backgroundColor:
      props.colorMode === "light"
        ? colors.light.secondary
        : colors.dark.secondary,
    color:
      props.colorMode === "light"
        ? `${colors.light.textSecondary} !important`
        : `${colors.dark.textSecondary} !important`,
    borderRadius: "lg !important",
  },
  ".message-box.user": {
    backgroundColor: colors.light.secondaryButton,
    color: colors.light.invertedText,
    borderRadius: "lg !important",
  },
  ".message-box ul, .message-box ol": {
    paddingLeft: "20px",
  },
  ".template-selector": {
    borderTop:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface} !important`
        : `1px solid ${colors.dark.surface} !important`,
  },
  ".template-selector .template-selector": {
    textAlign: "left !important",
    display: "block !important",
  },
  ".thinking-toggle": {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 6px",
    margin: "2px 0",
    cursor: "pointer",
    userSelect: "none",
  },
  ".thinking-block": {
    borderLeftColor:
      props.colorMode === "light"
        ? `${colors.light.secondaryButton} !important`
        : `${colors.light.secondaryButton} !important`,
  },
  ".thinking-block-text": {
    fontSize: "0.9rem !important",
  },
  ".collapse-toggle": {
    border: "none !important",
    borderRadius: "lg !important",
    color:
      props.colorMode === "light"
        ? `${colors.light.textSecondary} !important`
        : `${colors.dark.textTertiary} !important`,
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.crust} !important`
        : `${colors.dark.base} !important`,
  },
  ".fam-main-button": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.surface} !important` // Choose a prominent color
        : `${colors.dark.surface} !important`,
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.textTertiary} !important`,
    transition: "transform 0.2s ease-in-out, background-color 0.2s ease-in-out",
    _hover: {
      transform: "scale(1.1)",
      backgroundColor:
        props.colorMode === "light"
          ? `${colors.light.primaryHover} !important` // Darker/lighter shade
          : `${colors.dark.primaryHover} !important`,
    },
  },
  ".fam-action-button": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.surface} !important`
        : `${colors.dark.surface} !important`,
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.textTertiary} !important`,

    transition:
      "transform 0.15s ease-in-out, background-color 0.15s ease-in-out",
    _hover: {
      transform: "scale(1.05)",
      backgroundColor:
        props.colorMode === "light"
          ? `${colors.light.overlay0} !important`
          : `${colors.dark.overlay0} !important`,
    },
  },
});

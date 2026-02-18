// Styles for text input fields and buttons.
import { colors } from "../colors";
import { lightenColor, darkenColor } from "../utils"; // adjust path as needed

export const inputStyles = (props) => ({
  ".textarea-style": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.base} !important`
        : `${colors.dark.crust} !important`,
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.textTertiary} !important`,
    border: "none !important",
    resize: "none !important",
    fontSize: "0.9rem !important",
    padding: "8px !important",
    borderRadius: "4px !important",
    overflow: "hidden !important",
    whiteSpace: "pre-wrap !important",
    boxShadow: "none !important",
    "&::placeholder": {
      color:
        props.colorMode === "light"
          ? colors.light.overlay0
          : colors.dark.overlay0,
    },
    "&:focus": {
      outline: "none !important",
      boxShadow: "none !important",
      border: "none !important",
    },
    minHeight: "auto !important",
  },
  ".letter-editor-textarea": {
    overflow: "auto !important",
  },
  ".input-style": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.base} !important`
        : `${colors.dark.crust} !important`,
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.textTertiary} !important`,
    border:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface} !important`
        : `${colors.dark.textTertiary} !important`,
    padding: "7px 8px !important",
    borderRadius: "sm !important",
    fontSize: "0.9rem !important",
  },
  ".chat-input": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.base} !important`
        : `${colors.dark.crust} !important`,
    border:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface} !important`
        : `1px solid ${colors.dark.surface} !important`,
    borderRadius: "md !important",
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.textSecondary} !important`,
  },
  ".clinic-date-input": {
    backgroundColor:
      props.colorMode === "light"
        ? "white !important"
        : `${colors.dark.crust} !important`,
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.textTertiary} !important`,
    border:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface} !important`
        : `1px solid ${colors.dark.surface} !important`,
  },
  ".search-button": {
    borderLeft: "none !important",
    borderTopLeftRadius: "0 !important",
    borderBottomLeftRadius: "0 !important",
    borderTopRightRadius: "md !important",
    borderBottomRightRadius: "md !important",
    marginLeft: "-5px",
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.surface2} !important`
        : `${colors.dark.base} !important`,
    border:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface2} !important`
        : `${colors.dark.textTertiary} !important`,
    color: "#575279 !important",
  },
  ".search-button:hover": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.surface} !important`
        : `${colors.dark.surface2} !important`,
  },
  ".template-field-container": {
    backgroundColor:
      props.colorMode === "light" ? colors.light.surface : colors.dark.surface,
    borderRadius: "sm",
    padding: "1rem",
    marginBottom: "1rem",
    border:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface2}`
        : `1px solid ${colors.dark.surface2}`,
  },

  ".template-field-header": {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  ".template-field-label": {
    color:
      props.colorMode === "light"
        ? colors.light.textPrimary
        : colors.dark.textPrimary,
  },
  ".textarea-container": {
    position: "relative",
    width: "100%",
    "&:hover .refinement-fab": {
      opacity: 1,
    },
  },
  ".cohesive-fields-container": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.base} !important`
        : `${colors.dark.crust} !important`,
    borderRadius: "lg !important",
    border: "none !important",
    padding: "12px !important",
    overflow: "hidden !important",
  },
  ".cohesive-field": {
    borderBottom: "none !important",
    marginBottom: "16px !important",
    "&:last-child": {
      marginBottom: "0 !important",
    },
  },
  ".cohesive-field--empty": {
    marginBottom: "20px !important",
  },
  ".cohesive-field-label": {
    fontSize: "1rem !important",
    fontWeight: "500 !important",
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.textTertiary} !important`,
    padding: "0 0 4px 0 !important",
    marginBottom: "4px !important",
  },
  ".cohesive-persistent-marker": {
    marginLeft: "6px !important",
    display: "inline-flex !important",
    alignItems: "center !important",
    verticalAlign: "middle !important",
    color:
      props.colorMode === "light"
        ? `${colors.light.overlay0} !important`
        : `${colors.dark.overlay0} !important`,
    fontSize: "0.7rem !important",
  },
  ".cohesive-textarea": {
    backgroundColor: "transparent !important",
    border: "none !important",
    borderRadius: "0 !important",
    padding: "0 !important",
    fontSize: "1rem !important",
    lineHeight: "1.5 !important",
    width: "100% !important",
    resize: "none !important",
    "&:focus": {
      outline: "none !important",
      backgroundColor: "transparent !important",
    },
    "&::placeholder": {
      color:
        props.colorMode === "light"
          ? colors.light.overlay0
          : colors.dark.overlay0,
    },
  },
  ".cohesive-textarea--empty": {
    minHeight: "24px !important",
    "&::placeholder": {
      color:
        props.colorMode === "light"
          ? `${colors.light.textSecondary} !important`
          : `${colors.dark.textSecondary} !important`,
      opacity: "1 !important",
    },
  },
  ".refinement-fab": {
    borderRadius: "full !important",
    color: `${colors.light.invertedText} !important`,
    border:
      props.colorMode === "light"
        ? `1px solid ${darkenColor(colors.light.extraButton, 0.15)} !important`
        : `none !important`,
    backgroundColor: `${
      props.colorMode === "light"
        ? colors.light.extraButton
        : colors.light.extraButton
    } !important`,
    opacity: 0,
    transition: "opacity 0.2s ease-in-out",
    width: "40px !important",
    height: "40px !important",
    aspectRatio: "1/1",
    "&:hover": {
      backgroundColor: `${
        props.colorMode === "light"
          ? lightenColor(colors.light.extraButton)
          : lightenColor(colors.light.extraButton)
      } !important`,
    },
  },
  ".refinement-submit-button": {
    borderRadius: "lg !important",
    color: `${colors.light.invertedText} !important`,
    backgroundColor: `${
      props.colorMode === "light"
        ? colors.light.extraButton
        : colors.light.extraButton
    } !important`,
    border:
      props.colorMode === "light"
        ? `1px solid ${darkenColor(colors.light.extraButton, 0.15)} !important`
        : `none !important`,
    "&:hover": {
      backgroundColor: `${
        props.colorMode === "light"
          ? lightenColor(colors.light.extraButton)
          : lightenColor(colors.light.extraButton)
      } !important`,
    },
  },
  ".reason-button": {
    backgroundColor: "transparent !important",
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.invertedText} !important`,
    fontSize: "sm !important",
    borderRadius: "lg !important",
    borderRightRadius: "none !important",
    height: "30px !important",
    fontWeight: "medium !important",
    _active: {
      transform: "none !important",
    },
    "&:hover": {
      backgroundColor: `${
        props.colorMode === "light"
          ? lightenColor(colors.light.crust)
          : lightenColor(colors.dark.crust)
      } !important`,
    },
  },
  ".reason-button-active": {
    backgroundColor: `${
      props.colorMode === "light" ? colors.light.crust : colors.dark.base
    } !important`,
  },
  ".reason-button-active-patient-table": {
    backgroundColor: `${
      props.colorMode === "light" ? colors.light.crust : colors.dark.crust
    } !important`,
  },
  ".transcription-style": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.base} !important`
        : `${colors.dark.crust} !important`,
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.textTertiary} !important`,
    border: "none !important",
    fontSize: "0.9rem !important",
    padding: "8px !important",
    borderRadius: "4px !important",
    whiteSpace: "pre-wrap !important",
    boxShadow: "none !important",
    "&::placeholder": {
      color:
        props.colorMode === "light"
          ? colors.light.overlay0
          : colors.dark.overlay0,
    },
    "&:focus": {
      outline: "none !important",
      boxShadow: "none !important",
      border: "none !important",
    },
    overflowY: "auto !important",
    resize: "none",
    maxHeight: "200px !important",
    fontFamily: "'Roboto', sans-serif",
    lineHeight: "1.6",
    backgroundColor: "var(--chakra-colors-gray-50)",
  },
  ".scroll-container": {
    marginLeft: "-5px",
    scrollbarWidth: "thin",
    scrollbarColor: `${
      props.colorMode === "light"
        ? `${colors.light.overlay0} ${colors.light.surface}`
        : `${colors.dark.overlay0} ${colors.dark.surface}`
    }`,
    "&::-webkit-scrollbar": {
      width: "4px",
    },
    "&::-webkit-scrollbar-track": {
      backgroundColor:
        props.colorMode === "light"
          ? colors.light.surface
          : colors.dark.surface,
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor:
        props.colorMode === "light"
          ? colors.light.overlay0
          : colors.dark.overlay0,
      borderRadius: "4px",
    },
  },
  ".transcription-view": {
    backgroundColor:
      props.colorMode === "light"
        ? `${colors.light.base} !important`
        : `${colors.dark.crust} !important`,
    color:
      props.colorMode === "light"
        ? `${colors.light.textTertiary} !important`
        : `${colors.dark.textTertiary} !important`,
    border:
      props.colorMode === "light"
        ? `1px solid ${colors.light.surface} !important`
        : `1px solid ${colors.dark.surface} !important`,
    resize: "none !important",
    fontSize: "0.9rem !important",
    padding: "8px !important",
    borderRadius: "lg !important",
    overflow: "auto !important",
    whiteSpace: "pre-wrap !important",
    boxShadow: "none !important",
    "&::placeholder": {
      color:
        props.colorMode === "light"
          ? colors.light.overlay0
          : colors.dark.overlay0,
    },
    "&:focus": {
      outline: "none !important",
      boxShadow: "none !important",
      border: "none !important",
    },
    minHeight: "140px !important",
    maxHeight: "200px !important",
  },
});

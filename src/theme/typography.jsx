// Defines the typographic styles for the application.
const publicSans = '"Public Sans", system-ui, sans-serif';
const sourceSerif = '"Source Serif 4", Georgia, serif';

export const typography = {
    fonts: {
        heading: publicSans,
        body: publicSans,
        display: sourceSerif,
    },
    styles: {
        h1: {
            fontFamily: publicSans,
            fontSize: ["1.75rem", "2rem"],
            fontWeight: "700",
            lineHeight: "1.2",
            marginBottom: "1rem",
            textWrap: "balance",
            letterSpacing: "-0.02em",
        },
        h2: {
            fontFamily: publicSans,
            fontSize: ["1.5rem", "1.75rem"],
            fontWeight: "700",
            lineHeight: "1.2",
            marginBottom: "0.5rem",
            textWrap: "balance",
        },
        h3: {
            fontFamily: publicSans,
            fontSize: ["1rem", "1.275rem"],
            fontWeight: "700",
            lineHeight: "1.2",
            textWrap: "balance",
        },
        h4: {
            fontFamily: publicSans,
            fontSize: ["0.875rem", "1rem"],
            fontWeight: "600",
            lineHeight: "1",
        },
        h5: {
            fontFamily: publicSans,
            fontSize: ["1.125rem", "1.25rem"],
            fontWeight: "600",
            lineHeight: "1.25",
            marginBottom: "0.5rem",
        },
        h6: {
            fontFamily: publicSans,
            fontSize: ["1rem", "1.125rem"],
            fontWeight: "600",
            lineHeight: "1.25",
            marginBottom: "0.5rem",
        },
        h7: {
            fontFamily: publicSans,
            fontWeight: "700 !important",
            lineHeight: "1.5",
        },
    },
};

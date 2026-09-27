import { ChevronDownIcon, ChevronRightIcon } from "../icons";

// Single chevron that rotates when a disclosure opens, instead of
// swapping between two icons. Keeps toggles smooth app-wide.
// - Default: right chevron rotates 90deg (pointing down) when open.
// - direction="up": down chevron rotates 180deg (pointing up) when open,
//   for panels that collapse upward.
const AnimatedChevron = ({ isOpen, direction = "right", ...props }) => {
    const Icon = direction === "up" ? ChevronDownIcon : ChevronRightIcon;
    const rotation =
        direction === "up"
            ? isOpen
                ? "rotate(180deg)"
                : "rotate(0deg)"
            : isOpen
              ? "rotate(90deg)"
              : "rotate(0deg)";
    return (
        <Icon
            {...props}
            style={{
                transform: rotation,
                transition: "transform 0.2s ease",
            }}
        />
    );
};

export default AnimatedChevron;

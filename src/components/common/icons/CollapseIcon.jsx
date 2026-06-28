const CollapseIcon = ({ boxSize = "20px" }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.5"
        width={boxSize}
        height={boxSize}
    >
        <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="5"
            ry="5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
        <path
            d="M9.5 21V3"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

export default CollapseIcon;

// Reusable button components with predefined styles for different actions.
import { Button, IconButton } from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";

// Primary Action Buttons
export const GreenButton = ({ children, ...props }) => (
    <Button className="green-button" {...props}>
        {children}
    </Button>
);

export const RedButton = ({ children, ...props }) => (
    <Button className="red-button" {...props}>
        {children}
    </Button>
);

export const OrangeButton = ({ children, ...props }) => (
    <Button className="orange-button" {...props}>
        {children}
    </Button>
);

export const TertiaryButton = ({ children, ...props }) => (
    <Button className="tertiary-button" {...props}>
        {children}
    </Button>
);

export const GreyButton = ({ children, ...props }) => (
    <Button className="grey-button" {...props}>
        {children}
    </Button>
);

// Utility Buttons
export const SettingsButton = ({ children, ...props }) => (
    <Button className="settings-button" {...props}>
        {children}
    </Button>
);

export const SettingsIconButton = ({ ...props }) => (
    <IconButton className="settings-button" {...props} />
);

export const SummaryButton = ({ children, ...props }) => (
    <Button className="summary-buttons" {...props}>
        {children}
    </Button>
);

// Navigation Buttons
export const NavButton = ({ children, ...props }) => (
    <Button className="nav-button" {...props}>
        {children}
    </Button>
);

export const SmallNavButton = ({ children, ...props }) => (
    <Button className="small-nav-button" {...props}>
        {children}
    </Button>
);

// Toggle Buttons
export const CollapseToggle = ({ ...props }) => (
    <IconButton className="collapse-toggle" {...props} />
);

export const DarkToggle = ({ ...props }) => (
    <IconButton className="dark-toggle" {...props} />
);

// Search Button
export const SearchButton = ({ ...props }) => (
    <IconButton className="search-button" {...props} />
);

// Mode Switch Button
export const ModeSwitchButton = ({ children, isActive, ...props }) => (
    <Button
        className={`mode-selector-button ${isActive ? "active" : ""}`}
        {...props}
    >
        {children}
    </Button>
);
export const RefreshIconButton = ({ isLoading, onClick, ...props }) => (
    <IconButton
        icon={<RepeatIcon />}
        onClick={onClick}
        isLoading={isLoading}
        aria-label="Refresh"
        size="sm"
        className="settings-button"
        borderRadius="sm"
        {...props}
    />
);

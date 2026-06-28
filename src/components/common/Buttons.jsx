// Reusable button components with predefined styles for different actions.
// v3 note: Button no longer has `leftIcon`/`rightIcon` props — extract leftIcon
// and render it as the first child so call sites can keep using leftIcon={<X/>}.
import { Steps, Button } from "@chakra-ui/react";

// Primary Action Buttons
export const GreenButton = ({ children, leftIcon, ...props }) => (
  <Button className="green-button" gap="2" {...props}>
    {leftIcon}
    {children}
  </Button>
);

export const RedButton = ({ children, leftIcon, ...props }) => (
  <Button className="red-button" gap="2" {...props}>
    {leftIcon}
    {children}
  </Button>
);

export const GreyButton = ({ children, leftIcon, ...props }) => (
  <Button className="grey-button" gap="2" {...props}>
    {leftIcon}
    {children}
  </Button>
);

// Utility Buttons
export const SettingsButton = ({ children, leftIcon, ...props }) => (
  <Button className="settings-button" gap="2" {...props}>
    {leftIcon}
    {children}
  </Button>
);

// Navigation Buttons
export const NavButton = ({ children, leftIcon, ...props }) => (
  <Button className="nav-button" gap="2" {...props}>
    {leftIcon}
    {children}
  </Button>
);

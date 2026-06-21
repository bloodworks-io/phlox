// Reusable button components with predefined styles for different actions.
import { Button } from "@chakra-ui/react";

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

// Navigation Buttons
export const NavButton = ({ children, ...props }) => (
  <Button className="nav-button" {...props}>
    {children}
  </Button>
);

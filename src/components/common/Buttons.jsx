// Reusable button components with predefined styles for different actions.
// v3 note: Button no longer has `leftIcon`/`rightIcon` props — extract leftIcon
// and render it as the first child so call sites can keep using leftIcon={<X/>}.
import { Button } from "@chakra-ui/react";

// Semantic buttons. Each wrapper maps a clinical meaning to a
// Folio recipe variant; sizes, loading, and disabled behavior stay with the
// underlying Chakra Button API.
const withLeftIcon = (VariantButton) => {
  const Wrapped = ({ children, leftIcon = null, ...props }) => (
    <VariantButton gap="2" {...props}>
      {leftIcon}
      {children}
    </VariantButton>
  );
  return Wrapped;
};

// Final actions: submit, save-and-finish, download, confirm.
export const PrimaryButton = withLeftIcon((props) => (
  <Button variant="folioPrimary" {...props} />
));

// Quiet actions: cancel, back, close, intermediate and utility steps.
export const SecondaryButton = withLeftIcon((props) => (
  <Button variant="folioSecondary" {...props} />
));

// Completed-state actions: selected, downloaded, saved, copied, in use.
export const SuccessButton = withLeftIcon((props) => (
  <Button variant="folioSuccess" {...props} />
));

// Destructive actions: delete, reset, discard.
export const DangerButton = withLeftIcon((props) => (
  <Button variant="folioDanger" {...props} />
));

// Cautionary actions that are neither routine nor destructive.
export const WarningButton = withLeftIcon((props) => (
  <Button variant="folioWarning" {...props} />
));

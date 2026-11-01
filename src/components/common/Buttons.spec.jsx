import { afterEach, describe, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import {
  PrimaryButton,
  SecondaryButton,
  SuccessButton,
  DangerButton,
  WarningButton,
  GreenButton,
  RedButton,
  GreyButton,
  SettingsButton,
  NavButton,
} from "./Buttons";
import { emotionStylesFor, renderWithProviders } from "../../test/utils";

afterEach(cleanup);

const variantCases = [
  ["PrimaryButton", PrimaryButton, "folio-accent", "folio-accent-ink"],
  ["SecondaryButton", SecondaryButton, "folio-line", "folio-hover"],
  ["SuccessButton", SuccessButton, "folio-success", "folio-success-ink"],
  ["DangerButton", DangerButton, "folio-danger", "folio-danger-ink"],
  ["WarningButton", WarningButton, "folio-warning", "folio-warning-ink"],
];

describe("semantic Folio button wrappers", () => {
  it.each(variantCases)(
    "%s renders with its Folio variant tokens",
    (_name, Wrapper, surface, ink) => {
      renderWithProviders(<Wrapper>Act</Wrapper>);
      const styles = emotionStylesFor(screen.getByRole("button"));
      expect(styles).toContain(`var(--chakra-colors-${surface})`);
      expect(styles).toContain(`var(--chakra-colors-${ink})`);
    },
  );

  it("renders leftIcon content before the label and forwards button props", () => {
    const onClick = () => {};
    renderWithProviders(
      <PrimaryButton leftIcon={<span data-testid="icon" />} onClick={onClick} disabled>
        Save
      </PrimaryButton>,
    );

    const button = screen.getByRole("button", { name: /save/i });
    expect(button).toBeDisabled();
    expect(button.firstChild).toBe(screen.getByTestId("icon"));
    expect(button.textContent).toBe("Save");
  });

  it("passes loading behavior through to the underlying Button", () => {
    renderWithProviders(<DangerButton loading loadingText="Deleting">Delete</DangerButton>);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-loading");
  });
});

describe("legacy color-named wrappers stay available for compatibility", () => {
  it.each([
    ["GreenButton", GreenButton, "green-button"],
    ["RedButton", RedButton, "red-button"],
    ["GreyButton", GreyButton, "grey-button"],
    ["SettingsButton", SettingsButton, "grey-button"],
    ["NavButton", NavButton, "nav-button"],
  ])("%s keeps its legacy class export", (_name, Wrapper, className) => {
    renderWithProviders(<Wrapper>Legacy</Wrapper>);
    expect(screen.getByRole("button")).toHaveClass(className);
  });
});

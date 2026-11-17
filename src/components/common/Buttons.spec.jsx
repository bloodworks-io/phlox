import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { cleanup, screen } from "@testing-library/react";
import {
  PrimaryButton,
  SecondaryButton,
  SuccessButton,
  DangerButton,
  WarningButton,
} from "./Buttons";
import { emotionStylesFor, renderWithProviders } from "../../test/utils";

const here = path.dirname(fileURLToPath(import.meta.url));
const readSource = () => readFileSync(path.resolve(here, "Buttons.jsx"), "utf8");

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

describe("legacy color-named wrappers are retired", () => {
  it("exports only the semantic Folio wrappers", () => {
    const buttons = readSource();
    for (const legacy of [
      "GreenButton",
      "RedButton",
      "GreyButton",
      "SettingsButton",
      "NavButton",
      "green-button",
      "red-button",
      "grey-button",
      "nav-button",
    ]) {
      expect(buttons).not.toContain(legacy);
    }
    for (const semantic of [
      "PrimaryButton",
      "SecondaryButton",
      "SuccessButton",
      "DangerButton",
      "WarningButton",
    ]) {
      expect(buttons).toContain(semantic);
    }
  });
});

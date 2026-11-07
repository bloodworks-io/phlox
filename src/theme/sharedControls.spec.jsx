import { describe, expect, it } from "vitest";
import { system } from "./index";
import { Button, Input, Textarea } from "@chakra-ui/react";
import { screen } from "@testing-library/react";
import { emotionStylesFor, renderWithProviders } from "../test/utils";

const resolveButton = (variant) =>
  system.getRecipeFn("button")({ variant });

describe("Folio shared button foundation", () => {
  it("keeps the default Chakra variants and sizes while adding Folio variants", () => {
    const recipe = system.getRecipe("button");
    const variants = Object.keys(recipe.variants.variant);

    for (const legacy of [
      "solid",
      "subtle",
      "surface",
      "outline",
      "ghost",
      "plain",
    ]) {
      expect(variants).toContain(legacy);
    }
    for (const folio of [
      "folioPrimary",
      "folioSecondary",
      "folioSuccess",
      "folioDanger",
      "folioWarning",
    ]) {
      expect(variants).toContain(folio);
    }
    expect(recipe.variants.size).toHaveProperty("sm");
    expect(recipe.variants.size).toHaveProperty("md");
    expect(recipe.defaultVariants).toEqual({ size: "md", variant: "solid" });
  });

  it("resolves folioPrimary to the Folio accent surface", () => {
    const css = JSON.stringify(resolveButton("folioPrimary"));
    expect(css).toContain("var(--chakra-colors-folio-accent)");
    expect(css).toContain("var(--chakra-colors-folio-accent-ink)");
    expect(css).toContain("var(--chakra-radii-folio-control)");
  });

  it("resolves folioSecondary to the quiet outline surface", () => {
    const css = JSON.stringify(resolveButton("folioSecondary"));
    expect(css).toContain("var(--chakra-colors-folio-line)");
    expect(css).toContain("var(--chakra-colors-folio-hover)");
    expect(css).toContain("var(--chakra-radii-folio-control)");
  });

  it.each([
    ["folioSuccess", "folio-success", "folio-success-ink"],
    ["folioDanger", "folio-danger", "folio-danger-ink"],
    ["folioWarning", "folio-warning", "folio-warning-ink"],
  ])(
    "resolves %s to its status surface and explicit on-fill ink",
    (variant, surface, ink) => {
      const css = JSON.stringify(resolveButton(variant));
      expect(css).toContain(`var(--chakra-colors-${surface})`);
      expect(css).toContain(`var(--chakra-colors-${ink})`);
    },
  );

  it("gives ordinary buttons the Folio control radius by default", () => {
    const css = JSON.stringify(resolveButton("solid"));
    expect(css).toContain("var(--chakra-radii-folio-control)");
  });

  it("uses a 160ms color/background/border/opacity transition with no active scale", () => {
    const baseLayer = system.getGlobalCss()["@layer base"];
    const globalCss = JSON.stringify(baseLayer);

    expect(globalCss).toContain("160ms");
    expect(globalCss).not.toContain("scale(0.97)");
    const transition = baseLayer["&.chakra-button"];
    expect(transition.transition).toContain("color 160ms");
    expect(transition.transition).toContain("background-color 160ms");
    expect(transition.transition).toContain("border-color 160ms");
    expect(transition.transition).toContain("opacity 160ms");
  });

  it("focuses buttons with the Folio focus color", () => {
    const focusRule =
      system.getGlobalCss()["@layer base"]["&.chakra-button:focus-visible"];
    expect(focusRule.outline).toContain(
      "var(--chakra-colors-folio-focus)",
    );
  });

  it("renders Folio variants through the real Button component", () => {
    renderWithProviders(<Button variant="folioWarning">Warn</Button>);
    const styles = emotionStylesFor(screen.getByRole("button"));
    expect(styles).toContain("var(--chakra-colors-folio-warning)");
    expect(styles).toContain("var(--chakra-colors-folio-warning-ink)");
  });
});

describe("Folio input foundation", () => {
  it("converts the default outline input to Folio while preserving unstyled", () => {
    const recipe = system.getRecipe("input");
    const outline = recipe.variants.variant.outline;
    const unstyled = recipe.variants.variant.unstyled;

    expect(outline.bg).toBe("folio.canvas");
    expect(outline.borderColor).toBe("folio.line");
    expect(outline.color).toBe("folio.ink");
    expect(outline.borderRadius).toBe("folioControl");
    expect(outline["--focus-color"]).toBe("colors.folio.focus");
    expect(outline._placeholder).toEqual({ color: "folio.faint" });
    expect(unstyled).toEqual({
      bg: "transparent",
      borderWidth: "0",
      boxShadow: "none",
    });
  });

  it("converts the default textarea outline equivalently", () => {
    const outline = system.getRecipe("textarea").variants.variant.outline;
    expect(outline.bg).toBe("folio.canvas");
    expect(outline.borderColor).toBe("folio.line");
    expect(outline.borderRadius).toBe("folioControl");
    expect(outline._placeholder).toEqual({ color: "folio.faint" });
  });

  it("applies the Folio surface to rendered inputs", () => {
    renderWithProviders(<Input placeholder="Search" />);
    const styles = emotionStylesFor(screen.getByPlaceholderText("Search"));
    expect(styles).toContain("var(--chakra-colors-folio-canvas)");
    expect(styles).toContain("var(--chakra-colors-folio-line)");
  });

  it("applies the Folio surface to rendered textareas", () => {
    renderWithProviders(<Textarea placeholder="Notes" />);
    const styles = emotionStylesFor(screen.getByPlaceholderText("Notes"));
    expect(styles).toContain("var(--chakra-colors-folio-canvas)");
    expect(styles).toContain("var(--chakra-colors-folio-ink)");
  });

  it("styles native select fields with the same Folio surface", () => {
    const field =
      system.getSlotRecipe("nativeSelect").variants.variant.outline.field;
    expect(field.bg).toBe("folio.canvas");
    expect(field.borderColor).toBe("folio.line");
    expect(field.borderRadius).toBe("folioControl");
    expect(field.focusRingColor).toBe("folio.focus");
    expect(field["& > option, & > optgroup"]).toEqual({
      bg: "folio.paper",
      color: "folio.ink",
    });
  });
});

describe("Folio checkbox and switch foundations", () => {
  it("uses Folio control surfaces with an accent checked state and explicit on-fill ink", () => {
    const solid = system.getRecipe("checkmark").variants.variant.solid;
    expect(solid.bg).toBe("folio.paper");
    expect(solid.borderColor).toBe("folio.line");
    expect(solid.focusRingColor).toBe("folio.focus");
    const checked =
      solid["&:is([data-state=checked], [data-state=indeterminate])"];
    expect(checked).toEqual({
      bg: "folio.accent",
      color: "folio.accentInk",
      borderColor: "folio.accent",
    });
  });

  it("keeps the switch dimensions while using Folio control surfaces", () => {
    const recipe = system.getSlotRecipe("switch");
    const solid = recipe.variants.variant.solid;

    expect(solid.control.bg).toBe("folio.paperAlt");
    expect(solid.control.focusRingColor).toBe("folio.focus");
    expect(solid.control._checked).toEqual({ bg: "folio.accent" });
    expect(solid.thumb._checked).toEqual({ bg: "folio.accentInk" });
    expect(recipe.variants.size.md.root).toHaveProperty("--switch-width");
    expect(recipe.variants.size.md.root).toHaveProperty("--switch-height");
  });
});

describe("Folio progress foundation", () => {
  it("exposes a folio variant with explicit range, track, and label colors", () => {
    const folio = system.getSlotRecipe("progress").variants.variant.folio;
    expect(folio.track).toEqual({ bgColor: "folio.paperAlt" });
    expect(folio.range).toEqual({ bgColor: "folio.accent" });
    expect(folio.label).toEqual({ color: "folio.muted" });
  });

  it("keeps the striped and animated variants orthogonal", () => {
    const progress = system.getSlotRecipe("progress").variants;
    expect(progress.striped).toBeTruthy();
    expect(progress.animated).toBeTruthy();
  });

  it.each([
    ["folioSuccess", "folio.success"],
    ["folioDanger", "folio.danger"],
    ["folioWarning", "folio.warning"],
    ["folioInfo", "folio.info"],
  ])("exposes a %s progress variant", (variant, range) => {
    const progress = system.getSlotRecipe("progress").variants.variant[variant];
    expect(progress.range).toEqual({ bgColor: range });
    expect(progress.track).toEqual({ bgColor: "folio.paperAlt" });
  });

  it("stops progress animations under reduced motion", () => {
    const reduced =
      system.getGlobalCss()["@layer base"][
        "@media (prefers-reduced-motion: reduce)"
      ];
    expect(reduced["&.chakra-progress__range"]).toEqual({
      animation: "none !important",
    });
  });
});

describe("Folio overlay foundations", () => {
  it("styles the popover recipe with Folio surfaces and keeps the 300px body cap", () => {
    const popover = system.getSlotRecipe("popover").base;
    expect(popover.content.borderColor).toBe("folio.line");
    expect(popover.content.borderRadius).toBe("folioPanel");
    expect(popover.content.color).toBe("folio.ink");
    expect(popover.content.boxShadow).toBe("overlay");
    expect(popover.body.maxH).toBe("300px");
    expect(popover.body.overflowY).toBe("auto");
  });

  it("styles status alerts with Folio soft surfaces and status indicators", () => {
    const alert = system.getSlotRecipe("alert").variants.status;
    expect(alert.info.root).toMatchObject({
      bg: "folio.infoSoft",
      color: "folio.ink",
    });
    expect(alert.success.root).toMatchObject({
      bg: "folio.successSoft",
      color: "folio.ink",
    });
    expect(alert.warning.root).toMatchObject({
      bg: "folio.warningSoft",
      color: "folio.ink",
    });
    expect(alert.error.root).toMatchObject({
      bg: "folio.dangerSoft",
      color: "folio.ink",
    });
    expect(alert.error.indicator).toEqual({ color: "folio.danger" });
  });

  it("styles the tooltip recipe with paper, line, control radius, and overlay shadow", () => {
    const tooltip = system.getSlotRecipe("tooltip").base;
    expect(tooltip.content["--tooltip-bg"]).toBe("colors.folio.paper");
    expect(tooltip.content.color).toBe("folio.ink");
    expect(tooltip.content.borderColor).toBe("folio.line");
    expect(tooltip.content.borderRadius).toBe("folioControl");
    expect(tooltip.content.boxShadow).toBe("overlay");
  });

  it("styles shared dialog, tab, and table classes with Folio roles", () => {
    const globalCss = JSON.stringify(system.getGlobalCss());

    expect(globalCss).toContain(".modal-style");
    expect(globalCss).toContain("--chakra-colors-folio-paper");
    expect(globalCss).toContain("--chakra-radii-folio-overlay");
    expect(globalCss).toContain(".tab-style");
    expect(globalCss).toContain("--chakra-colors-folio-hover");
  });

  it("keeps three distinct tab states with a non-colour selected cue", () => {
    const base = system.getGlobalCss()["@layer base"];
    const modes = (suffix) => {
      const rule = base[`&.tab-style${suffix}`];
      expect(rule).toBeTruthy();
      return [":root &, .light &", ".dark &, .dark .chakra-theme:not(.light) &"].map(
        (mode) => rule[mode],
      );
    };

    // Hover must stay scoped: :not([aria-selected='true']) is what keeps a
    // hovered selected tab on its canvas surface, and no other hover rule may
    // bypass that scope (the regression this PR fixes).
    const hoverKeys = Object.keys(base).filter(
      (k) => k.includes("tab-style") && k.includes(":hover"),
    );
    expect(hoverKeys).toEqual([
      "&.tab-style:not([aria-selected='true']):hover",
    ]);

    for (const mode of modes("")) {
      expect(mode.backgroundColor).toBe(
        "var(--chakra-colors-transparent) !important",
      );
      expect(mode.fontWeight).toBe("400 !important");
    }
    for (const mode of modes("[aria-selected='false']")) {
      expect(mode.backgroundColor).toBe(
        "var(--chakra-colors-transparent) !important",
      );
      expect(mode.color).toBe("var(--chakra-colors-folio-muted) !important");
    }
    for (const mode of modes(":not([aria-selected='true']):hover")) {
      expect(mode.backgroundColor).toBe(
        "var(--chakra-colors-folio-hover) !important",
      );
      expect(mode.color).toBe("var(--chakra-colors-folio-ink) !important");
    }
    for (const mode of modes("[aria-selected='true']")) {
      expect(mode.backgroundColor).toBe(
        "var(--chakra-colors-folio-canvas) !important",
      );
      expect(mode.color).toBe("var(--chakra-colors-folio-accent) !important");
      // The weight bump only signals if idle tabs keep the regular weight.
      expect(mode.fontWeight).toBe("600 !important");
    }
  });

  it("keeps tabular numerals and Folio header colors on tables", () => {
    const table = system.getSlotRecipe("table").base;
    expect(table.cell.fontVariantNumeric).toBe("tabular-nums");
    expect(table.columnHeader.color).toBe("folio.muted");
    expect(table.columnHeader.borderBottomColor).toBe("folio.line");
    expect(table.columnHeader.fontSize).toBe("12px");
    expect(table.columnHeader.lineHeight).toBe("16px");
  });
});

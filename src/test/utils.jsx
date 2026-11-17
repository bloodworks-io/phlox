import { render } from "@testing-library/react";
import { Provider } from "@/components/ui/provider";

export function renderWithProviders(ui, options) {
  return render(ui, { wrapper: Provider, ...options });
}

// Collect the emotion CSS rules that apply to an element through its
// generated css-* classes. Chakra v3 recipes resolve semantic tokens to
// CSS variables, so assertions can stay value-based (for example
// "var(--chakra-colors-folio-accent)") instead of snapshot-based.
export function emotionStylesFor(element) {
  const classes = Array.from(element.classList).filter((c) =>
    c.startsWith("css-"),
  );
  const chunks = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (classes.some((c) => rule.cssText.includes(`.${c}`))) {
          chunks.push(rule.cssText);
        }
      }
    } catch {
      // Cross-origin or unsupported sheets are skipped.
    }
  }
  return chunks.join("\n");
}

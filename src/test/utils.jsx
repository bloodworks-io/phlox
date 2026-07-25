import { render } from "@testing-library/react";
import { Provider } from "@/components/ui/provider";

export function renderWithProviders(ui, options) {
    return render(ui, { wrapper: Provider, ...options });
}

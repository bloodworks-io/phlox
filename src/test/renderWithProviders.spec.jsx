import { describe, it, expect } from "vitest";
import { Text } from "@chakra-ui/react";
import { renderWithProviders } from "./utils";

describe("renderWithProviders", () => {
    it("renders Chakra children", () => {
        const { getByText } = renderWithProviders(<Text>hello phlox</Text>);
        expect(getByText("hello phlox")).toBeInTheDocument();
    });
});

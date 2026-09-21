import { describe, it, expect, afterEach } from "vitest";
import { fireEvent, cleanup } from "@testing-library/react";
import FloatingPanel from "./FloatingPanel";
import { renderWithProviders } from "../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
afterEach(cleanup);

function Harness({ isOpen, triggerId = "fab-test", position = "left-of-fab" }) {
    return (
        <>
            <div className="floating-action-menu">
                <button id="fab-test" />
            </div>
            <FloatingPanel
                isOpen={isOpen}
                triggerId={triggerId}
                position={position}
            >
                <div>panel body</div>
            </FloatingPanel>
        </>
    );
}

// jsdom rects are all zeros, so the panel rect needs no stub — only the
// trigger's. Center = top + height / 2. The panel must be rendered (closed)
// before stubbing; opening it re-runs the measurement layout effect.
function stubTriggerRect(top, height, left = 0, width = 0) {
    document.getElementById("fab-test").getBoundingClientRect = () => ({
        top,
        height,
        left,
        width,
    });
}

// asChild merges the isthmus Box styles onto the svg — it is the arrow node.
// Style props compile to emotion classes, so visibility is computed style;
// top/left are written imperatively and read as inline style.
const arrow = () => document.querySelector("svg");
const arrowVisibility = () => getComputedStyle(arrow()).visibility;
const panelBody = () => document.querySelector(".floating-panel");

// Render closed, stub the trigger, then flip open — the doc→letter mount
// race: measurement must land with the open, pre-paint.
function openPanel(props = {}) {
    const utils = renderWithProviders(<Harness isOpen={false} {...props} />);
    stubTriggerRect(100, 50);
    utils.rerender(<Harness isOpen={true} {...props} />);
    return utils;
}

describe("FloatingPanel isthmus positioning", () => {
    it("measures on the closed→open flip, not at a stale 50%", () => {
        openPanel();
        expect(arrow().style.top).toBe("125px");
        expect(arrowVisibility()).toBe("visible");
    });

    it("re-measures when entrance/close animations settle", () => {
        openPanel();
        expect(arrow().style.top).toBe("125px");

        stubTriggerRect(200, 50);
        expect(arrow().style.top).toBe("125px"); // no event yet
        fireEvent.animationEnd(panelBody());
        expect(arrow().style.top).toBe("225px");
    });

    it("re-measures on transform transitionend only", () => {
        openPanel();

        stubTriggerRect(300, 50);
        fireEvent.transitionEnd(panelBody(), { propertyName: "opacity" });
        expect(arrow().style.top).toBe("125px");
        fireEvent.transitionEnd(panelBody(), { propertyName: "transform" });
        expect(arrow().style.top).toBe("325px");
    });

    it("keeps the last position through the close fade (no 50% snap)", () => {
        const { rerender } = openPanel();
        rerender(<Harness isOpen={false} />);
        expect(arrow()).not.toBeNull();
        expect(arrow().style.top).toBe("125px");
        expect(arrowVisibility()).toBe("visible");
    });

    it("hides the isthmus until the first measurement lands", () => {
        const { rerender } = renderWithProviders(
            <Harness isOpen={false} triggerId="does-not-exist" />,
        );
        rerender(<Harness isOpen={true} triggerId="does-not-exist" />);
        expect(arrow()).not.toBeNull();
        expect(arrowVisibility()).toBe("hidden");
    });

    it("re-measures on window resize", () => {
        openPanel();
        stubTriggerRect(400, 50);
        fireEvent.resize(window);
        expect(arrow().style.top).toBe("425px");
    });

    it("positions bottom variants on the left axis and clears the top axis", () => {
        const { rerender } = renderWithProviders(
            <Harness isOpen={false} position="bottom-center" />,
        );
        stubTriggerRect(0, 0, 150, 50);
        rerender(<Harness isOpen={true} position="bottom-center" />);
        expect(arrow().style.left).toBe("175px");
        expect(arrow().style.top).toBe("");
    });
});

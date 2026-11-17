import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    screen,
    cleanup,
    fireEvent,
    waitFor,
} from "@testing-library/react";
import ChatPanel from "./ChatPanel";
import ChatInput from "./ChatInput";
import { system } from "../../../theme";
import { emotionStylesFor, renderWithProviders } from "../../../test/utils";

// Vitest runs without globals — register cleanup or renders leak.
const { fetchUserSettings } = vi.hoisted(() => ({
    fetchUserSettings: vi.fn(),
}));

vi.mock("../../../utils/api/settingsApi", () => ({
    settingsApi: { fetchUserSettings },
}));

const ORIGINAL_MATCH_MEDIA = window.matchMedia.bind(window);

afterEach(() => {
    cleanup();
    window.matchMedia = ORIGINAL_MATCH_MEDIA;
    delete HTMLElement.prototype.scrollIntoView;
    vi.clearAllMocks();
});

function stubReducedMotion(matches) {
    window.matchMedia = (query) => ({
        ...ORIGINAL_MATCH_MEDIA(query),
        matches:
            query === "(prefers-reduced-motion: reduce)" ? matches : false,
    });
}

const USER_SETTINGS = {
    quick_chat_1_title: "Summarise labs",
    quick_chat_1_prompt: "Summarise the latest labs.",
    quick_chat_2_title: "Draft a plan",
    quick_chat_2_prompt: "Draft a management plan.",
};

const CONVERSATION = [
    { role: "user", content: "What does the HbA1c trend show?" },
    { role: "assistant", content: "It has fallen from 78 to 54 mmol/mol." },
];

function renderChatPanel(props = {}) {
    return renderWithProviders(
        <ChatPanel
            dimensions={{ width: 400, height: 600 }}
            resizerRef={React.createRef()}
            handleMouseDown={vi.fn()}
            chatLoading={false}
            messages={CONVERSATION}
            setMessages={vi.fn()}
            userInput=""
            setUserInput={vi.fn()}
            handleChat={vi.fn()}
            showSuggestions={false}
            setShowSuggestions={vi.fn()}
            {...props}
        />,
    );
}

beforeEach(() => {
    fetchUserSettings.mockResolvedValue(USER_SETTINGS);
    HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("ChatPanel Folio shell", () => {
    it("keeps the panel geometry and the resize handle wired", () => {
        const handleMouseDown = vi.fn();
        const { container } = renderChatPanel({ handleMouseDown });
        const root = Array.from(container.querySelectorAll("div")).find((el) =>
            emotionStylesFor(el).includes("width: 400px"),
        );
        const styles = emotionStylesFor(root);
        // The chat panel docks 24px below its anchor bar.
        expect(styles).toContain("height: 576px");

        const resizer = Array.from(container.querySelectorAll("div")).find(
            (el) => emotionStylesFor(el).includes("nwse-resize"),
        );
        expect(resizer).toBeTruthy();
        fireEvent.mouseDown(resizer);
        expect(handleMouseDown).toHaveBeenCalledTimes(1);
    });

    it("sets the header on paper with a hairline and accent icon cluster", () => {
        renderChatPanel();
        const header = document.querySelector(".panel-header");
        const headerStyles = emotionStylesFor(header);
        expect(headerStyles).toContain("var(--chakra-colors-folio-paper)");
        expect(headerStyles).toContain("var(--chakra-colors-folio-ink)");
        expect(headerStyles).toContain("var(--chakra-colors-folio-line)");
        expect(emotionStylesFor(header.firstElementChild)).toContain(
            "var(--chakra-colors-folio-accent)",
        );
        const title = screen.getByText("Chat with Phlox");
        expect(title).toBeInTheDocument();
        // The title carries no ink of its own — it inherits the cluster accent.
        expect(emotionStylesFor(title)).not.toContain(
            "var(--chakra-colors-folio-ink)",
        );
    });

    it("reads messages on the canvas body and composes on paper", () => {
        const { container } = renderChatPanel();
        const bodies = container.querySelectorAll(".attached-panel-body");
        expect(bodies).toHaveLength(2);
        const scrollBody = container.querySelector(".sidebar-scroll-overlay");
        const scrollStyles = emotionStylesFor(scrollBody);
        expect(scrollStyles).toContain("var(--chakra-colors-folio-canvas)");
        expect(scrollStyles).toContain("var(--chakra-colors-folio-ink)");

        const composer = bodies[1];
        const composerStyles = emotionStylesFor(composer);
        expect(composerStyles).toContain("var(--chakra-colors-folio-paper)");
        expect(composerStyles).toContain("var(--chakra-colors-folio-line)");

        const disclaimer = screen.getByText(
            "Phlox may make mistakes. Always verify critical information.",
        );
        expect(emotionStylesFor(disclaimer)).toContain(
            "var(--chakra-colors-folio-faint)",
        );
    });

    it("hides the composer suggestions while settings are in flight", () => {
        fetchUserSettings.mockReturnValue(new Promise(() => {}));
        renderChatPanel({
            messages: [],
            showSuggestions: true,
        });
        expect(document.querySelector(".chat-suggestions")).toBeNull();
        expect(document.querySelector(".quick-chat-buttons-collapsed")).toBeNull();
    });
});

describe("ChatMessages Folio hierarchy", () => {
    it("aligns user bubbles right on the accent-soft fill", () => {
        const { container } = renderChatPanel();
        const userBox = container.querySelector(".message-box.user");
        expect(userBox).toBeTruthy();
        const row = userBox.parentElement;
        expect(emotionStylesFor(row)).toContain("justify-content: flex-end");
        expect(emotionStylesFor(userBox)).toContain("max-width: 85%");
        // The bubble fill itself is the Folio accent-soft role.
        const bubble =
            system.getGlobalCss()["@layer base"]["&.message-box.user"][
                ":root &, .light &"
            ];
        expect(bubble.backgroundColor).toBe(
            "var(--chakra-colors-folio-accent-soft) !important",
        );
        expect(bubble.color).toBe("var(--chakra-colors-folio-ink) !important");
    });

    it("reads assistant replies left on a transparent, borderless block", () => {
        const { container } = renderChatPanel();
        const assistantBox = container.querySelector(".message-box.assistant");
        expect(assistantBox).toBeTruthy();
        const row = assistantBox.parentElement;
        expect(emotionStylesFor(row)).toContain("justify-content: flex-start");

        const boxStyles = emotionStylesFor(assistantBox);
        expect(boxStyles).toContain("max-width: 92%");
        expect(boxStyles).toContain(
            "background: var(--chakra-colors-transparent)",
        );
        expect(boxStyles).toContain("box-shadow: none");
        expect(boxStyles).toContain("border-width: 0px");

        const block =
            system.getGlobalCss()["@layer base"]["&.message-box.assistant"][
                ":root &, .light &"
            ];
        expect(block.backgroundColor).toBe(
            "var(--chakra-colors-transparent) !important",
        );
        expect(block.color).toBe("var(--chakra-colors-folio-muted) !important");
        expect(block.boxShadow).toBe("none !important");
    });

    it("crowns assistant replies with the muted Phlox masthead", () => {
        renderChatPanel();
        const masthead = screen.getByText("Phlox Assistant");
        const mastheadStyles = emotionStylesFor(masthead);
        expect(mastheadStyles).toContain("var(--chakra-colors-folio-muted)");
        expect(mastheadStyles).toContain(
            "font-weight: var(--chakra-font-weights-semibold)",
        );
        expect(screen.getByAltText("Phlox Assistant")).toHaveAttribute(
            "src",
            "/logo.webp",
        );
    });

    it("swaps a pending reply for the accent spinner", () => {
        const { container } = renderChatPanel({
            messages: [{ role: "assistant", content: "", loading: true }],
        });
        const spinner = container.querySelector(".chakra-spinner");
        expect(spinner).toBeTruthy();
        expect(emotionStylesFor(spinner)).toContain(
            "var(--chakra-colors-folio-accent)",
        );
        expect(
            container.querySelector(".message-box.assistant"),
        ).toBeTruthy();
    });
});

describe("Chat Folio suggestion chips", () => {
    it("offers quick prompts on the empty canvas and sends them", async () => {
        const handleChat = vi.fn();
        const setUserInput = vi.fn();
        const setShowSuggestions = vi.fn();
        renderChatPanel({
            messages: [],
            showSuggestions: true,
            handleChat,
            setUserInput,
            setShowSuggestions,
        });

        const chip = await screen.findByRole("button", {
            name: /summarise labs/i,
        });
        expect(chip.className).toContain("chat-suggestions");
        fireEvent.click(chip);

        expect(handleChat).toHaveBeenCalledWith(
            "Summarise the latest labs.",
            [],
            undefined,
            undefined,
            undefined,
        );
        expect(setUserInput).toHaveBeenCalledWith("");
        expect(setShowSuggestions).toHaveBeenCalledWith(false);
    });

    it("collapses quick chats into outline chips under the transcript", async () => {
        const handleChat = vi.fn();
        renderChatPanel({ handleChat });

        const chip = await screen.findByRole("button", {
            name: /draft a plan/i,
        });
        expect(chip.className).toContain("quick-chat-buttons-collapsed");
        expect(document.querySelector(".chat-suggestions")).toBeNull();

        fireEvent.click(chip);
        expect(handleChat).toHaveBeenCalledWith(
            "Draft a management plan.",
            CONVERSATION,
            undefined,
            undefined,
            undefined,
        );
    });

    it("maps the chip surfaces to quiet Folio outline roles", () => {
        const base = system.getGlobalCss()["@layer base"];
        for (const selector of [
            "&.chat-suggestions",
            "&.quick-chat-buttons-collapsed",
        ]) {
            const chip = base[selector][":root &, .light &"];
            expect(chip.backgroundColor).toContain(
                "var(--chakra-colors-folio-paper-alt)",
            );
            expect(chip.borderColor).toContain(
                "var(--chakra-colors-folio-line)",
            );
            expect(chip.color).toContain("var(--chakra-colors-folio-muted)");
            const hover =
                chip["@media (hover: hover)"][
                    "&:is(:hover, [data-hover]):not(:disabled, [data-disabled])"
                ];
            expect(hover.backgroundColor).toContain(
                "var(--chakra-colors-folio-hover)",
            );
            expect(hover.color).toContain("var(--chakra-colors-folio-ink)");
        }
    });
});

describe("ChatInput composer", () => {
    function InputHarness({ onSend, chatLoading = false }) {
        const [value, setValue] = useState("");
        return (
            <ChatInput
                userInput={value}
                setUserInput={setValue}
                handleSendMessage={onSend}
                chatLoading={chatLoading}
            />
        );
    }

    it("sends on Enter but not on Shift+Enter", () => {
        const onSend = vi.fn();
        renderWithProviders(<InputHarness onSend={onSend} />);
        const textarea = screen.getByPlaceholderText("Message Phlox...");

        fireEvent.change(textarea, { target: { value: "line one" } });
        fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
        expect(onSend).not.toHaveBeenCalled();

        fireEvent.change(textarea, { target: { value: "line one\nline two" } });
        fireEvent.keyDown(textarea, { key: "Enter" });
        expect(onSend).toHaveBeenCalledTimes(1);
        expect(onSend).toHaveBeenCalledWith("line one\nline two");
    });

    it("keeps the send action gated without text", () => {
        const onSend = vi.fn();
        renderWithProviders(<InputHarness onSend={onSend} />);
        expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();

        fireEvent.change(screen.getByPlaceholderText("Message Phlox..."), {
            target: { value: "  " },
        });
        fireEvent.keyDown(screen.getByPlaceholderText("Message Phlox..."), {
            key: "Enter",
        });
        expect(onSend).not.toHaveBeenCalled();
    });

    it("rides the accent pill once a message can be sent", () => {
        renderWithProviders(<InputHarness onSend={vi.fn()} />);
        const send = screen.getByRole("button", { name: "Send message" });
        expect(emotionStylesFor(send)).toContain(
            "var(--chakra-colors-folio-paper)",
        );

        fireEvent.change(screen.getByPlaceholderText("Message Phlox..."), {
            target: { value: "hello" },
        });
        const readyStyles = emotionStylesFor(send);
        expect(readyStyles).toContain("var(--chakra-colors-folio-accent)");
        expect(readyStyles).toContain("var(--chakra-colors-folio-accent-ink)");
    });

    it("locks the composer while the assistant is answering", () => {
        const onSend = vi.fn();
        renderWithProviders(<InputHarness onSend={onSend} chatLoading={true} />);
        const textarea = screen.getByPlaceholderText("Message Phlox...");
        const send = screen.getByRole("button", { name: "Send message" });
        expect(textarea).toBeDisabled();
        expect(send).toBeDisabled();
        expect(send.hasAttribute("data-loading")).toBe(true);

        fireEvent.keyDown(textarea, { key: "Enter" });
        expect(onSend).not.toHaveBeenCalled();
    });

    it("bounds the autosizing textarea between one and three lines", () => {
        renderWithProviders(<InputHarness onSend={vi.fn()} />);
        const textarea = screen.getByPlaceholderText("Message Phlox...");
        const styles = emotionStylesFor(textarea);
        expect(styles).toContain("min-height: 32px");
        expect(styles).toContain("max-height: 72px");
        expect(styles).toContain("resize: none");
    });

    it("routes the composer shell through the folio paperAlt control", () => {
        renderWithProviders(<InputHarness onSend={vi.fn()} />);
        const shell = document.querySelector(".attached-chat-input");
        const shellStyles = emotionStylesFor(shell);
        expect(shellStyles).toContain("var(--chakra-colors-folio-paper-alt)");
        expect(shellStyles).toContain("var(--chakra-colors-folio-line)");
        expect(shellStyles).toContain(
            "var(--chakra-radii-folio-control)",
        );
    });
});

describe("ChatPanel auto-scroll", () => {
    it("smooth-scrolls new messages while the reader is at the bottom", () => {
        const scrollIntoView = HTMLElement.prototype.scrollIntoView;
        renderChatPanel();
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    });

    it("jumps instead of smoothing under reduced motion", () => {
        stubReducedMotion(true);
        const scrollIntoView = HTMLElement.prototype.scrollIntoView;
        renderChatPanel();
        expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto" });
    });

    it("holds the viewport still when the reader scrolled away", () => {
        const scrollIntoView = HTMLElement.prototype.scrollIntoView;
        const view = renderChatPanel();
        expect(scrollIntoView).toHaveBeenCalledTimes(1);

        const scrollBody = view.container.querySelector(
            ".sidebar-scroll-overlay",
        );
        Object.defineProperty(scrollBody, "scrollHeight", {
            value: 1000,
            configurable: true,
        });
        Object.defineProperty(scrollBody, "clientHeight", {
            value: 400,
            configurable: true,
        });
        scrollBody.scrollTop = 100; // 600px above the bottom — far.
        fireEvent.scroll(scrollBody);

        const nextMessages = [
            ...CONVERSATION,
            { role: "assistant", content: "New" },
        ];
        view.rerender(
            <ChatPanel
                dimensions={{ width: 400, height: 600 }}
                resizerRef={React.createRef()}
                handleMouseDown={vi.fn()}
                chatLoading={false}
                messages={nextMessages}
                setMessages={vi.fn()}
                userInput=""
                setUserInput={vi.fn()}
                handleChat={vi.fn()}
                showSuggestions={false}
                setShowSuggestions={vi.fn()}
            />,
        );
        expect(scrollIntoView).toHaveBeenCalledTimes(1);
    });
});

describe("ChatPanel settings fetch failure", () => {
    it("renders the transcript without quick chats when settings fail", async () => {
        fetchUserSettings.mockRejectedValue(new Error("offline"));
        renderChatPanel({ showSuggestions: true, messages: [] });
        await waitFor(() =>
            expect(fetchUserSettings).toHaveBeenCalledTimes(1),
        );
        expect(
            await screen.findByText(
                "Phlox may make mistakes. Always verify critical information.",
            ),
        ).toBeInTheDocument();
        expect(document.querySelector(".chat-suggestions")).toBeNull();
    });
});

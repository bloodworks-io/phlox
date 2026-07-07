import React from "react";
import ReactMarkdown from "react-markdown";
import { Box, Text, Link, Popover } from "@chakra-ui/react";
import remarkGfm from "remark-gfm";
import { FaTimes, FaWikipediaW, FaBookMedical, FaDatabase, FaGlobe } from "react-icons/fa";
import { expandCitationNumbers } from "@/utils/chat/messageParser";

/**
 * Remark plugin: turn ``[N]`` and grouped ``[N, M]`` tokens in text into
 * citation link nodes (``#citation-N``) consumed by the ``a`` handler below.
 * Manual mdast walk — no extra dependency on unist-util-visit.
 */
const remarkInlineCitations = () => (tree) => {
    const GROUP_RE = /\[(\d+(?:\s*[-,]\s*\d+)*)\]/g;
    const walk = (node) => {
        if (!node.children) return;
        const next = [];
        for (const child of node.children) {
            if (child.type === "text" && child.value.includes("[")) {
                let last = 0;
                let m;
                GROUP_RE.lastIndex = 0;
                let matchedAny = false;
                while ((m = GROUP_RE.exec(child.value)) !== null) {
                    matchedAny = true;
                    if (m.index > last) {
                        next.push({ type: "text", value: child.value.slice(last, m.index) });
                    }
                    // Expand ranges (1-3) and lists (1,2) into one pill per number.
                    for (const num of expandCitationNumbers(m[1])) {
                        next.push({
                            type: "link",
                            url: `#citation-${num}`,
                            children: [{ type: "text", value: String(num) }],
                        });
                    }
                    last = m.index + m[0].length;
                }
                if (matchedAny && last < child.value.length) {
                    next.push({ type: "text", value: child.value.slice(last) });
                }
                if (!matchedAny) next.push(child);
            } else {
                next.push(child);
                walk(child);
            }
        }
        node.children = next;
    };
    walk(tree);
};

const normalizeCitation = (c) => {
    if (c == null) return null;
    if (typeof c === "string") return { type: "string", label: c };
    return c;
};

const TYPE_ICONS = {
    wiki: FaWikipediaW,
    pubmed: FaBookMedical,
    literature: FaDatabase,
    other: FaGlobe,
};

const iconFor = (c) => {
    if (c?.type && TYPE_ICONS[c.type]) return TYPE_ICONS[c.type];
    const label = (c?.label || "").toLowerCase();
    if (label.includes("wikipedia") || label.includes("wiki:"))
        return FaWikipediaW;
    if (label.includes("pubmed")) return FaBookMedical;
    if (label.includes("clinical guidelines") || label.includes("according to"))
        return FaDatabase;
    return FaGlobe;
};

const pillVisual = (Icon, index, { as = "span", ...rest } = {}) => (
    <Text
        as={as}
        type={as === "button" ? "button" : undefined}
        display="inline-flex"
        alignItems="center"
        gap="3px"
        verticalAlign="middle"
        ml="2px"
        mr="2px"
        bg="surfaceMuted"
        border="1px solid"
        borderColor="accent"
        borderRadius="full"
        px="7px"
        h="22px"
        cursor="pointer"
        fontSize="11px"
        fontWeight="bold"
        lineHeight={1}
        color="primaryButton"
        _dark={{
            bg: "surfaceMuted",
            borderColor: "accent",
            color: "primaryButton",
        }}
        _hover={{
            bg: "surfaceMuted",
            _dark: { bg: "surfaceMuted" },
        }}
        {...rest}
    >
        <Icon style={{ fontSize: "11px", flexShrink: 0 }} />
        {index}
    </Text>
);

const CitationTag = ({ index, citation, displayLabel }) => {
    const c = normalizeCitation(citation);
    const url = c?.url;
    const title = c?.title || c?.source || c?.label || `Source ${index}`;
    const snippet = c?.snippet;
    const Icon = iconFor(c);
    const [open, setOpen] = React.useState(false);
    const label = displayLabel ?? index;

    if (!c) {
        return (
            <Text
                as="sup"
                ml="1px"
                color="primaryButton"
                fontSize="xs"
                fontWeight="bold"
                verticalAlign="super"
            >
                {index}
            </Text>
        );
    }

    const isInternal = url && url.startsWith("/");
    const footerLabel = isInternal
        ? "⬇ Download PDF"
        : url
          ? "Open source ↗"
          : null;

    const openUrl = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!url) return;
        if (isInternal) {
            const a = document.createElement("a");
            a.href = url;
            a.download = "";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } else {
            window.open(url, "_blank", "noopener");
        }
    };

    return (
        <Popover.Root
            open={open}
            onOpenChange={(details) => setOpen(details.open)}
            positioning={{ placement: "top" }}
            lazyRender
        >
            <Popover.Trigger asChild>
                {pillVisual(Icon, label, { as: "button" })}
            </Popover.Trigger>
            <Popover.Positioner>
                <Popover.Content
                    maxW="460px"
                    w="460px"
                    position="relative"
                >
                    <Popover.Arrow>
                        <Popover.ArrowTip />
                    </Popover.Arrow>
                    <Popover.Header
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={2}
                    >
                        <Box
                            display="flex"
                            alignItems="center"
                            gap={2}
                            minWidth="0"
                            flex="1"
                            lineHeight="1"
                        >
                            <Icon
                                style={{
                                    flexShrink: 0,
                                    display: "block",
                                    lineHeight: 1,
                                }}
                            />
                            <Text
                                as="span"
                                fontSize="sm"
                                fontWeight="600"
                                color="textPrimary"
                                lineHeight="1.2"
                                overflow="hidden"
                                textOverflow="ellipsis"
                                whiteSpace="nowrap"
                            >
                                {title}
                            </Text>
                        </Box>
                        <Box
                            as="button"
                            onClick={() => setOpen(false)}
                            background="none"
                            border="none"
                            cursor="pointer"
                            padding="2px"
                            color="textSecondary"
                            opacity={0.6}
                            _hover={{ opacity: 1 }}
                            aria-label="Close"
                            flexShrink={0}
                            display="flex"
                            alignItems="center"
                            lineHeight="1"
                        >
                            <FaTimes size={12} />
                        </Box>
                    </Popover.Header>
                    <Popover.Body>
                        {snippet ? (
                            <Text
                                fontSize="xs"
                                color="textSecondary"
                                whiteSpace="pre-wrap"
                                lineHeight={1.5}
                            >
                                {snippet}
                            </Text>
                        ) : (
                            <Text fontSize="xs" color="textSecondary">
                                No excerpt available.
                            </Text>
                        )}
                    </Popover.Body>
                    {footerLabel && (
                        <Box
                            px={3}
                            py={2}
                            borderTop="1px solid"
                            borderColor="surface"
                        >
                            <Link
                                href={url}
                                fontSize="xs"
                                color="primaryButton"
                                _hover={{ textDecoration: "underline" }}
                                onClick={openUrl}
                            >
                                {footerLabel}
                            </Link>
                        </Box>
                    )}
                </Popover.Content>
            </Popover.Positioner>
        </Popover.Root>
    );
};

/**
 * Sanitized markdown renderer that removes clickable external links.
 * Supports GFM tables, strikethrough, task lists, and autolinks.
 * Inline citation refs ``[N]`` / ``[N, M]`` render as small pill tags
 * with a hover popup (pass ``citations`` = array keyed 1..N from message.context).
 */
const MarkdownRenderer = ({ children, citations, citationRemap, ...props }) => {
    const citationsArr = Array.isArray(citations) ? citations : [];
    const remap = citationRemap instanceof Map ? citationRemap : null;

    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkInlineCitations]}
            components={{
                a: ({ href, children }) => {
                    if (href && href.startsWith("#citation-")) {
                        const n = parseInt(href.replace("#citation-", ""), 10);
                        return (
                            <CitationTag
                                index={n}
                                citation={citationsArr[n - 1]}
                                displayLabel={remap ? remap.get(n) : undefined}
                            />
                        );
                    }
                    if (href && href.startsWith("#")) {
                        return (
                            <a href={href} style={{ color: "inherit" }}>
                                {children}
                            </a>
                        );
                    }

                    let domain = "external link";
                    if (href) {
                        try {
                            const url = new URL(href);
                            domain = url.hostname;
                        } catch {
                            domain = href.split("/")[2] || href;
                        }
                    }

                    return (
                        <Text as="span" color="overlay0" fontSize="xs">
                            {" "}
                            [{children} ({domain})]{" "}
                        </Text>
                    );
                },
                table: ({ children }) => (
                    <Box overflowX="auto" my={2}>
                        <Box
                            width="100%"
                            fontSize="sm"
                            borderWidth="1px"
                            borderCollapse="collapse"
                            asChild
                        ><table>
                                {children}
                            </table></Box>
                    </Box>
                ),
                thead: ({ children }) => (
                    <Box bg="surfaceInset" _dark={{ bg: "surface1" }} asChild><thead>
                            {children}
                        </thead></Box>
                ),
                th: ({ children }) => (
                    <Box
                        px={2}
                        py={1}
                        textAlign="left"
                        fontWeight="semibold"
                        borderWidth="1px"
                        asChild
                    ><th>
                            {children}
                        </th></Box>
                ),
                td: ({ children }) => (
                    <Box px={2} py={1} borderWidth="1px" asChild><td>
                            {children}
                        </td></Box>
                ),
            }}
            {...props}
        >
            {children}
        </ReactMarkdown>
    );
};

export default MarkdownRenderer;

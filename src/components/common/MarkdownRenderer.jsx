import React from "react";
import ReactMarkdown from "react-markdown";
import { Box, Text } from "@chakra-ui/react";
import remarkGfm from "remark-gfm";

/**
 * Sanitized markdown renderer that removes clickable external links.
 * Supports GFM tables, strikethrough, task lists, and autolinks.
 */
const MarkdownRenderer = ({ children, ...props }) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                // Sanitize anchor tags to remove external links
                a: ({ href, children }) => {
                    // Only allow internal anchor links (#)
                    if (href && href.startsWith("#")) {
                        return (
                            <a href={href} style={{ color: "inherit" }}>
                                {children}
                            </a>
                        );
                    }

                    // Render external links as plain text with domain shown
                    // This prevents clickable links that could exfiltrate data
                    let domain = "external link";
                    if (href) {
                        try {
                            const url = new URL(href);
                            domain = url.hostname;
                        } catch {
                            // Invalid URL, just show as-is
                            domain = href.split("/")[2] || href;
                        }
                    }

                    return (
                        <Text as="span" color="gray.500" fontSize="xs">
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
                    <Box bg="gray.50" _dark={{ bg: "gray.700" }} asChild><thead>
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

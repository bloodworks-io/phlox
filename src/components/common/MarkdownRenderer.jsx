import React from "react";
import ReactMarkdown from "react-markdown";
import { Text } from "@chakra-ui/react";

/**
 * Sanitized markdown renderer that removes clickable external links.
 */
const MarkdownRenderer = ({ children, ...props }) => {
  return (
    <ReactMarkdown
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
      }}
      {...props}
    >
      {children}
    </ReactMarkdown>
  );
};

export default MarkdownRenderer;

import React, { useState } from "react";
import { Box, Text, VStack, HStack, Link } from "@chakra-ui/react";
import { FaChevronRight, FaChevronDown } from "react-icons/fa";
import {
    FaWikipediaW,
    FaBookMedical,
    FaHistory,
    FaDatabase,
    FaGlobe,
} from "react-icons/fa";

const TYPE_ICONS = {
    wiki: FaWikipediaW,
    pubmed: FaBookMedical,
    literature: FaDatabase,
    other: FaGlobe,
};

const iconFor = (c) => {
    if (c.type && TYPE_ICONS[c.type]) return TYPE_ICONS[c.type];
    const label = (c.label || "").toLowerCase();
    if (label.includes("wikipedia") || label.includes("wiki:"))
        return FaWikipediaW;
    if (label.includes("pubmed")) return FaBookMedical;
    if (
        label.includes("previous encounter") ||
        label.includes("encounter from")
    )
        return FaHistory;
    if (label.includes("clinical guidelines") || label.includes("according to"))
        return FaDatabase;
    return FaGlobe;
};

const normalize = (c) => {
    if (typeof c === "string") return { type: "string", label: c };
    return c;
};

// Collapsible Sources footer.
export const CitationList = ({ citations, citedOriginals, inline = false }) => {
    const [open, setOpen] = useState(false);

    if (!citations || citations.length === 0) return null;

    // Build [{c, num}] — num is the contiguous display number.
    const entries =
        citedOriginals && citedOriginals.length > 0
            ? citedOriginals
                  .map((orig, i) => ({
                      c: normalize(citations[orig - 1]),
                      num: i + 1,
                      key: orig,
                  }))
                  .filter((e) => e.c)
            : citations.map((c, i) => ({
                  c: normalize(c),
                  num: i + 1,
                  key: i + 1,
              }));

    if (entries.length === 0) return null;
    const Chevron = open ? FaChevronDown : FaChevronRight;

    return (
        <Box
            mt={inline ? 2 : 4}
            pt={inline ? 2 : 3}
            borderTop="1px solid"
            borderColor="gray.200"
            _dark={{ borderColor: "gray.700" }}
        >
            <HStack
                gap={1}
                cursor="pointer"
                userSelect="none"
                onClick={() => setOpen((v) => !v)}
                _hover={{ opacity: 0.8 }}
            >
                <Chevron style={{ fontSize: "0.6em" }} />
                <Text
                    fontSize="xs"
                    fontWeight="medium"
                    color="gray.500"
                    _dark={{ color: "gray.400" }}
                >
                    Sources ({entries.length})
                </Text>
            </HStack>

            {open && (
                <VStack align="stretch" gap={1} mt={2}>
                    {entries.map(({ c, num, key }) => {
                        const Icon = iconFor(c);
                        const isString = c.type === "string";
                        const title = isString
                            ? c.label
                            : c.title || c.source || "Source";
                        const isDownload = !!c.url && c.url.startsWith("/");
                        return (
                            <HStack key={key} gap={2} align="start">
                                <Text
                                    as="span"
                                    fontSize="xs"
                                    fontWeight="bold"
                                    color="blue.500"
                                    minW="18px"
                                >
                                    {num}.
                                </Text>
                                <Icon color="blue.500" mt="1px" />
                                {isString || !c.url ? (
                                    <Text
                                        fontSize="xs"
                                        color="gray.600"
                                        _dark={{ color: "gray.400" }}
                                        lineClamp={1}
                                    >
                                        {title}
                                    </Text>
                                ) : (
                                    <Link
                                        href={c.url}
                                        isExternal={!isDownload}
                                        fontSize="xs"
                                        color="blue.600"
                                        _dark={{ color: "blue.300" }}
                                        _hover={{ textDecoration: "underline" }}
                                        lineClamp={1}
                                    >
                                        {isDownload ? `⬇ ${title}` : title}
                                    </Link>
                                )}
                            </HStack>
                        );
                    })}
                </VStack>
            )}
        </Box>
    );
};

export default CitationList;

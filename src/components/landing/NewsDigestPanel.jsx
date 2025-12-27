import React from "react";
import {
    Box,
    Flex,
    Text,
    HStack,
    VStack,
    Grid,
    Link,
    IconButton,
    useColorMode,
} from "@chakra-ui/react";
import { RepeatIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { FaNewspaper } from "react-icons/fa";

const NewsDigestPanel = ({ rssDigests, isRefreshing, refreshRssDigests }) => {
    const { colorMode } = useColorMode();

    const colors = {
        light: {
            background: "#e6e9ef",
            textPrimary: "#4c4f69",
            textSecondary: "#6c6f85",
            surface: "#ccd0da",
            hoverBackground: "#acb0be",
        },
        dark: {
            background: "#1e2030",
            textPrimary: "#cad3f5",
            textSecondary: "#a5adcb",
            surface: "#363a4f",
            hoverBackground: "#494d64",
        },
    };

    const currentColors = colors[colorMode];

    return (
        <Box className="panels-bg" p="5" borderRadius="sm" shadow="sm">
            <Flex justify="space-between" align="center" mb="4">
                <HStack spacing={3}>
                    <FaNewspaper size="1.2em" />
                    <Text as="h3">News Digest</Text>
                </HStack>
                <IconButton
                    icon={<RepeatIcon />}
                    onClick={refreshRssDigests}
                    isLoading={isRefreshing}
                    aria-label="Refresh digest"
                    size="sm"
                    className="settings-button"
                    borderRadius="sm"
                />
            </Flex>

            <Box
                className="floating-main custom-scrollbar"
                borderRadius="sm"
                p="4"
                minH="200px"
                maxH="400px"
                overflowY="auto"
            >
                {rssDigests?.combined_digest ? (
                    <VStack align="stretch" spacing={4}>
                        <Text fontSize="sm" lineHeight="tall">
                            {rssDigests.combined_digest}
                        </Text>
                        {rssDigests.articles?.length > 0 && (
                            <Box>
                                <Text fontWeight="bold" mb={2}>
                                    Source Articles:
                                </Text>
                                <Grid
                                    templateColumns="repeat(auto-fill, minmax(300px, 1fr))"
                                    gap={3}
                                >
                                    {rssDigests.articles.map(
                                        (article, index) => (
                                            <Box
                                                key={index}
                                                p={3}
                                                borderWidth="1px"
                                                borderRadius="sm"
                                                _hover={{
                                                    bg: currentColors.hoverBackground,
                                                }}
                                            >
                                                <Link
                                                    href={article.link}
                                                    isExternal
                                                    color="blue.500"
                                                >
                                                    {article.title}{" "}
                                                    <ExternalLinkIcon mx="2px" />
                                                </Link>
                                                <Text
                                                    fontSize="sm"
                                                    color={
                                                        currentColors.textSecondary
                                                    }
                                                    mt={1}
                                                >
                                                    {article.feed_title}
                                                </Text>
                                            </Box>
                                        ),
                                    )}
                                </Grid>
                            </Box>
                        )}
                    </VStack>
                ) : (
                    <Text color={currentColors.textSecondary}>
                        No digests available
                    </Text>
                )}
            </Box>
        </Box>
    );
};
export default NewsDigestPanel;

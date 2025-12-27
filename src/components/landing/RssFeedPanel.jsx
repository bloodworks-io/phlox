// Component for managing and displaying RSS feed subscriptions.
import React from "react";
import {
    Box,
    Flex,
    Text,
    VStack,
    HStack,
    Input,
    IconButton,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon, RepeatIcon } from "@chakra-ui/icons";
import { FaRss } from "react-icons/fa";

const RssFeedPanel = ({
    feeds,
    newFeedUrl,
    setNewFeedUrl,
    addFeed,
    removeFeed,
    refreshAllFeeds,
    refreshSingleFeed,
    isRefreshing,
}) => {
    return (
        <Box className="panels-bg" p="5" borderRadius="sm" shadow="sm">
            <Flex justify="space-between" align="center" mb="4">
                <HStack spacing={3}>
                    <FaRss size="1.2em" />
                    <Text as="h3">RSS Feeds</Text>
                </HStack>
                <IconButton
                    icon={<RepeatIcon />}
                    onClick={refreshAllFeeds}
                    isLoading={isRefreshing}
                    aria-label="Refresh feeds"
                    size="sm"
                    className="settings-button"
                    borderRadius="sm"
                />
            </Flex>

            <VStack spacing={4}>
                <HStack w="full">
                    <Input
                        placeholder="RSS feed URL"
                        value={newFeedUrl}
                        onChange={(e) => setNewFeedUrl(e.target.value)}
                        className="input-style"
                    />
                    <IconButton
                        icon={<AddIcon />}
                        onClick={addFeed}
                        size="sm"
                        className="green-button"
                        borderRadius="sm"
                        aria-label="Add feed"
                    />
                </HStack>

                <Box
                    w="full"
                    maxH="300px"
                    overflowY="auto"
                    className="summary-panels"
                    borderRadius="md"
                >
                    <VStack align="stretch" spacing={2} p={2}>
                        {feeds.map((feed) => (
                            <HStack
                                key={feed.id}
                                p={3}
                                borderWidth="1px"
                                borderRadius="sm"
                                justify="space-between"
                                className="landing-items"
                                maxH="40px"
                            >
                                <Text isTruncated>
                                    {feed.title || feed.url}
                                </Text>
                                <HStack spacing={1}>
                                    <IconButton
                                        icon={<RepeatIcon />}
                                        onClick={() =>
                                            refreshSingleFeed(feed.id)
                                        }
                                        size="sm"
                                        variant="ghost"
                                        aria-label="Refresh feed"
                                    />
                                    <IconButton
                                        icon={<DeleteIcon />}
                                        onClick={() => removeFeed(feed.id)}
                                        size="sm"
                                        variant="ghost"
                                        colorScheme="red"
                                        aria-label="Remove feed"
                                    />
                                </HStack>
                            </HStack>
                        ))}
                    </VStack>
                </Box>
            </VStack>
        </Box>
    );
};

export default RssFeedPanel;

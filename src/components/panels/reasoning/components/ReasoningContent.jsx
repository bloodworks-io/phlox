import React from "react";
import { Text, Tabs, TabList, TabPanels, TabPanel, Tab, VStack } from "@chakra-ui/react";
import { ReasoningItem } from "./ReasoningItem";
import { CitationList } from "./CitationList";

const getReasoningKey = (section) => {
    if (section === "considerations") {
        return "clinical_considerations";
    }
    return section;
};

const renderItems = (section, reasoning, colorMode) => {
    const key = getReasoningKey(section);
    const items = reasoning?.[key];

    if (!items || items.length === 0) {
        return (
            <Text fontSize="sm" color="gray.500">
                No items available
            </Text>
        );
    }

    return (
        <VStack align="stretch" spacing={2}>
            {items.map((item, i) => (
                <ReasoningItem
                    key={i}
                    item={item}
                    section={section}
                    colorMode={colorMode}
                />
            ))}
        </VStack>
    );
};

export const ReasoningContent = ({ reasoning, tabIndex, setTabIndex, colorMode }) => {
    return (
        <Tabs
            variant="enclosed"
            index={tabIndex}
            onChange={(index) => setTabIndex(index)}
            display="flex"
            flexDirection="column"
            height="100%"
        >
            <TabList>
                <Tab className="tab-style">Summary</Tab>
                <Tab className="tab-style">
                    Differentials
                </Tab>
                <Tab className="tab-style">
                    Investigations
                </Tab>
                <Tab className="tab-style">
                    Considerations
                </Tab>
                <Tab className="tab-style">Thinking</Tab>
            </TabList>

            <TabPanels
                flex="1"
                overflow="hidden"
                minHeight="0"
            >
                {/* Summary Tab */}
                <TabPanel
                    className="floating-main"
                    height="100%"
                    minHeight="0"
                    overflowY="auto"
                    display="flex"
                    flexDirection="column"
                >
                    <Text fontSize="sm">
                        {reasoning.summary}
                    </Text>
                </TabPanel>

                {/* Differentials Tab */}
                <TabPanel
                    className="floating-main"
                    height="100%"
                    minHeight="0"
                    overflowY="auto"
                >
                    {renderItems("differentials", reasoning, colorMode)}
                </TabPanel>

                {/* Investigations Tab */}
                <TabPanel
                    className="floating-main"
                    height="100%"
                    minHeight="0"
                    overflowY="auto"
                >
                    {renderItems("investigations", reasoning, colorMode)}
                </TabPanel>

                {/* Considerations Tab */}
                <TabPanel
                    className="floating-main"
                    height="100%"
                    minHeight="0"
                    overflowY="auto"
                >
                    {renderItems("considerations", reasoning, colorMode)}
                </TabPanel>

                {/* Thinking Tab */}
                <TabPanel
                    className="floating-main"
                    height="100%"
                    minHeight="0"
                    overflowY="auto"
                >
                    <Text
                        fontSize="sm"
                        whiteSpace="pre-wrap"
                    >
                        {reasoning.thinking}
                    </Text>
                    <CitationList
                        citations={reasoning?.citations}
                        colorMode={colorMode}
                    />
                </TabPanel>
            </TabPanels>
        </Tabs>
    );
};

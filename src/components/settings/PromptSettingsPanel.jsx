// Component for managing and editing prompts for LLMs.
import { useState } from "react";
import { useColorModeValue } from "../ui/color-mode";
import {
  Steps,
  Box,
  Flex,
  IconButton,
  Text,
  Collapsible,
  Textarea,
  Button,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Tab,
  NumberInput,
  NumberInputField,
  HStack,
  VStack,
  Alert,
} from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { ChevronRightIcon, ChevronDownIcon } from "../common/icons";
import {
  FaPencilAlt,
  FaFileAlt,
  FaComments,
  FaEnvelope,
  FaCog,
} from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";

const ResetToDefaultButton = ({
  onClick,
  children = "Reset to Default",
  ...props
}) => (
  <Button
    size="sm"
    h="30px"
    minH="30px"
    className="red-button"
    onClick={onClick}
    {...props}><FiRefreshCw />{children}</Button>
);

const PromptSettingsPanel = ({
  isCollapsed,
  setIsCollapsed,
  prompts,
  handlePromptChange,
  handlePromptReset,
  options,
  handleOptionChange,
  config,
}) => {
  const [tabIndex, setTabIndex] = useState(0);

  const warningIconColor = useColorModeValue("#df8e1d", "#eed49f");

  return (
    <Box className="panels-bg" p="4" borderRadius="sm">
      <Flex align="center" justify="space-between">
        <Flex align="center">
          <IconButton
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle collapse"
            variant="outline"
            size="sm"
            mr="2"
            className="collapse-toggle">{isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}</IconButton>
          <FaPencilAlt size="1.2em" style={{ marginRight: "5px" }} />
          <Text as="h3">Prompt Settings</Text>
        </Flex>
      </Flex>
      <Collapsible.Root open={!isCollapsed}>
        <Collapsible.Content>
          <Alert.Root status="warning" mt={4} borderRadius="sm">
            <Alert.Indicator color={warningIconColor} />
            <Alert.Description fontSize="sm">
              These prompts are carefully crafted defaults. We recommend not
              changing them unless you have a specific reason.
            </Alert.Description>
          </Alert.Root>
          <Tabs.Root
            variant='enclosed'
            mt={4}
            value={tabIndex}
            onValueChange={(index) => setTabIndex(index)}
          >
            <Tabs.List>
              <Tooltip content="System prompt used for refining the generated outputs">
                <Tab className="tab-style">
                  <HStack>
                    <FaPencilAlt />
                    <Text>Refinement</Text>
                  </HStack>
                </Tab>
              </Tooltip>
              <Tooltip content="System prompt used for generating summaries">
                <Tab className="tab-style">
                  <HStack>
                    <FaFileAlt />
                    <Text>Summary</Text>
                  </HStack>
                </Tab>
              </Tooltip>
              <Tooltip content="System prompt used for chat interactions">
                <Tab className="tab-style">
                  <HStack>
                    <FaComments />
                    <Text>Chat</Text>
                  </HStack>
                </Tab>
              </Tooltip>
              <Tooltip content="System prompt used for generating letters">
                <Tab className="tab-style">
                  <HStack>
                    <FaEnvelope />
                    <Text>Letter</Text>
                  </HStack>
                </Tab>
              </Tooltip>
              <Tooltip content="Technical settings for model configuration">
                <Tab className="tab-style">
                  <HStack>
                    <FaCog />
                    <Text>Advanced</Text>
                  </HStack>
                </Tab>
              </Tooltip>
            </Tabs.List>
            <TabPanels>
              <TabPanel className="floating-main">
                <VStack gap={4} align="stretch">
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontSize="md" fontWeight="bold">
                        Refinement Prompt
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        System prompt used for refining the generated outputs
                      </Text>
                    </Box>
                    <ResetToDefaultButton
                      onClick={() =>
                        handlePromptReset && handlePromptReset("refinement")
                      }
                    />
                  </Flex>
                  <Textarea
                    value={prompts?.refinement?.system || ""}
                    onValueChange={(e) =>
                      handlePromptChange("refinement", "system", e.target.value)
                    }
                    rows={10}
                    className="textarea-style"
                  />
                </VStack>
              </TabPanel>

              <TabPanel className="floating-main">
                <VStack gap={4} align="stretch">
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontSize="md" fontWeight="bold">
                        Summary Prompt
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        System prompt used for generating summaries
                      </Text>
                    </Box>
                    <ResetToDefaultButton
                      onClick={() =>
                        handlePromptReset && handlePromptReset("summary")
                      }
                    />
                  </Flex>
                  <Textarea
                    value={prompts?.summary?.system || ""}
                    onValueChange={(e) =>
                      handlePromptChange("summary", "system", e.target.value)
                    }
                    rows={10}
                    className="textarea-style"
                  />
                </VStack>
              </TabPanel>

              <TabPanel className="floating-main">
                <VStack gap={4} align="stretch">
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontSize="md" fontWeight="bold">
                        Chat Prompt
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        System prompt used for chat interactions
                      </Text>
                    </Box>
                    <ResetToDefaultButton
                      onClick={() =>
                        handlePromptReset && handlePromptReset("chat")
                      }
                    />
                  </Flex>
                  <Textarea
                    value={prompts?.chat?.system || ""}
                    onValueChange={(e) =>
                      handlePromptChange("chat", "system", e.target.value)
                    }
                    rows={10}
                    className="textarea-style"
                  />
                </VStack>
              </TabPanel>

              <TabPanel className="floating-main">
                <VStack gap={4} align="stretch">
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontSize="md" fontWeight="bold">
                        Letter Prompt
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        System prompt used for generating letters
                      </Text>
                    </Box>
                    <ResetToDefaultButton
                      onClick={() =>
                        handlePromptReset && handlePromptReset("letter")
                      }
                    />
                  </Flex>
                  <Textarea
                    value={prompts?.letter?.system || ""}
                    onValueChange={(e) =>
                      handlePromptChange("letter", "system", e.target.value)
                    }
                    rows={10}
                    className="textarea-style"
                  />
                </VStack>
              </TabPanel>

              <TabPanel className="floating-main">
                <VStack gap={6} align="stretch">
                  <Text fontSize="md" fontWeight="bold">
                    Model Configuration
                  </Text>

                  <Box>
                    <Text fontSize="sm" fontWeight="bold" mb={2}>
                      Primary Model
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={2}>
                      Context window size for the primary model
                    </Text>
                    <HStack>
                      <Text fontSize="sm">num_ctx</Text>
                      <NumberInput.Root
                        size="sm"
                        value={String(options?.general?.num_ctx)}
                        onValueChange={(newValue) =>
                          handleOptionChange("general", "num_ctx", newValue)
                        }
                      >
                        <NumberInput.Input className="input-style" width="100px" />
                      </NumberInput.Root>
                    </HStack>
                  </Box>

                  <Box>
                    <Text fontSize="sm" fontWeight="bold" mb={2}>
                      Secondary Model
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={2}>
                      Context window size for the secondary model
                    </Text>
                    <HStack>
                      <Text fontSize="sm">num_ctx</Text>
                      <NumberInput.Root
                        size="sm"
                        value={String(options?.secondary?.num_ctx)}
                        onValueChange={(newValue) =>
                          handleOptionChange("secondary", "num_ctx", newValue)
                        }
                      >
                        <NumberInput.Input className="input-style" width="100px" />
                      </NumberInput.Root>
                    </HStack>
                  </Box>

                  <Box>
                    <Text fontSize="sm" fontWeight="bold" mb={2}>
                      Letter Generation
                    </Text>
                    <Text fontSize="xs" color="gray.500" mb={2}>
                      Temperature setting for the letter generation model
                    </Text>
                    <HStack>
                      <Text fontSize="sm">temperature</Text>
                      <NumberInput.Root
                        size="sm"
                        value={String(options?.letter?.temperature)}
                        onValueChange={(newValue) =>
                          handleOptionChange("letter", "temperature", newValue)
                        }
                      >
                        <NumberInput.Input className="input-style" width="100px" />
                      </NumberInput.Root>
                    </HStack>
                  </Box>
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs.Root>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

export default PromptSettingsPanel;

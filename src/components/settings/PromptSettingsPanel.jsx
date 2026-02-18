// Component for managing and editing prompts for LLMs.
import { useState } from "react";
import {
  Box,
  Flex,
  IconButton,
  Text,
  Collapse,
  Textarea,
  Button,
  Tabs,
  TabList,
  TabPanels,
  TabPanel,
  Tab,
  Tooltip,
  NumberInput,
  NumberInputField,
  HStack,
  VStack,
  Alert,
  AlertIcon,
  AlertDescription,
  useColorModeValue,
} from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
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
    leftIcon={<FiRefreshCw />}
    size="sm"
    h="30px"
    minH="30px"
    className="red-button"
    onClick={onClick}
    {...props}
  >
    {children}
  </Button>
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
            icon={isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label="Toggle collapse"
            variant="outline"
            size="sm"
            mr="2"
            className="collapse-toggle"
          />
          <FaPencilAlt size="1.2em" style={{ marginRight: "5px" }} />
          <Text as="h3">Prompt Settings</Text>
        </Flex>
      </Flex>
      <Collapse in={!isCollapsed} animateOpacity>
        <Alert status="warning" mt={4} borderRadius="sm">
          <AlertIcon color={warningIconColor} />
          <AlertDescription fontSize="sm">
            These prompts are carefully crafted defaults. We recommend not
            changing them unless you have a specific reason.
          </AlertDescription>
        </Alert>
        <Tabs
          variant="enclosed"
          mt={4}
          index={tabIndex}
          onChange={(index) => setTabIndex(index)}
        >
          <TabList>
            <Tooltip label="System prompt used for refining the generated outputs">
              <Tab className="tab-style">
                <HStack>
                  <FaPencilAlt />
                  <Text>Refinement</Text>
                </HStack>
              </Tab>
            </Tooltip>
            <Tooltip label="System prompt used for generating summaries">
              <Tab className="tab-style">
                <HStack>
                  <FaFileAlt />
                  <Text>Summary</Text>
                </HStack>
              </Tab>
            </Tooltip>
            <Tooltip label="System prompt used for chat interactions">
              <Tab className="tab-style">
                <HStack>
                  <FaComments />
                  <Text>Chat</Text>
                </HStack>
              </Tab>
            </Tooltip>
            <Tooltip label="System prompt used for generating letters">
              <Tab className="tab-style">
                <HStack>
                  <FaEnvelope />
                  <Text>Letter</Text>
                </HStack>
              </Tab>
            </Tooltip>
            <Tooltip label="Technical settings for model configuration">
              <Tab className="tab-style">
                <HStack>
                  <FaCog />
                  <Text>Advanced</Text>
                </HStack>
              </Tab>
            </Tooltip>
          </TabList>
          <TabPanels>
            <TabPanel className="floating-main">
              <VStack spacing={4} align="stretch">
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
                  onChange={(e) =>
                    handlePromptChange("refinement", "system", e.target.value)
                  }
                  rows={10}
                  className="textarea-style"
                />
              </VStack>
            </TabPanel>

            <TabPanel className="floating-main">
              <VStack spacing={4} align="stretch">
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
                  onChange={(e) =>
                    handlePromptChange("summary", "system", e.target.value)
                  }
                  rows={10}
                  className="textarea-style"
                />
              </VStack>
            </TabPanel>

            <TabPanel className="floating-main">
              <VStack spacing={4} align="stretch">
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
                  onChange={(e) =>
                    handlePromptChange("chat", "system", e.target.value)
                  }
                  rows={10}
                  className="textarea-style"
                />
              </VStack>
            </TabPanel>

            <TabPanel className="floating-main">
              <VStack spacing={4} align="stretch">
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
                  onChange={(e) =>
                    handlePromptChange("letter", "system", e.target.value)
                  }
                  rows={10}
                  className="textarea-style"
                />
              </VStack>
            </TabPanel>

            <TabPanel className="floating-main">
              <VStack spacing={6} align="stretch">
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
                    <NumberInput
                      size="sm"
                      value={options?.general?.num_ctx}
                      onChange={(newValue) =>
                        handleOptionChange("general", "num_ctx", newValue)
                      }
                    >
                      <NumberInputField className="input-style" width="100px" />
                    </NumberInput>
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
                    <NumberInput
                      size="sm"
                      value={options?.secondary?.num_ctx}
                      onChange={(newValue) =>
                        handleOptionChange("secondary", "num_ctx", newValue)
                      }
                    >
                      <NumberInputField className="input-style" width="100px" />
                    </NumberInput>
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
                    <NumberInput
                      size="sm"
                      value={options?.letter?.temperature}
                      onChange={(newValue) =>
                        handleOptionChange("letter", "temperature", newValue)
                      }
                    >
                      <NumberInputField className="input-style" width="100px" />
                    </NumberInput>
                  </HStack>
                </Box>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Collapse>
    </Box>
  );
};

export default PromptSettingsPanel;

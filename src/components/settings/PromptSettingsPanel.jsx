// Component for managing and editing prompts for LLMs.
import { useState } from "react";
import { Box, Flex, IconButton, Text, Collapsible, Textarea, Button, Tabs, NumberInput, HStack, VStack, Alert } from "@chakra-ui/react";
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
  _config,
}) => {
  const [tabIndex, setTabIndex] = useState("0");

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
            <Alert.Indicator color="secondaryButton" />
            <Alert.Description fontSize="sm">
              These prompts are carefully crafted defaults. We recommend not
              changing them unless you have a specific reason.
            </Alert.Description>
          </Alert.Root>
          <Tabs.Root
            variant='enclosed'
            mt={4}
            value={tabIndex}
            onValueChange={({ value }) => setTabIndex(value)}
          >
            <Tabs.List>
              <Tooltip content="System prompt used for refining the generated outputs">
                <Tabs.Trigger className="tab-style" value="0">
                  <HStack>
                    <FaPencilAlt />
                    <Text>Refinement</Text>
                  </HStack>
                </Tabs.Trigger>
              </Tooltip>
              <Tooltip content="System prompt used for generating summaries">
                <Tabs.Trigger className="tab-style" value="1">
                  <HStack>
                    <FaFileAlt />
                    <Text>Summary</Text>
                  </HStack>
                </Tabs.Trigger>
              </Tooltip>
              <Tooltip content="System prompt used for chat interactions">
                <Tabs.Trigger className="tab-style" value="2">
                  <HStack>
                    <FaComments />
                    <Text>Chat</Text>
                  </HStack>
                </Tabs.Trigger>
              </Tooltip>
              <Tooltip content="System prompt used for generating letters">
                <Tabs.Trigger className="tab-style" value="3">
                  <HStack>
                    <FaEnvelope />
                    <Text>Letter</Text>
                  </HStack>
                </Tabs.Trigger>
              </Tooltip>
              <Tooltip content="Technical settings for model configuration">
                <Tabs.Trigger className="tab-style" value="4">
                  <HStack>
                    <FaCog />
                    <Text>Advanced</Text>
                  </HStack>
                </Tabs.Trigger>
              </Tooltip>
            </Tabs.List>
            
              <Tabs.Content value="0" className="floating-main">
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
                    onChange={(e) =>
                      handlePromptChange("refinement", "system", e.target.value)
                    }
                    rows={10}
                    className="textarea-style"
                  />
                </VStack>
              </Tabs.Content>

              <Tabs.Content value="1" className="floating-main">
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
                    onChange={(e) =>
                      handlePromptChange("summary", "system", e.target.value)
                    }
                    rows={10}
                    className="textarea-style"
                  />
                </VStack>
              </Tabs.Content>

              <Tabs.Content value="2" className="floating-main">
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
                    onChange={(e) =>
                      handlePromptChange("chat", "system", e.target.value)
                    }
                    rows={10}
                    className="textarea-style"
                  />
                </VStack>
              </Tabs.Content>

              <Tabs.Content value="3" className="floating-main">
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
                    onChange={(e) =>
                      handlePromptChange("letter", "system", e.target.value)
                    }
                    rows={10}
                    className="textarea-style"
                  />
                </VStack>
              </Tabs.Content>

              <Tabs.Content value="4" className="floating-main">
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
              </Tabs.Content>
            
          </Tabs.Root>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};

export default PromptSettingsPanel;

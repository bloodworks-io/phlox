// Component for managing and editing prompts for LLMs.
import { useState } from "react";
import {
  Box,
  Flex,
  IconButton,
  Text,
  Collapse,
  Textarea,
  Tooltip,
  NumberInput,
  NumberInputField,
  HStack,
  Alert,
  AlertIcon,
  AlertDescription,
  CloseButton,
} from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { FaPencilAlt } from "react-icons/fa";
import { FiRefreshCw } from "react-icons/fi";

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
  const [isAlertDismissed, setIsAlertDismissed] = useState(false);
  const [
    isClinicalHistoryPromptCollapsed,
    setIsClinicalHistoryPromptCollapsed,
  ] = useState(true);
  const [isPlanPromptCollapsed, setIsPlanPromptCollapsed] = useState(true);
  const [isRefinementPromptCollapsed, setIsRefinementPromptCollapsed] =
    useState(true);
  const [isChatCollapsed, setIsChatCollapsed] = useState(true);
  const [isSummaryPromptCollapsed, setIsSummaryPromptCollapsed] =
    useState(true);
  const [isLetterPromptCollapsed, setIsLetterPromptCollapsed] = useState(true);
  const [isPromptOptionsCollapsed, setIsPromptOptionsCollapsed] =
    useState(true);

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
        {!isAlertDismissed && (
          <Alert status="warning" mt={4} borderRadius="sm">
            <AlertIcon />
            <Box flex="1">
              <AlertDescription fontSize="sm">
                These prompts are carefully crafted defaults. We recommend not
                changing them unless you have a specific reason.
              </AlertDescription>
            </Box>
            <CloseButton
              alignSelf="flex-start"
              position="relative"
              right={-1}
              top={-1}
              onClick={() => setIsAlertDismissed(true)}
            />
          </Alert>
        )}
        <Box mt="4" borderRadius="sm">
          <Box mt="4">
            <IconButton
              icon={
                isRefinementPromptCollapsed ? (
                  <ChevronRightIcon />
                ) : (
                  <ChevronDownIcon />
                )
              }
              onClick={() =>
                setIsRefinementPromptCollapsed(!isRefinementPromptCollapsed)
              }
              aria-label="Toggle Refinement Prompt"
              variant="outline"
              size="10"
              mr="2"
              className="collapse-toggle"
            />
            <HStack spacing={2} align="center">
              <Tooltip label="Reset to default">
                <IconButton
                  icon={<FiRefreshCw />}
                  onClick={() =>
                    handlePromptReset && handlePromptReset("refinement")
                  }
                  aria-label="Reset Refinement Prompt"
                  variant="ghost"
                  size="xs"
                  colorScheme="orange"
                />
              </Tooltip>
              <Tooltip label="System prompt used for refining the generated outputs">
                <Text fontSize="sm" mb="1" mt="4" display="inline">
                  Refinement Prompt
                </Text>
              </Tooltip>
            </HStack>
            <Collapse in={!isRefinementPromptCollapsed} animateOpacity>
              <Textarea
                size="sm"
                mt="4"
                value={prompts?.refinement?.system}
                onChange={(e) =>
                  handlePromptChange("refinement", "system", e.target.value)
                }
                rows={10}
                className="textarea-style"
              />
            </Collapse>
          </Box>
          <Box mt="4">
            <IconButton
              icon={
                isSummaryPromptCollapsed ? (
                  <ChevronRightIcon />
                ) : (
                  <ChevronDownIcon />
                )
              }
              onClick={() =>
                setIsSummaryPromptCollapsed(!isSummaryPromptCollapsed)
              }
              aria-label="Toggle Summary Prompt"
              variant="outline"
              size="10"
              mr="2"
              className="collapse-toggle"
            />
            <HStack spacing={2} align="center">
              <Tooltip label="Reset to default">
                <IconButton
                  icon={<FiRefreshCw />}
                  onClick={() =>
                    handlePromptReset && handlePromptReset("summary")
                  }
                  aria-label="Reset Summary Prompt"
                  variant="ghost"
                  size="xs"
                  colorScheme="orange"
                />
              </Tooltip>
              <Tooltip label="System prompt used for generating summaries">
                <Text fontSize="sm" mb="1" mt="4" display="inline">
                  Summary Prompt
                </Text>
              </Tooltip>
            </HStack>
            <Collapse in={!isSummaryPromptCollapsed} animateOpacity>
              <Textarea
                size="sm"
                value={prompts?.summary?.system}
                onChange={(e) =>
                  handlePromptChange("summary", "system", e.target.value)
                }
                rows={10}
                mt="4"
                className="textarea-style"
              />
            </Collapse>
          </Box>
          <Box mt="4">
            <IconButton
              icon={
                isChatCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />
              }
              onClick={() => setIsChatCollapsed(!isChatCollapsed)}
              aria-label="Toggle Chat Prompt"
              variant="outline"
              size="10"
              mr="2"
              className="collapse-toggle"
            />
            <HStack spacing={2} align="center">
              <Tooltip label="Reset to default">
                <IconButton
                  icon={<FiRefreshCw />}
                  onClick={() => handlePromptReset && handlePromptReset("chat")}
                  aria-label="Reset Chat Prompt"
                  variant="ghost"
                  size="xs"
                  colorScheme="orange"
                />
              </Tooltip>
              <Tooltip label="System prompt used for chat interactions">
                <Text fontSize="sm" mb="1" mt="4" display="inline">
                  Chat Prompt
                </Text>
              </Tooltip>
            </HStack>
            <Collapse in={!isChatCollapsed} animateOpacity>
              <Textarea
                size="sm"
                value={prompts?.chat?.system}
                onChange={(e) =>
                  handlePromptChange("chat", "system", e.target.value)
                }
                rows={10}
                className="textarea-style"
              />
            </Collapse>
          </Box>
          <Box mt="4">
            <IconButton
              icon={
                isLetterPromptCollapsed ? (
                  <ChevronRightIcon />
                ) : (
                  <ChevronDownIcon />
                )
              }
              onClick={() =>
                setIsLetterPromptCollapsed(!isLetterPromptCollapsed)
              }
              aria-label="Toggle Letter Prompt"
              variant="outline"
              size="10"
              mr="2"
              className="collapse-toggle"
            />
            <HStack spacing={2} align="center">
              <Tooltip label="Reset to default">
                <IconButton
                  icon={<FiRefreshCw />}
                  onClick={() =>
                    handlePromptReset && handlePromptReset("letter")
                  }
                  aria-label="Reset Letter Prompt"
                  variant="ghost"
                  size="xs"
                  colorScheme="orange"
                />
              </Tooltip>
              <Tooltip label="System prompt used for generating letters">
                <Text fontSize="sm" mb="1" mt="4" display="inline">
                  Letter Prompt
                </Text>
              </Tooltip>
            </HStack>
            <Collapse in={!isLetterPromptCollapsed} animateOpacity>
              <Textarea
                size="sm"
                value={prompts?.letter?.system}
                onChange={(e) =>
                  handlePromptChange("letter", "system", e.target.value)
                }
                rows={10}
                className="textarea-style"
              />
            </Collapse>
          </Box>

          <Box mt="4">
            <IconButton
              icon={
                isPromptOptionsCollapsed ? (
                  <ChevronRightIcon />
                ) : (
                  <ChevronDownIcon />
                )
              }
              onClick={() =>
                setIsPromptOptionsCollapsed(!isPromptOptionsCollapsed)
              }
              aria-label="Toggle Prompt Options"
              variant="outline"
              size="10"
              mr="2"
              className="collapse-toggle"
            />
            <Text fontSize="sm" mb="1" mt="4" display="inline">
              Advanced Options
            </Text>
            <Collapse in={!isPromptOptionsCollapsed} animateOpacity>
              <HStack mt="2" spacing="24" wrap="wrap">
                <Box mt="4">
                  <Text fontSize="md" fontWeight="bold">
                    Primary Model
                  </Text>
                  <Box>
                    <Tooltip label="Context window size for the primary model">
                      <Text fontSize="sm">num_ctx</Text>
                    </Tooltip>
                    <NumberInput
                      size="sm"
                      value={options?.general?.num_ctx}
                      onChange={(newValue) =>
                        handleOptionChange("general", "num_ctx", newValue)
                      }
                    >
                      <NumberInputField className="input-style" width="100px" />
                    </NumberInput>
                  </Box>
                </Box>
                <Box mt="4">
                  <Text fontSize="md" fontWeight="bold">
                    Secondary Model
                  </Text>
                  <Box>
                    <Tooltip label="Context window size for the secondary model">
                      <Text fontSize="sm">num_ctx</Text>
                    </Tooltip>
                    <NumberInput
                      size="sm"
                      value={options?.secondary?.num_ctx}
                      onChange={(newValue) =>
                        handleOptionChange("secondary", "num_ctx", newValue)
                      }
                    >
                      <NumberInputField className="input-style" width="100px" />
                    </NumberInput>
                  </Box>
                </Box>
                <Box mt="4">
                  <Text fontSize="md" fontWeight="bold">
                    Letter Options
                  </Text>
                  <Box>
                    <Tooltip label="Temperature setting for the letter generation model">
                      <Text fontSize="sm">temperature</Text>
                    </Tooltip>
                    <NumberInput
                      size="sm"
                      value={options?.letter?.temperature}
                      onChange={(newValue) =>
                        handleOptionChange("letter", "temperature", newValue)
                      }
                    >
                      <NumberInputField className="input-style" width="100px" />
                    </NumberInput>
                  </Box>
                </Box>
              </HStack>
            </Collapse>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
};

export default PromptSettingsPanel;

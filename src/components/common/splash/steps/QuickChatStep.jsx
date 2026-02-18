import { useState } from "react";
import {
  VStack,
  Box,
  Text,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { stepVariants } from "../constants";
import { validateQuickChatStep } from "../../../../utils/splash/validators";

const MotionVStack = motion(VStack);

export const useQuickChatStep = () => {
  const [quickChat1Title, setQuickChat1Title] = useState("Critique my plan");
  const [quickChat1Prompt, setQuickChat1Prompt] = useState(
    "Critique my plan",
  );
  const [quickChat2Title, setQuickChat2Title] = useState(
    "Any additional investigations",
  );
  const [quickChat2Prompt, setQuickChat2Prompt] = useState(
    "Any additional investigations",
  );
  const [quickChat3Title, setQuickChat3Title] = useState(
    "Any differentials to consider",
  );
  const [quickChat3Prompt, setQuickChat3Prompt] = useState(
    "Any differentials to consider",
  );

  return {
    quickChat1Title,
    setQuickChat1Title,
    quickChat1Prompt,
    setQuickChat1Prompt,
    quickChat2Title,
    setQuickChat2Title,
    quickChat2Prompt,
    setQuickChat2Prompt,
    quickChat3Title,
    setQuickChat3Title,
    quickChat3Prompt,
    setQuickChat3Prompt,
    validate: () =>
      validateQuickChatStep(
        quickChat1Title,
        quickChat1Prompt,
        quickChat2Title,
        quickChat2Prompt,
        quickChat3Title,
        quickChat3Prompt,
      ),
    getData: () => ({
      quickChat1Title,
      quickChat1Prompt,
      quickChat2Title,
      quickChat2Prompt,
      quickChat3Title,
      quickChat3Prompt,
    }),
  };
};

export const QuickChatStep = ({
  quickChat1Title,
  setQuickChat1Title,
  quickChat1Prompt,
  setQuickChat1Prompt,
  quickChat2Title,
  setQuickChat2Title,
  quickChat2Prompt,
  setQuickChat2Prompt,
  quickChat3Title,
  setQuickChat3Title,
  quickChat3Prompt,
  setQuickChat3Prompt,
  currentColors,
}) => (
  <MotionVStack
    key="quickchat"
    variants={stepVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    spacing={6}
    w="100%"
  >
    <Alert status="info" borderRadius="md">
      <AlertIcon />
      <Box>
        <AlertTitle>Customize Quick Chat Buttons</AlertTitle>
        <AlertDescription>
          Set up three quick chat buttons for common queries. These will
          appear in your chat interface for easy access. You can change these
          anytime in Settings.
        </AlertDescription>
      </Box>
    </Alert>

    <VStack spacing={6} w="100%">
      <Box w="100%" p={4} borderRadius="md" className="floating-main">
        <Text fontWeight="medium" mb={3} color={currentColors.textPrimary}>
          Quick Chat Button 1
        </Text>
        <VStack spacing={3}>
          <FormControl isRequired>
            <FormLabel fontSize="sm" color={currentColors.textSecondary}>
              Button Title
            </FormLabel>
            <Input
              placeholder="e.g., Critique my plan"
              value={quickChat1Title}
              onChange={(e) => setQuickChat1Title(e.target.value)}
              className="input-style"
              size="sm"
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel fontSize="sm" color={currentColors.textSecondary}>
              Prompt
            </FormLabel>
            <Textarea
              placeholder="e.g., Please critique my management plan and suggest any improvements"
              value={quickChat1Prompt}
              onChange={(e) => setQuickChat1Prompt(e.target.value)}
              className="input-style"
              size="sm"
              rows={2}
            />
          </FormControl>
        </VStack>
      </Box>

      <Box w="100%" p={4} borderRadius="md" className="floating-main">
        <Text fontWeight="medium" mb={3} color={currentColors.textPrimary}>
          Quick Chat Button 2
        </Text>
        <VStack spacing={3}>
          <FormControl isRequired>
            <FormLabel fontSize="sm" color={currentColors.textSecondary}>
              Button Title
            </FormLabel>
            <Input
              placeholder="e.g., Additional investigations"
              value={quickChat2Title}
              onChange={(e) => setQuickChat2Title(e.target.value)}
              className="input-style"
              size="sm"
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel fontSize="sm" color={currentColors.textSecondary}>
              Prompt
            </FormLabel>
            <Textarea
              placeholder="e.g., What additional investigations should I consider for this patient?"
              value={quickChat2Prompt}
              onChange={(e) => setQuickChat2Prompt(e.target.value)}
              className="input-style"
              size="sm"
              rows={2}
            />
          </FormControl>
        </VStack>
      </Box>

      <Box w="100%" p={4} borderRadius="md" className="floating-main">
        <Text fontWeight="medium" mb={3} color={currentColors.textPrimary}>
          Quick Chat Button 3
        </Text>
        <VStack spacing={3}>
          <FormControl isRequired>
            <FormLabel fontSize="sm" color={currentColors.textSecondary}>
              Button Title
            </FormLabel>
            <Input
              placeholder="e.g., Differential diagnoses"
              value={quickChat3Title}
              onChange={(e) => setQuickChat3Title(e.target.value)}
              className="input-style"
              size="sm"
            />
          </FormControl>
          <FormControl isRequired>
            <FormLabel fontSize="sm" color={currentColors.textSecondary}>
              Prompt
            </FormLabel>
            <Textarea
              placeholder="e.g., What other differential diagnoses should I consider for this presentation?"
              value={quickChat3Prompt}
              onChange={(e) => setQuickChat3Prompt(e.target.value)}
              className="input-style"
              size="sm"
              rows={2}
            />
          </FormControl>
        </VStack>
      </Box>
    </VStack>
  </MotionVStack>
);

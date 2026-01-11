import { useState, useEffect, useCallback } from "react";
import {
  VStack,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Text,
  HStack,
  Icon,
  Flex,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useToast } from "@chakra-ui/react";
import { FaCheckCircle } from "react-icons/fa";
import { SPLASH_STEPS } from "../constants";
import { stepVariants } from "../constants";
import { validateLettersStep } from "../../../../utils/splash/validators";
import { settingsService } from "../../../../utils/settings/settingsUtils";

const MotionVStack = motion(VStack);

export const useLettersStep = (currentStep) => {
  const toast = useToast();
  const [availableLetterTemplates, setAvailableLetterTemplates] = useState([]);
  const [selectedLetterTemplate, setSelectedLetterTemplate] = useState("");
  const [isFetchingLetterTemplates, setIsFetchingLetterTemplates] =
    useState(false);

  const fetchLetterTemplates = useCallback(async () => {
    if (
      currentStep === SPLASH_STEPS.LETTERS &&
      availableLetterTemplates.length === 0
    ) {
      setIsFetchingLetterTemplates(true);
      try {
        const response = await settingsService.fetchLetterTemplates();
        setAvailableLetterTemplates(response.templates || []);
        if (
          !selectedLetterTemplate &&
          response.templates &&
          response.templates.length > 0
        ) {
          setSelectedLetterTemplate(response.templates[0].id.toString());
        }
      } catch (error) {
        toast({
          title: "Error fetching letter templates",
          description: error.message || "Could not load letter templates",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsFetchingLetterTemplates(false);
      }
    }
  }, [
    currentStep,
    availableLetterTemplates.length,
    selectedLetterTemplate,
    toast,
  ]);

  useEffect(() => {
    fetchLetterTemplates();
  }, [fetchLetterTemplates]);

  return {
    availableLetterTemplates,
    selectedLetterTemplate,
    setSelectedLetterTemplate,
    isFetchingLetterTemplates,
    validate: () => validateLettersStep(selectedLetterTemplate),
    getData: () => ({ selectedLetterTemplate }),
  };
};

export const LettersStep = ({
  availableLetterTemplates,
  selectedLetterTemplate,
  setSelectedLetterTemplate,
  isFetchingLetterTemplates,
  currentColors,
}) => (
  <MotionVStack
    key="letters"
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
        <AlertTitle>Choose Default Letter Template</AlertTitle>
        <AlertDescription>
          Select your preferred letter template for generating correspondence.
          You can create custom letter templates and change this setting
          later.
        </AlertDescription>
      </Box>
    </Alert>

    {isFetchingLetterTemplates ? (
      <Flex align="center" justify="center" py={8}>
        <Spinner size="lg" color={currentColors.primaryButton} />
        <Text ml={4} color={currentColors.textSecondary}>
          Loading letter templates...
        </Text>
      </Flex>
    ) : (
      <SimpleGrid columns={1} spacing={4} w="100%">
        {availableLetterTemplates.map((template) => (
          <Card
            key={template.id}
            cursor="pointer"
            onClick={() =>
              setSelectedLetterTemplate(template.id.toString())
            }
            borderWidth="2px"
            borderColor={
              selectedLetterTemplate === template.id.toString()
                ? currentColors.primaryButton
                : "transparent"
            }
            bg={
              selectedLetterTemplate === template.id.toString()
                ? currentColors.surface + "40"
                : currentColors.surface
            }
            _hover={{
              borderColor: currentColors.primaryButton + "80",
              transform: "translateY(-2px)",
            }}
            transition="all 0.2s"
          >
            <CardHeader pb={2}>
              <HStack justify="space-between">
                <Heading size="md" color={currentColors.textPrimary}>
                  {template.name}
                </Heading>
                {selectedLetterTemplate === template.id.toString() && (
                  <Icon as={FaCheckCircle} color="green.500" />
                )}
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <Text
                fontSize="sm"
                color={currentColors.textSecondary}
                noOfLines={2}
              >
                {template.content ||
                  "A template for generating professional correspondence."}
              </Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
    )}
  </MotionVStack>
);

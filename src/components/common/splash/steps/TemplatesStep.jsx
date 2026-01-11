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
import { TEMPLATE_DESCRIPTIONS } from "../constants";
import { validateTemplatesStep } from "../../../../utils/splash/validators";
import { settingsService } from "../../../../utils/settings/settingsUtils";

const MotionVStack = motion(VStack);

export const useTemplatesStep = (currentStep) => {
  const toast = useToast();
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (currentStep === SPLASH_STEPS.TEMPLATES && availableTemplates.length === 0) {
      setIsFetchingTemplates(true);
      try {
        await settingsService.fetchTemplates((templates) => {
          setAvailableTemplates(templates);
          if (!selectedTemplate && templates.length > 0) {
            setSelectedTemplate(templates[0].template_key);
          }
        });
      } catch (error) {
        toast({
          title: "Error fetching templates",
          description: error.message || "Could not load templates",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsFetchingTemplates(false);
      }
    }
  }, [currentStep, availableTemplates.length, selectedTemplate, toast]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    availableTemplates,
    selectedTemplate,
    setSelectedTemplate,
    isFetchingTemplates,
    validate: () => validateTemplatesStep(selectedTemplate),
    getData: () => ({ selectedTemplate }),
  };
};

export const TemplatesStep = ({
  availableTemplates,
  selectedTemplate,
  setSelectedTemplate,
  isFetchingTemplates,
  currentColors,
}) => (
  <MotionVStack
    key="templates"
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
        <AlertTitle>Choose Your Default Template</AlertTitle>
        <AlertDescription>
          Select a clinical note template that best fits your workflow. You
          can create custom templates and change this setting later in the
          Settings panel.
        </AlertDescription>
      </Box>
    </Alert>

    {isFetchingTemplates ? (
      <Flex align="center" justify="center" py={8}>
        <Spinner size="lg" color={currentColors.primaryButton} />
        <Text ml={4} color={currentColors.textSecondary}>
          Loading templates...
        </Text>
      </Flex>
    ) : (
      <SimpleGrid columns={1} spacing={4} w="100%">
        {availableTemplates.map((template) => (
          <Card
            key={template.template_key}
            cursor="pointer"
            onClick={() => setSelectedTemplate(template.template_key)}
            borderWidth="2px"
            borderColor={
              selectedTemplate === template.template_key
                ? currentColors.primaryButton
                : "transparent"
            }
            bg={
              selectedTemplate === template.template_key
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
                  {template.template_name}
                </Heading>
                {selectedTemplate === template.template_key && (
                  <Icon as={FaCheckCircle} color="green.500" />
                )}
              </HStack>
            </CardHeader>
            <CardBody pt={0}>
              <Text fontSize="sm" color={currentColors.textSecondary} mb={3}>
                {TEMPLATE_DESCRIPTIONS[template.template_key] ||
                  "A custom template for clinical documentation."}
              </Text>
              <Text
                fontSize="xs"
                color={currentColors.textSecondary}
                fontWeight="medium"
              >
                Fields:{" "}
                {template.fields?.map((f) => f.field_name).join(", ") ||
                  "Loading..."}
              </Text>
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>
    )}
  </MotionVStack>
);

import {
  VStack,
  SimpleGrid,
  Card,
  Heading,
  Text,
  HStack,
  Icon,
  Flex,
  Spinner,
  Alert,
  Box,
} from "@chakra-ui/react";
import { FaCheckCircle } from "react-icons/fa";
import { TEMPLATE_DESCRIPTIONS } from "../constants";
import { useTemplatesStep } from "../../../../utils/hooks/splash/useTemplatesStep";

export { useTemplatesStep };

export const TemplatesStep = ({
  availableTemplates,
  selectedTemplate,
  setSelectedTemplate,
  isFetchingTemplates,
}) => (
  <VStack
    key="templates"
    className="anim-fade-slide-right"
    gap={6}
    w="100%"
  >
    <Alert.Root status="info" borderRadius="md">
      <Alert.Indicator />
      <Box>
        <Alert.Title>Choose Your Default Template</Alert.Title>
        <Alert.Description>
          Select a clinical note template that best fits your workflow. You can
          create custom templates and change this setting later in the Settings
          panel.
        </Alert.Description>
      </Box>
    </Alert.Root>

    {isFetchingTemplates ? (
      <Flex align="center" justify="center" py={8}>
        <Spinner size="lg" color={"primaryButton"} />
        <Text ml={4} color={"textSecondary"}>
          Loading templates...
        </Text>
      </Flex>
    ) : (
      <SimpleGrid columns={1} gap={4} w="100%">
        {availableTemplates.map((template) => (
          <Card.Root
            key={template.template_key}
            cursor="pointer"
            onClick={() => setSelectedTemplate(template.template_key)}
            borderWidth="2px"
            borderColor={
              selectedTemplate === template.template_key
                ? "primaryButton"
                : "transparent"
            }
            bg={
              selectedTemplate === template.template_key
                ? "surfaceQuartile"
                : "surface"
            }
            _hover={{
              borderColor: "primaryButtonHalftone",
              transform: "translateY(-2px)",
            }}
            transition="all 0.2s"
          >
            <Card.Header pb={2}>
              <HStack justify="space-between">
                <Heading size="md" color={"textPrimary"}>
                  {template.template_name}
                </Heading>
                {selectedTemplate === template.template_key && (
                  <Icon color="green.500" asChild><FaCheckCircle /></Icon>
                )}
              </HStack>
            </Card.Header>
            <Card.Body pt={0}>
              <Text fontSize="sm" color={"textSecondary"} mb={3}>
                {TEMPLATE_DESCRIPTIONS[template.template_key] ||
                  "A custom template for clinical documentation."}
              </Text>
              <Text
                fontSize="xs"
                color={"textSecondary"}
                fontWeight="medium"
              >
                Fields:{" "}
                {template.fields?.map((f) => f.field_name).join(", ") ||
                  "Loading..."}
              </Text>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    )}
  </VStack>
);

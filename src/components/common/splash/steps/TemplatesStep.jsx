import {
  VStack,
  SimpleGrid,
  Text,
  HStack,
  Icon,
  Flex,
  Spinner,
  Box,
} from "@chakra-ui/react";
import { FaCheckCircle } from "react-icons/fa";
import { TEMPLATE_DESCRIPTIONS } from "../constants";

const TEMPLATE_COLORS = [
  "primaryButton",
  "successButton",
  "secondaryButton",
  "neutralButton",
  "tertiaryButton",
];

export const TemplatesStep = ({
  availableTemplates,
  selectedTemplate,
  setSelectedTemplate,
  isFetchingTemplates,
}) => (
  <VStack
    key="templates"
    className="anim-fade-slide-right"
    gap={3}
    w="100%"
  >
    {isFetchingTemplates ? (
      <Flex align="center" justify="center" py={8}>
        <Spinner size="lg" color="primaryButton" />
        <Text ml={4} color="textSecondary">Loading templates...</Text>
      </Flex>
    ) : (
      <SimpleGrid columns={{ base: 1, md: 2 }} gap={3} w="100%">
        {availableTemplates.map((template, index) => {
          const isSelected = selectedTemplate === template.template_key;
          const accent = TEMPLATE_COLORS[index % TEMPLATE_COLORS.length];

          return (
            <Box
              key={template.template_key}
              position="relative"
              overflow="hidden"
              cursor="pointer"
              onClick={() => setSelectedTemplate(template.template_key)}
              p={3}
              pl={4}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={isSelected ? accent : "border"}
              bg={isSelected ? "primaryButtonFaint" : "secondary"}
              _hover={{
                borderColor: accent,
                shadow: "sm",
              }}
              transition="all 0.2s ease"
            >
              {/* Colored accent strip */}
              <Box
                position="absolute"
                left={0}
                top={0}
                bottom={0}
                width="4px"
                bg={accent}
                opacity={isSelected ? 1 : 0.5}
                transition="opacity 0.2s ease"
              />

              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" fontWeight="bold" color="textPrimary">
                  {template.template_name}
                </Text>
                {isSelected && (
                  <Icon color={accent} boxSize={4} asChild>
                    <FaCheckCircle />
                  </Icon>
                )}
              </HStack>
              <Text fontSize="xs" color="textSecondary" lineHeight="1.4">
                {TEMPLATE_DESCRIPTIONS[template.template_key] ||
                  "A custom template for clinical documentation."}
              </Text>
            </Box>
          );
        })}
      </SimpleGrid>
    )}
  </VStack>
);

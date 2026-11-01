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
import { useTranslation } from "react-i18next";
import { FaCheckCircle } from "react-icons/fa";
import { TEMPLATE_DESCRIPTIONS } from "../constants";

export const TemplatesStep = ({
  availableTemplates,
  selectedTemplate,
  setSelectedTemplate,
  isFetchingTemplates,
}) => {
  const { t } = useTranslation();

  return (
  <VStack
    key="templates"
    className="anim-fade-slide-right"
    gap={3}
    w="100%"
  >
    {isFetchingTemplates ? (
      <Flex align="center" justify="center" py={8}>
        <Spinner size="lg" color="folio.accent" />
        <Text ml={4} color="folio.muted">{t("splash.step.templates.loading")}</Text>
      </Flex>
    ) : (
      <SimpleGrid
        columns={{ base: 1, md: 2 }}
        gap={3}
        w="100%"
        className="anim-stagger"
        sx={{ "& > *": { animationDuration: "0.2s" } }}
      >
        {availableTemplates.map((template) => {
          const isSelected = selectedTemplate === template.template_key;

          return (
            <Box
              key={template.template_key}
              position="relative"
              overflow="hidden"
              cursor="pointer"
              onClick={() => setSelectedTemplate(template.template_key)}
              p={3}
              pl={4}
              borderRadius="folioPanel"
              borderWidth="1px"
              borderColor={isSelected ? "folio.accent" : "folio.line"}
              bg={isSelected ? "folio.accentSoft" : "folio.paper"}
              _hover={{
                borderColor: "folio.accent",
              }}
              transition="background-color 160ms ease, border-color 160ms ease"
            >
              {/* Colored accent strip */}
              <Box
                position="absolute"
                left={0}
                top={0}
                bottom={0}
                width="4px"
                bg="folio.accent"
                opacity={isSelected ? 1 : 0.35}
                transition="opacity 160ms ease"
              />

              <HStack justify="space-between" mb={1}>
                <Text fontSize="sm" fontWeight="bold" color="folio.ink">
                  {template.template_name}
                </Text>
                {isSelected && (
                  <Icon
                    color="folio.accent"
                    boxSize={4}
                    asChild
                    className="anim-fade-scale"
                    sx={{ animationDuration: "0.2s" }}
                  >
                    <FaCheckCircle />
                  </Icon>
                )}
              </HStack>
              <Text fontSize="xs" color="folio.muted" lineHeight="1.4">
                {TEMPLATE_DESCRIPTIONS[template.template_key] ||
                  t("splash.step.templates.customDescription")}
              </Text>
            </Box>
          );
        })}
      </SimpleGrid>
    )}
  </VStack>
  );
};

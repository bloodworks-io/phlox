import {
  Steps,
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
import { motion } from "framer-motion";
import { FaCheckCircle } from "react-icons/fa";
import { stepVariants } from "../constants";
import { useLettersStep } from "../../../../utils/hooks/splash/useLettersStep";

const MotionVStack = motion(VStack);

export { useLettersStep };

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
    gap={6}
    w="100%"
  >
    <Alert.Root status="info" borderRadius="md">
      <Alert.Indicator />
      <Box>
        <Alert.Title>Choose Default Letter Template</Alert.Title>
        <Alert.Description>
          Select your preferred letter template for generating correspondence.
          You can create custom letter templates and change this setting later.
        </Alert.Description>
      </Box>
    </Alert.Root>

    {isFetchingLetterTemplates ? (
      <Flex align="center" justify="center" py={8}>
        <Spinner size="lg" color={currentColors.primaryButton} />
        <Text ml={4} color={currentColors.textSecondary}>
          Loading letter templates...
        </Text>
      </Flex>
    ) : (
      <SimpleGrid columns={1} gap={4} w="100%">
        {availableLetterTemplates.map((template) => (
          <Card.Root
            key={template.id}
            cursor="pointer"
            onClick={() => setSelectedLetterTemplate(template.id.toString())}
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
            <Card.Header pb={2}>
              <HStack justify="space-between">
                <Heading size="md" color={currentColors.textPrimary}>
                  {template.name}
                </Heading>
                {selectedLetterTemplate === template.id.toString() && (
                  <Icon color="green.500" asChild><FaCheckCircle /></Icon>
                )}
              </HStack>
            </Card.Header>
            <Card.Body pt={0}>
              <Text
                fontSize="sm"
                color={currentColors.textSecondary}
                lineClamp={2}
              >
                {template.content ||
                  "A template for generating professional correspondence."}
              </Text>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    )}
  </MotionVStack>
);

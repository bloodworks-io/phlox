import { useState } from "react";
import {
  VStack,
  FormControl,
  FormLabel,
  Input,
  Select,
  HStack,
  Tooltip,
} from "@chakra-ui/react";
import { InfoIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { stepVariants } from "../constants";
import { SPECIALTIES } from "../../../../utils/constants/index.jsx";
import { validatePersonalStep } from "../../../../utils/splash/validators";

const MotionVStack = motion(VStack);

export const usePersonalStep = () => {
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");

  return {
    name,
    setName,
    specialty,
    setSpecialty,
    validate: () => validatePersonalStep(name, specialty),
    getData: () => ({ name, specialty }),
  };
};

export const PersonalStep = ({
  name,
  setName,
  specialty,
  setSpecialty,
  currentColors,
}) => (
  <MotionVStack
    key="personal"
    variants={stepVariants}
    initial="hidden"
    animate="visible"
    exit="exit"
    spacing={6}
    w="100%"
  >
    <VStack spacing={4} w="100%">
      <FormControl isRequired>
        <HStack>
          <FormLabel
            color={currentColors.textSecondary}
            sx={{
              fontFamily: '"Roboto", sans-serif',
              fontSize: "sm",
              fontWeight: "500",
            }}
          >
            Your Name
          </FormLabel>
          <Tooltip
            label="This will be used to personalize your experience and in generated documents"
            placement="top"
            hasArrow
            fontSize="xs"
            bg="gray.700"
            color="white"
          >
            <InfoIcon boxSize={3} color={currentColors.textSecondary} />
          </Tooltip>
        </HStack>
        <Input
          placeholder="Ada Lovelace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-style"
          size="md"
        />
      </FormControl>

      <FormControl isRequired>
        <HStack>
          <FormLabel
            color={currentColors.textSecondary}
            sx={{
              fontFamily: '"Roboto", sans-serif',
              fontSize: "sm",
              fontWeight: "500",
            }}
          >
            Your Specialty
          </FormLabel>
          <Tooltip
            label="Your medical specialty helps Phlox provide more relevant assistance and suggestions"
            placement="top"
            hasArrow
            fontSize="xs"
            bg="gray.700"
            color="white"
          >
            <InfoIcon boxSize={3} color={currentColors.textSecondary} />
          </Tooltip>
        </HStack>
        <Select
          placeholder="Select your specialty"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="input-style"
          size="md"
        >
          {SPECIALTIES.map((spec) => (
            <option key={spec} value={spec}>
              {spec}
            </option>
          ))}
        </Select>
      </FormControl>
    </VStack>
  </MotionVStack>
);

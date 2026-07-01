import { useState } from "react";
import { VStack, Input, NativeSelect, HStack, Field } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { InfoIcon } from "../../icons";
import { SPECIALTIES } from "../../../../utils/constants";
import { validatePersonalStep } from "../../../../utils/splash/validators";

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
}) => (
  <VStack
    key="personal"
    className="anim-fade-slide-right"
    gap={6}
    w="100%"
  >
    <VStack gap={4} w="100%">
      <Field.Root required>
        <HStack>
          <Field.Label
            color={"textSecondary"}
            css={{
              fontFamily: '"Roboto", sans-serif',
              fontSize: "sm",
              fontWeight: "500"
            }}
          >
            Your Name
          </Field.Label>
          <Tooltip
            content="This will be used to personalize your experience and in generated documents"
            showArrow
            fontSize="xs"
            bg="gray.700"
            color="white"
            positioning={{
              placement: "top"
            }}
          >
            <InfoIcon boxSize={3} color={"textSecondary"} />
          </Tooltip>
        </HStack>
        <Input
          placeholder="Ada Lovelace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-style"
          size="md"
        />
      </Field.Root>

      <Field.Root required>
        <HStack>
          <Field.Label
            color={"textSecondary"}
            css={{
              fontFamily: '"Roboto", sans-serif',
              fontSize: "sm",
              fontWeight: "500"
            }}
          >
            Your Specialty
          </Field.Label>
          <Tooltip
            content="Your medical specialty helps Phlox provide more relevant assistance and suggestions"
            showArrow
            fontSize="xs"
            bg="gray.700"
            color="white"
            positioning={{
              placement: "top"
            }}
          >
            <InfoIcon boxSize={3} color={"textSecondary"} />
          </Tooltip>
        </HStack>
        <NativeSelect.Root>
          <NativeSelect.Field
            placeholder="Select your specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="input-style"
            size="md">
            {SPECIALTIES.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
    </VStack>
  </VStack>
);
